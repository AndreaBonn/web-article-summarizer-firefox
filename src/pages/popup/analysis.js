// Popup Analysis Module - Extracted from popup.js
// Handles: analyzeArticle, generateSummary, displayResults, switchTab, copyToClipboard

import { state, elements, showState, presentError, getSummaryLength } from './state.js';
import { translationState, citationsState } from './features.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { ContentClassifier } from '../../utils/ai/content-classifier.js';
import { ErrorHandler, UNSUPPORTED_PAGE_MARKER } from '../../utils/core/error-handler.js';
import { Toast } from '../../utils/core/toast.js';
import { isSupportedArticleUrl, getContentTypeLabel } from '../../utils/core/display-labels.js';
import { Logger } from '../../utils/core/logger.js';
import { unwrapServiceResponse } from '../../utils/core/service-response.js';
import { addTTSButtons } from './voice.js';
import {
  toExtractionError,
  truncateContent,
  findSavedContentType,
  resolveContentTypeOutcome,
  formatArticleMeta,
  renderKeypointsHtml,
  buildHistoryMetadata,
  buildCopyText,
} from './analysis-format.js';

export async function analyzeArticle() {
  showState('loading');
  elements.loadingText.textContent = I18n.t('loading.extract');

  try {
    // Get current tab
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    // The content script only runs on https pages (manifest content_scripts)
    if (!isSupportedArticleUrl(tab.url)) {
      throw new Error(UNSUPPORTED_PAGE_MARKER);
    }

    // Extract article
    let response;
    try {
      response = await browser.tabs.sendMessage(tab.id, {
        action: 'extractArticle',
      });
    } catch (msgError) {
      throw toExtractionError(msgError);
    }

    if (!response || !response.success) {
      throw new Error(response?.error || I18n.t('popup.extractionError'));
    }

    state.currentArticle = response.article;
    state.currentArticle.url = tab.url;

    // Limit article content size to prevent excessive resource usage
    const fullContent = state.currentArticle.content;
    const truncatedContent = truncateContent(fullContent);
    if (truncatedContent !== fullContent) {
      state.currentArticle.content = truncatedContent;
    }

    // Display article info
    elements.articleTitle.textContent = state.currentArticle.title;
    elements.articleStats.textContent = formatArticleMeta(
      state.currentArticle,
      state.currentResults,
      elements.providerSelect.value,
    );

    // Check if the article has already been analyzed before
    const history = await HistoryManager.getHistory();
    const savedContentType = findSavedContentType(history, state.currentArticle.url);

    if (savedContentType) {
      // Article already analyzed with a saved contentType

      // Set the saved article type in selects
      state.selectedContentType = savedContentType;
      elements.contentTypeSelect.value = savedContentType;

      Logger.info('📋 Tipo di articolo recuperato dalla cronologia:', savedContentType);
    }
  } catch (error) {
    Logger.error('Errore analisi:', error);
    await presentError(error, 'Analisi articolo');
    return;
  }

  // One click: reading the page flows straight into the summary
  await generateSummary();
}

export async function generateSummary() {
  if (!state.currentArticle) {
    await presentError(new Error('No article found'), 'Generazione riassunto');
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
    settings.summaryLength = getSummaryLength();

    // STEP 1: Content type classification
    state.progressTracker.setStep('classify');
    let finalContentType = state.selectedContentType;

    Logger.debug('🎯 selectedContentType:', state.selectedContentType);

    if (state.selectedContentType === 'auto') {
      Logger.debug('🔄 Avvio classificazione automatica...');
      state.progressTracker.setStep('classify', I18n.t('progress.analyzingType'));

      Logger.debug('📋 currentArticle:', state.currentArticle);

      try {
        const classification = await ContentClassifier.classifyArticle(
          state.currentArticle,
          'auto',
        );
        finalContentType = classification.category;

        Logger.info('✅ Classificazione completata:', classification);

        // Mostra la categoria rilevata
        const categoryLabel = getContentTypeLabel(finalContentType, I18n.currentLanguage);
        state.progressTracker.setStep(
          'classify',
          I18n.tf('progress.detected', { type: categoryLabel }),
        );
        await new Promise((resolve) => setTimeout(resolve, 800));
      } catch (error) {
        Logger.error('❌ Errore classificazione:', error);
        await ErrorHandler.logError(error, 'Classificazione contenuto');
        finalContentType = 'general';
        state.progressTracker.setStep('classify', I18n.t('popup.classificationUnavailable'));
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    } else {
      Logger.debug('👤 Tipo già impostato (manuale o da cronologia):', state.selectedContentType);
      state.progressTracker.setStep('classify', I18n.t('progress.typeAlreadySet'));
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

    const result = unwrapServiceResponse(response, I18n.t('popup.serviceUnavailable'));

    state.currentResults = result;

    // STEP 3: Key points (already included, but show the step)
    state.progressTracker.setStep('keypoints');
    await new Promise((resolve) => setTimeout(resolve, 300));

    // STEP 4: Save
    state.progressTracker.setStep('save');

    const outcome = resolveContentTypeOutcome(state.selectedContentType, finalContentType);
    state.currentResults.detectedContentType = outcome.detectedContentType;
    state.currentResults.contentTypeMethod = outcome.contentTypeMethod;

    await new Promise((resolve) => setTimeout(resolve, 200));

    state.progressTracker.complete();
    displayResults();
  } catch (error) {
    state.progressTracker.hide();
    await presentError(error, 'Generazione riassunto');
  }
}

export async function displayResults() {
  // Display summary (sanitized AI content)
  let summaryHtml = `<p>${HtmlSanitizer.escape(state.currentResults.summary)}</p>`;
  if (state.currentResults.fromCache) {
    summaryHtml =
      `<p class="cache-badge">${HtmlSanitizer.escape(I18n.t('results.fromCache'))}</p>` +
      summaryHtml;
  }
  elements.articleStats.textContent = formatArticleMeta(
    state.currentArticle,
    state.currentResults,
    elements.providerSelect.value,
  );
  elements.summaryContent.innerHTML = summaryHtml;

  // Display key points
  const keypointsHtml = renderKeypointsHtml(state.currentResults.keyPoints);
  elements.keypointsContent.innerHTML = keypointsHtml;

  // Add click handler for highlight
  document.querySelectorAll('.keypoint').forEach((el) => {
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        el.click();
      }
    });
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
    const metadata = buildHistoryMetadata({
      providerValue: elements.providerSelect.value,
      selectedLanguage: state.selectedLanguage,
      selectedContentType: state.selectedContentType,
      results: state.currentResults,
    });

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
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
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

  const text = buildCopyText({
    results: state.currentResults,
    translation: translationState.value,
    qa: state.currentQA,
    citations: citationsState.value,
    article: state.currentArticle,
    citationStyle: document.getElementById('citationStyleSelect')?.value,
  });

  try {
    await navigator.clipboard.writeText(text);
    elements.copyBtn.textContent = I18n.t('feedback.copied');
    setTimeout(() => {
      elements.copyBtn.textContent = I18n.t('action.copy');
    }, 2000);
  } catch (error) {
    Logger.error('Errore copia:', error);
    Toast.show(I18n.t('common.copyError'), 'error');
  }
}
