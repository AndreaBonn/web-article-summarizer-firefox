// Popup Analysis Module - Extracted from popup.js
// Handles: analyzeArticle, generateSummary, displayResults, switchTab, copyToClipboard

import { state, elements, showState } from './state.js';
import { translationState, citationsState } from './features.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { ContentClassifier } from '../../utils/ai/content-classifier.js';
import { CitationExtractor } from '../../utils/ai/citation-extractor.js';
import { ErrorHandler } from '../../utils/core/error-handler.js';
import { Logger } from '../../utils/core/logger.js';
import { addTTSButtons } from './voice.js';
import { formatQAText, formatTranslationText } from '../../shared/export-formatters.js';

export async function analyzeArticle() {
  showState('loading');
  elements.loadingText.textContent = I18n.t('loading.extract');

  try {
    // Get current tab
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Verify it is not a chrome:// page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Impossibile analizzare pagine interne di Chrome');
    }

    // Extract article
    let response;
    try {
      response = await browser.tabs.sendMessage(tab.id, {
        action: 'extractArticle',
      });
    } catch (msgError) {
      if (
        msgError.message?.includes('Could not establish connection') ||
        msgError.message?.includes('Receiving end does not exist')
      ) {
        throw new Error(
          'Impossibile comunicare con la pagina. Ricarica la pagina (F5) e riprova.',
          { cause: msgError },
        );
      }
      throw msgError;
    }

    if (!response || !response.success) {
      throw new Error(response?.error || "Errore durante l'estrazione");
    }

    state.currentArticle = response.article;
    state.currentArticle.url = tab.url;

    // Limit article content size to prevent excessive resource usage
    const MAX_CONTENT_LENGTH = 50000;
    if (state.currentArticle.content && state.currentArticle.content.length > MAX_CONTENT_LENGTH) {
      state.currentArticle.content = state.currentArticle.content.substring(0, MAX_CONTENT_LENGTH);
    }

    // Display article info
    elements.articleTitle.textContent = state.currentArticle.title;
    elements.articleStats.textContent = `${state.currentArticle.wordCount} ${I18n.t('article.words')} • ${state.currentArticle.readingTimeMinutes} ${I18n.t('article.readingTime')}`;

    // Check if the article has already been analyzed before
    const history = await HistoryManager.getHistory();
    const previousAnalysis = history.find(
      (entry) => entry.article.url === state.currentArticle.url,
    );

    if (previousAnalysis && previousAnalysis.metadata && previousAnalysis.metadata.contentType) {
      // Article already analyzed with a saved contentType
      const savedContentType = previousAnalysis.metadata.contentType;

      // Set the saved article type in selects
      state.selectedContentType = savedContentType;
      elements.contentTypeSelect.value = savedContentType;
      elements.contentTypeSelectReady.value = savedContentType;

      Logger.info('📋 Tipo di articolo recuperato dalla cronologia:', savedContentType);

      // Show temporary visual feedback
      elements.loadingText.textContent = `${I18n.t('loading.articleType')} ${ContentClassifier.getCategoryLabel(savedContentType)} (${I18n.t('loading.fromHistory')})`;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    showState('ready');
  } catch (error) {
    Logger.error('Errore analisi:', error);

    await ErrorHandler.showError(error, 'Analisi articolo');
    showState('error');
  }
}

export async function generateSummary() {
  if (!state.currentArticle) {
    await ErrorHandler.showError(new Error('Nessun articolo estratto'), 'Generazione riassunto');
    return;
  }

  showState('loading');
  state.progressTracker.start();

  try {
    const settings = await StorageManager.getSettings();
    const provider = elements.providerSelect.value;

    // Add selected language to settings
    settings.outputLanguage = state.selectedLanguage;

    // Add selected summary length
    const summaryLengthSelect = document.getElementById('summaryLengthSelect');
    if (summaryLengthSelect) {
      settings.summaryLength = summaryLengthSelect.value;
    }

    // STEP 1: Content type classification
    state.progressTracker.setStep('classify');
    let finalContentType = state.selectedContentType;

    Logger.debug('🎯 selectedContentType:', state.selectedContentType);

    if (state.selectedContentType === 'auto') {
      Logger.debug('🔄 Avvio classificazione automatica...');
      state.progressTracker.setStep('classify', '🔍 Analisi contenuto con AI...');

      Logger.debug('📋 currentArticle:', state.currentArticle);

      try {
        const classification = await ContentClassifier.classifyArticle(
          state.currentArticle,
          'auto',
        );
        finalContentType = classification.category;

        Logger.info('✅ Classificazione completata:', classification);

        // Mostra la categoria rilevata
        const categoryLabel = ContentClassifier.getCategoryLabel(finalContentType);
        state.progressTracker.setStep('classify', `✓ Rilevato: ${categoryLabel}`);
        await new Promise((resolve) => setTimeout(resolve, 800));
      } catch (error) {
        Logger.error('❌ Errore classificazione:', error);
        await ErrorHandler.logError(error, 'Classificazione contenuto');
        finalContentType = 'general';
        state.progressTracker.setStep(
          'classify',
          '⚠️ Classificazione non disponibile — uso tipo Generale',
        );
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    } else {
      Logger.debug('👤 Tipo già impostato (manuale o da cronologia):', state.selectedContentType);
      state.progressTracker.setStep('classify', '✓ Tipo già impostato');
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // STEP 2: Summary generation
    state.progressTracker.setStep('generate');
    settings.contentType = finalContentType;

    const response = await browser.runtime.sendMessage({
      action: 'generateSummary',
      article: state.currentArticle,
      provider: provider,
      settings: settings,
    });

    if (!response) {
      throw new Error('Il servizio non risponde. Riapri il popup e riprova.');
    }
    if (!response.success) {
      throw new Error(response.error);
    }

    state.currentResults = response.result;

    // STEP 3: Key points (already included, but show the step)
    state.progressTracker.setStep('keypoints');
    await new Promise((resolve) => setTimeout(resolve, 300));

    // STEP 4: Save
    state.progressTracker.setStep('save');

    if (state.selectedContentType === 'auto') {
      state.currentResults.detectedContentType = finalContentType;
      state.currentResults.contentTypeMethod = 'auto';
    } else {
      state.currentResults.detectedContentType = state.selectedContentType;
      state.currentResults.contentTypeMethod = 'manual';
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    state.progressTracker.complete();
    displayResults();
  } catch (error) {
    state.progressTracker.error(error.message);

    await ErrorHandler.showError(error, 'Generazione riassunto');
    setTimeout(() => {
      showState('error');
    }, 2000);
  }
}

export async function displayResults() {
  // Display summary (sanitized AI content)
  let summaryHtml = `<p>${HtmlSanitizer.escape(state.currentResults.summary)}</p>`;
  if (state.currentResults.fromCache) {
    summaryHtml = `<span class="cache-badge">Da cache</span>` + summaryHtml;
  }
  elements.summaryContent.innerHTML = summaryHtml;

  // Display key points
  let keypointsHtml = '';
  state.currentResults.keyPoints.forEach((point, index) => {
    keypointsHtml += `
      <div class="keypoint" data-paragraph="${HtmlSanitizer.escape(String(point.paragraphs))}">
        <div class="keypoint-header">
          <div class="keypoint-title">${index + 1}. ${HtmlSanitizer.escape(point.title)}</div>
          <div class="keypoint-ref">§${HtmlSanitizer.escape(String(point.paragraphs))}</div>
        </div>
        <div class="keypoint-desc">${HtmlSanitizer.escape(point.description)}</div>
      </div>
    `;
  });
  elements.keypointsContent.innerHTML = keypointsHtml;

  // Add click handler for highlight
  document.querySelectorAll('.keypoint').forEach((el) => {
    el.addEventListener('click', async () => {
      try {
        const paragraph = el.dataset.paragraph;
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        await browser.tabs.sendMessage(tab.id, {
          action: 'highlightParagraph',
          paragraphNumber: paragraph,
        });
      } catch (error) {
        Logger.warn('Impossibile evidenziare il paragrafo nella pagina:', error.message);
      }
    });
  });

  // Save to history
  try {
    const metadata = {
      provider: elements.providerSelect.value,
      language: state.selectedLanguage,
      contentType: state.currentResults.detectedContentType || state.selectedContentType,
      contentTypeMethod: state.currentResults.contentTypeMethod || 'manual',
      fromCache: state.currentResults.fromCache || false,
    };

    await HistoryManager.saveSummary(
      state.currentArticle,
      state.currentResults.summary,
      state.currentResults.keyPoints,
      metadata,
    );
  } catch (error) {
    Logger.error('Errore salvataggio cronologia:', error);
    await ErrorHandler.logError(error, 'displayResults.saveHistory');
  }

  showState('results');

  // Add TTS buttons after displaying results
  setTimeout(() => {
    addTTSButtons();
  }, 100);
}

export function switchTab(tabName) {
  // Update active tabs
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });

  // Aggiorna contenuto
  document.querySelectorAll('.tab-pane').forEach((pane) => {
    pane.classList.remove('active');
  });

  if (tabName === 'summary') {
    document.getElementById('summaryTab').classList.add('active');
  } else if (tabName === 'keypoints') {
    document.getElementById('keypointsTab').classList.add('active');
  } else if (tabName === 'translation') {
    document.getElementById('translationTab').classList.add('active');
  } else if (tabName === 'citations') {
    document.getElementById('citationsTab').classList.add('active');
  }
}

export async function copyToClipboard() {
  if (!state.currentResults) return;

  let text = `RIASSUNTO:\n${state.currentResults.summary}\n\n`;
  text += `PUNTI CHIAVE:\n`;
  state.currentResults.keyPoints.forEach((point, index) => {
    text += `${index + 1}. ${point.title} (§${point.paragraphs})\n   ${point.description}\n\n`;
  });

  // Aggiungi traduzione se presente
  if (translationState.value) {
    text += `\n`;
    text += formatTranslationText(translationState.value);
  }

  // Aggiungi Q&A se presenti
  if (state.currentQA && state.currentQA.length > 0) {
    text += `\n`;
    text += formatQAText(state.currentQA);
  }

  // Aggiungi citazioni se presenti
  if (
    citationsState.value &&
    citationsState.value.citations &&
    citationsState.value.citations.length > 0
  ) {
    text += `\n${'='.repeat(50)}\n\n`;
    text += `CITAZIONI E BIBLIOGRAFIA:\n\n`;
    const style = document.getElementById('citationStyleSelect')?.value || 'apa';
    text += CitationExtractor.generateBibliography(
      state.currentArticle,
      citationsState.value.citations,
      style,
    );
  }

  try {
    await navigator.clipboard.writeText(text);
    elements.copyBtn.textContent = I18n.t('feedback.copied');
    setTimeout(() => {
      elements.copyBtn.textContent = I18n.t('action.copy');
    }, 2000);
  } catch (error) {
    Logger.error('Errore copia:', error);
    elements.copyBtn.textContent = '❌ Errore copia';
    setTimeout(() => {
      elements.copyBtn.textContent = I18n.t('action.copy');
    }, 2000);
  }
}
