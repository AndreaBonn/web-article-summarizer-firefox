// Reading Mode - Features Module
// Gestisce traduzioni, citazioni, Q&A e aggiornamento storage
// Funzioni helper PDF (translatePDFText, extractPDFCitations, askQuestionPDF) → reading-mode-pdf.js

import { state, elements } from './state.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { Logger } from '../../utils/core/logger.js';
import { unwrapServiceResponse } from '../../utils/core/service-response.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { Modal } from '../../utils/core/modal.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import {
  resolvePdfText,
  applyArticleUpdate,
  renderTranslationHtml,
  renderExtractedCitationsHtml,
} from './reading-mode-history.js';

// Translate article
export async function translateArticle() {
  // Check if we have data (article or PDF)
  if (!state.currentData) return;

  // For PDFs, check if we have extracted text - gestisci diverse strutture
  const extractedText = resolvePdfText(state.currentData);
  if (state.currentData.isPDF && !extractedText) {
    Logger.error('No extracted text for PDF translation');
    await Modal.error('Testo non disponibile per la traduzione');
    return;
  }

  // For articles, check if we have article object
  if (!state.currentData.isPDF && !state.currentData.article) {
    Logger.error('No article for translation');
    return;
  }

  elements.translateBtn.disabled = true;
  elements.translateBtn.textContent = '⏳ Traduzione in corso...';

  try {
    // Get settings
    const settings = await StorageManager.getSettings();
    const provider = settings.selectedProvider || 'groq';
    const targetLanguage = state.currentData.metadata?.language || 'it';

    let translationResult;

    if (state.currentData.isPDF) {
      // Delegate to service worker (API key stays in background)
      const pdfResponse = await browser.runtime.sendMessage({
        action: 'translatePDF',
        text: extractedText,
        targetLanguage,
        provider,
        forceTranslate: false,
      });

      const result = unwrapServiceResponse(
        pdfResponse,
        'Il servizio non risponde. Ricarica la pagina e riprova.',
      );

      translationResult = result;

      // Check if same language detected
      if (translationResult.sameLanguage) {
        const choice = await showSameLanguageModal(targetLanguage);

        if (choice === 'translate') {
          const forceResponse = await browser.runtime.sendMessage({
            action: 'translatePDF',
            text: extractedText,
            targetLanguage,
            provider,
            forceTranslate: true,
          });

          if (!forceResponse || !forceResponse.success) {
            throw new Error(forceResponse?.error || 'Errore durante la traduzione forzata.');
          }
          translationResult = forceResponse.result;
        } else if (choice === 'ignore') {
          translationResult = {
            sameLanguage: false,
            translation: extractedText,
          };
        } else {
          elements.translateBtn.disabled = false;
          elements.translateBtn.textContent = 'Traduci Articolo';
          return;
        }
      }
    } else {
      // For articles, delegate to service worker (API key stays in background)
      const translateResponse = await browser.runtime.sendMessage({
        action: 'translateArticle',
        article: state.currentData.article,
        targetLanguage,
        provider,
      });

      const result = unwrapServiceResponse(
        translateResponse,
        'Il servizio non risponde. Ricarica la pagina e riprova.',
      );

      translationResult = {
        sameLanguage: false,
        translation: result.translation,
      };
    }

    // Display translation
    const title = state.currentData.isPDF
      ? state.currentData.filename
      : state.currentData.article.title;
    const translation = translationResult.translation;

    elements.translationTabContent.innerHTML = renderTranslationHtml(title, translation);

    // Save to current data
    state.currentData.translation = translation;

    // Update in storage
    await updateDataInStorage();
  } catch (error) {
    Logger.error('Translation error:', error);
    elements.translationTabContent.innerHTML = `
      <div class="empty-state">
        <p class="error-text">❌ ${HtmlSanitizer.escape(error.message)}</p>
        <button id="translateBtn" class="btn btn-primary">Riprova</button>
      </div>
    `;
    document.getElementById('translateBtn').addEventListener('click', translateArticle);
  } finally {
    elements.translateBtn.disabled = false;
    elements.translateBtn.textContent = 'Traduci Articolo';
  }
}

// Extract citations
export async function extractCitations() {
  // Check if we have data (article or PDF)
  if (!state.currentData) return;

  // For PDFs, check if we have extracted text - gestisci diverse strutture
  const extractedText = resolvePdfText(state.currentData);
  if (state.currentData.isPDF && !extractedText) {
    Logger.error('No extracted text for PDF citations');
    await Modal.error("Testo non disponibile per l'estrazione citazioni");
    return;
  }

  // For articles, check if we have article object
  if (!state.currentData.isPDF && !state.currentData.article) {
    Logger.error('No article for citations');
    return;
  }

  elements.extractCitationsBtn.disabled = true;
  elements.extractCitationsBtn.textContent = '⏳ Estrazione in corso...';

  try {
    // Get settings
    const settings = await StorageManager.getSettings();
    const provider = settings.selectedProvider || 'groq';

    let citations;

    if (state.currentData.isPDF) {
      // Delegate to service worker (API key stays in background)
      const filename = state.currentData.filename || state.currentData.pdf?.name || 'PDF';
      const pdfResponse = await browser.runtime.sendMessage({
        action: 'extractPDFCitations',
        text: extractedText,
        filename,
        provider,
      });

      const result = unwrapServiceResponse(
        pdfResponse,
        'Il servizio non risponde. Ricarica la pagina e riprova.',
      );

      citations = result;
    } else {
      // For articles, call background script
      const response = await browser.runtime.sendMessage({
        action: 'extractCitations',
        article: state.currentData.article,
        provider: provider,
        settings: settings,
      });

      if (!response) {
        throw new Error('Il servizio non risponde. Ricarica la pagina e riprova.');
      }
      if (!response.success) {
        throw new Error(response.error || "Errore durante l'estrazione");
      }

      citations = response.result.citations;
    }

    // Display citations
    elements.citationsTabContent.innerHTML = renderExtractedCitationsHtml(citations);

    // Save to current data
    state.currentData.citations = citations;

    // Update in storage
    await updateDataInStorage();
  } catch (error) {
    Logger.error('Citations error:', error);
    elements.citationsTabContent.innerHTML = `
      <div class="empty-state">
        <p class="error-text">❌ ${HtmlSanitizer.escape(error.message)}</p>
        <button id="extractCitationsBtn" class="btn btn-primary">Riprova</button>
      </div>
    `;
    document.getElementById('extractCitationsBtn').addEventListener('click', extractCitations);
  }
}

// Show modal when same language is detected
function showSameLanguageModal(targetLanguage) {
  return new Promise((resolve) => {
    // Language names in current UI language
    const languageKey = `language.${targetLanguage}`;
    const langName = I18n.t(languageKey);

    // Get translated strings
    const title = I18n.t('sameLanguage.title').replace('{language}', langName);
    const message = I18n.t('sameLanguage.message').replace('{language}', langName);
    const translateBtn = I18n.t('sameLanguage.translate');
    const useOriginalBtn = I18n.t('sameLanguage.useOriginal');
    const cancelBtn = I18n.t('sameLanguage.cancel');

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `
      <div class="custom-modal-overlay"></div>
      <div class="custom-modal-content">
        <div class="custom-modal-icon">ℹ️</div>
        <h3 class="custom-modal-title">${HtmlSanitizer.escape(title)}</h3>
        <p class="custom-modal-message">${HtmlSanitizer.escape(message)}</p>
        <div class="custom-modal-buttons modal-buttons-column">
          <button id="sameLanguageTranslate" class="modal-btn modal-btn-confirm modal-btn-full">
            ${HtmlSanitizer.escape(translateBtn)}
          </button>
          <button id="sameLanguageIgnore" class="modal-btn modal-btn-secondary modal-btn-full-secondary">
            ${HtmlSanitizer.escape(useOriginalBtn)}
          </button>
          <button id="sameLanguageCancel" class="modal-btn modal-btn-cancel modal-btn-full">
            ${HtmlSanitizer.escape(cancelBtn)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    const handleTranslate = () => {
      document.body.removeChild(modal);
      resolve('translate');
    };

    const handleIgnore = () => {
      document.body.removeChild(modal);
      resolve('ignore');
    };

    const handleCancel = () => {
      document.body.removeChild(modal);
      resolve('cancel');
    };

    // Add event listeners
    document.getElementById('sameLanguageTranslate').addEventListener('click', handleTranslate);
    document.getElementById('sameLanguageIgnore').addEventListener('click', handleIgnore);
    document.getElementById('sameLanguageCancel').addEventListener('click', handleCancel);

    // Close on overlay click
    modal.querySelector('.custom-modal-overlay').addEventListener('click', handleCancel);
  });
}

// askQuestion extracted to features-qa.js

// Update data in storage (save to history)
export async function updateDataInStorage() {
  try {
    if (state.currentData.isPDF) {
      // Delegate to HistoryManager (uses correct key 'pdfHistory' and flat structure)
      // PDF reading data carries the history entry id as `historyId`
      const pdfId = state.currentData.historyId || state.currentData.id;
      if (!pdfId) {
        Logger.warn('PDF senza ID cronologia, aggiornamento saltato');
        return;
      }
      if (state.currentData.translation) {
        const targetLang = state.currentData.metadata?.language || 'it';
        await HistoryManager.updatePDFWithTranslation(
          pdfId,
          state.currentData.translation,
          targetLang,
          null,
        );
      }
      if (state.currentData.qa) {
        await HistoryManager.updatePDFWithQA(pdfId, state.currentData.qa);
      }
      if (state.currentData.citations) {
        await HistoryManager.updatePDFWithCitations(pdfId, state.currentData.citations);
      }
      Logger.info('Dati PDF aggiornati nella cronologia');
    } else {
      // For articles, update in article history
      const result = await browser.storage.local.get(['summaryHistory']);
      const history = result.summaryHistory || [];

      const { history: updatedHistory, found } = applyArticleUpdate(
        history,
        state.currentData,
        Date.now(),
      );

      if (found) {
        await browser.storage.local.set({ summaryHistory: updatedHistory });
        Logger.info('Dati aggiornati nella cronologia');
      } else {
        Logger.warn('⚠️ Articolo non trovato nella cronologia');
      }
    }
  } catch (error) {
    Logger.error('Error updating storage:', error);
    await Modal.warning(
      'I dati restano visibili ma non sono stati salvati nella cronologia.',
      'Errore salvataggio',
    );
  }
}
