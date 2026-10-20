// Popup Features Module - Estratto da popup.js
// Gestisce: Q&A e traduzione

import { state, elements, showError } from './state.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { InputSanitizer } from '../../utils/security/input-sanitizer.js';
import { ContentDetector } from '../../utils/ai/content-detector.js';
import { Modal } from '../../utils/core/modal.js';
import { Toast } from '../../utils/core/toast.js';
import { VoiceController } from '../../utils/voice/voice-controller.js';
import { createTTSButton } from './voice.js';
import { Logger } from '../../utils/core/logger.js';
import { unwrapServiceResponse } from '../../utils/core/service-response.js';
import { ErrorHandler } from '../../utils/core/error-handler.js';
import { getLanguageLabel } from '../../utils/core/display-labels.js';

// Translation System — usa un oggetto wrapper per permettere la mutazione cross-modulo
export const translationState = { value: null };

// Citations System — stesso pattern
export const citationsState = { value: null };

// Getter/setter per compatibilità con i moduli che importano i valori
export function getCurrentTranslation() {
  return translationState.value;
}
export function setCurrentTranslation(val) {
  translationState.value = val;
}
export function getCurrentCitations() {
  return citationsState.value;
}
export function setCurrentCitations(val) {
  citationsState.value = val;
}

// Q&A System
export async function askQuestion() {
  const question = elements.questionInput.value.trim();

  if (!question) {
    return;
  }

  if (!state.currentArticle || !state.currentResults) {
    showError(I18n.t('popup.noArticleAnalyzed'));
    return;
  }

  // ✅ SANITIZZA LA DOMANDA UTENTE
  let cleanQuestion;
  try {
    cleanQuestion = InputSanitizer.sanitizeUserPrompt(question, {
      maxLength: 500,
      minLength: 3,
    });
  } catch (error) {
    Toast.show(I18n.t('qa.invalidQuestion') + error.message, 'error');
    return;
  }

  elements.askBtn.disabled = true;
  elements.askBtn.textContent = I18n.t('feedback.loading');
  elements.qaAnswer.classList.remove('hidden');
  elements.qaAnswer.classList.add('loading');
  elements.qaAnswer.textContent = I18n.t('feedback.thinking');

  try {
    const settings = await StorageManager.getSettings();
    const provider = elements.providerSelect.value;
    settings.outputLanguage = state.selectedLanguage;

    // Delegate to service worker (API key stays in background)
    const response = await browser.runtime.sendMessage({
      action: 'askQuestion',
      question: cleanQuestion,
      article: state.currentArticle,
      summary: state.currentResults.summary,
      provider,
      settings,
    });

    const result = unwrapServiceResponse(response, I18n.t('popup.serviceUnavailable'));

    const answer = result.answer;

    elements.qaAnswer.classList.remove('loading');

    // Crea contenitore per risposta con pulsante TTS
    const answerContainer = document.createElement('div');
    answerContainer.className = 'qa-answer-container';

    const answerText = document.createElement('div');
    answerText.className = 'qa-answer-text';
    answerText.textContent = answer;

    const voiceLang = VoiceController.mapLanguageCode(state.selectedLanguage);
    const ttsBtn = createTTSButton(answer, voiceLang, I18n.t('voice.readAnswer'));
    ttsBtn.style.marginTop = '8px';

    answerContainer.appendChild(answerText);
    answerContainer.appendChild(ttsBtn);

    elements.qaAnswer.innerHTML = '';
    elements.qaAnswer.appendChild(answerContainer);

    // Salva la Q&A nell'array (usa la domanda sanitizzata)
    state.currentQA.push({
      question: cleanQuestion,
      answer: answer,
      timestamp: new Date().toISOString(),
    });

    // Aggiorna anche la cronologia con le Q&A
    if (state.currentArticle && state.currentArticle.url) {
      await HistoryManager.updateSummaryWithQA(state.currentArticle.url, state.currentQA);
    }

    elements.questionInput.value = '';
  } catch (error) {
    Logger.error('Errore Q&A:', error);
    await ErrorHandler.logError(error, 'askQuestion');
    elements.qaAnswer.classList.remove('loading');
    elements.qaAnswer.textContent =
      I18n.t('feedback.error') + ' ' + ErrorHandler.getErrorMessage(error);
  } finally {
    elements.askBtn.disabled = false;
    elements.askBtn.textContent = I18n.t('qa.ask');
  }
}

// Pannello traduzione allo stato iniziale (nessuna traduzione), con il pulsante riagganciato
export function renderTranslationEmpty() {
  elements.translationContent.innerHTML = `
    <div class="translation-empty">
      <p>${HtmlSanitizer.escape(I18n.t('translation.empty'))}</p>
      <button id="translateBtn" class="btn btn-primary">${HtmlSanitizer.escape(I18n.t('translation.button'))}</button>
    </div>
  `;
  elements.translateBtn = document.getElementById('translateBtn');
  elements.translateBtn.addEventListener('click', translateArticle, { once: true });
}

export async function translateArticle() {
  if (!state.currentArticle) {
    showError(I18n.t('popup.noArticleToTranslate'));
    return;
  }

  elements.translateBtn.disabled = true;
  elements.translateBtn.textContent = I18n.t('feedback.translating');

  // Mostra loading
  elements.translationContent.innerHTML = `<div class="translation-loading">${HtmlSanitizer.escape(I18n.t('translation.loading'))}</div>`;

  try {
    const provider = elements.providerSelect.value;
    const targetLanguage = state.selectedLanguage;

    // Rileva lingua originale (semplice detection)
    const originalLanguage = ContentDetector.detectLanguage(state.currentArticle.content);

    // Controlla cache prima
    const cached = await StorageManager.getCachedTranslation(
      state.currentArticle.url,
      provider,
      targetLanguage,
    );

    let translation;
    let fromCache = false;

    if (cached) {
      translation = cached.translation;
      fromCache = true;
      Logger.info('Traduzione caricata da cache');
    } else {
      // Se la lingua è già quella target, avvisa
      if (originalLanguage === targetLanguage) {
        const confirmed = await Modal.confirm(
          I18n.tf('translation.alreadyInLanguage', {
            language: getLanguageLabel(targetLanguage, I18n.currentLanguage),
          }),
          I18n.t('translation.confirmTitle'),
          '🌍',
        );

        if (!confirmed) {
          resetTranslationButton();
          renderTranslationEmpty();
          return;
        }
      }

      // Delegate to service worker (API key stays in background)
      const translateResponse = await browser.runtime.sendMessage({
        action: 'translateArticle',
        article: state.currentArticle,
        targetLanguage,
        provider,
      });

      const result = unwrapServiceResponse(translateResponse, I18n.t('popup.serviceUnavailable'));

      translation = result.translation;

      // Salva in cache
      await StorageManager.saveCachedTranslation(
        state.currentArticle.url,
        provider,
        targetLanguage,
        translation,
        originalLanguage,
      );

      // Salva nello storico
      await HistoryManager.updateSummaryWithTranslation(
        state.currentArticle.url,
        translation,
        targetLanguage,
        originalLanguage,
      );
    }

    translationState.value = translation;
    displayTranslation(translation, targetLanguage, originalLanguage, fromCache);
  } catch (error) {
    Logger.error('Errore traduzione:', error);
    elements.translationContent.innerHTML = `
      <div class="translation-empty">
        <p class="translation-error">❌ ${HtmlSanitizer.escape(I18n.t('popup.translationError'))} ${HtmlSanitizer.escape(error.message)}</p>
        <button id="translateBtn" class="btn btn-primary">${HtmlSanitizer.escape(I18n.t('translation.retry'))}</button>
      </div>
    `;
    // Re-attach event listener (once: prevents stacking on repeated failures)
    document
      .getElementById('translateBtn')
      .addEventListener('click', translateArticle, { once: true });
  } finally {
    resetTranslationButton();
  }
}

function displayTranslation(translation, targetLang, originalLang, fromCache = false) {
  const targetName = getLanguageLabel(targetLang, I18n.currentLanguage);
  const originalName = getLanguageLabel(originalLang, I18n.currentLanguage);

  const cacheBadge = fromCache
    ? `<span class="cache-badge">${HtmlSanitizer.escape(I18n.t('citations.fromCache'))}</span>`
    : '';

  elements.translationContent.innerHTML = `
    <div class="translation-header">
      <div class="translation-info">
        ${HtmlSanitizer.escape(I18n.tf('translation.translatedFrom', { from: originalName, to: targetName }))} ${cacheBadge}
      </div>
      <div class="translation-actions">
        <button id="copyTranslationBtn" class="btn-icon" title="${HtmlSanitizer.escape(I18n.t('translation.copyTitle'))}">📋</button>
        <button id="retranslateBtn" class="btn-icon" title="${HtmlSanitizer.escape(I18n.t('translation.retranslateTitle'))}">🔄</button>
      </div>
    </div>
    <div class="translation-text">${HtmlSanitizer.escape(translation)}</div>
  `;

  // Add event listeners
  document.getElementById('copyTranslationBtn').addEventListener('click', copyTranslation);
  document.getElementById('retranslateBtn').addEventListener('click', async () => {
    const confirmed = await Modal.confirm(
      I18n.t('translation.confirmRegenerate'),
      I18n.t('translation.regenerateTitle'),
      '🔄',
    );

    if (confirmed) {
      // Forza rigenerazione rimuovendo dalla cache
      clearTranslationCache()
        .then(() => translateArticle())
        .catch((err) => Logger.error('Errore rigenerazione traduzione:', err));
    }
  });
}

async function clearTranslationCache() {
  const provider = elements.providerSelect.value;
  await StorageManager.clearTranslationCacheEntry(
    state.currentArticle.url,
    provider,
    state.selectedLanguage,
  );
}

function resetTranslationButton() {
  elements.translateBtn.disabled = false;
  elements.translateBtn.textContent = I18n.t('translation.buttonWithIcon');
}

async function copyTranslation() {
  if (!translationState.value) return;

  try {
    await navigator.clipboard.writeText(translationState.value);
    const btn = document.getElementById('copyTranslationBtn');
    const originalText = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  } catch (error) {
    Logger.error('Errore copia traduzione:', error);
    const btn = document.getElementById('copyTranslationBtn');
    btn.textContent = '✗';
    setTimeout(() => {
      btn.textContent = '📋';
    }, 2000);
  }
}
