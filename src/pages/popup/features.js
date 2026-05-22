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
import { VoiceController } from '../../utils/voice/voice-controller.js';
import { createTTSButton } from './voice.js';
import { Logger } from '../../utils/core/logger.js';
import { ErrorHandler } from '../../utils/core/error-handler.js';
import { getLanguageNameIT } from '../../utils/i18n/language-names.js';

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
    showError('Nessun articolo analizzato');
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
    await Modal.error(I18n.t('qa.invalidQuestion') + error.message, I18n.t('common.invalidInput'));
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

    if (!response) {
      throw new Error('Il servizio non risponde. Riapri il popup e riprova.');
    }
    if (!response.success) {
      throw new Error(response.error);
    }

    const answer = response.result.answer;

    elements.qaAnswer.classList.remove('loading');

    // Crea contenitore per risposta con pulsante TTS
    const answerContainer = document.createElement('div');
    answerContainer.className = 'qa-answer-container';

    const answerText = document.createElement('div');
    answerText.className = 'qa-answer-text';
    answerText.textContent = answer;

    const voiceLang = VoiceController.mapLanguageCode(state.selectedLanguage);
    const ttsBtn = createTTSButton(answer, voiceLang, 'Leggi Risposta');
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

export async function translateArticle() {
  if (!state.currentArticle) {
    showError('Nessun articolo da tradurre');
    return;
  }

  elements.translateBtn.disabled = true;
  elements.translateBtn.textContent = I18n.t('feedback.translating');

  // Mostra loading
  elements.translationContent.innerHTML =
    '<div class="translation-loading">Traduzione in corso... Questo potrebbe richiedere 10-30 secondi.</div>';

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
          `L'articolo sembra già essere in ${targetLanguage}. Vuoi comunque tradurlo?`,
          'Conferma Traduzione',
          '🌍',
        );

        if (!confirmed) {
          resetTranslationButton();
          elements.translationContent.innerHTML = `
            <div class="translation-empty">
              <p>Clicca sul pulsante per tradurre l'articolo completo</p>
              <button id="translateBtn" class="btn btn-primary">🌍 Traduci Articolo</button>
            </div>
          `;
          document
            .getElementById('translateBtn')
            .addEventListener('click', translateArticle, { once: true });
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

      if (!translateResponse) {
        throw new Error('Il servizio non risponde. Riapri il popup e riprova.');
      }
      if (!translateResponse.success) {
        throw new Error(translateResponse.error);
      }

      translation = translateResponse.result.translation;

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
        <p class="translation-error">❌ Errore durante la traduzione: ${HtmlSanitizer.escape(error.message)}</p>
        <button id="translateBtn" class="btn btn-primary">🔄 Riprova</button>
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
  const targetName = getLanguageNameIT(targetLang);
  const originalName = getLanguageNameIT(originalLang);

  const cacheBadge = fromCache ? '<span class="cache-badge">Da cache</span>' : '';

  elements.translationContent.innerHTML = `
    <div class="translation-header">
      <div class="translation-info">
        📝 Tradotto da ${originalName} a ${targetName} ${cacheBadge}
      </div>
      <div class="translation-actions">
        <button id="copyTranslationBtn" class="btn-icon" title="Copia traduzione">📋</button>
        <button id="retranslateBtn" class="btn-icon" title="Traduci di nuovo">🔄</button>
      </div>
    </div>
    <div class="translation-text">${HtmlSanitizer.escape(translation)}</div>
  `;

  // Add event listeners
  document.getElementById('copyTranslationBtn').addEventListener('click', copyTranslation);
  document.getElementById('retranslateBtn').addEventListener('click', async () => {
    const confirmed = await Modal.confirm(
      'Vuoi generare una nuova traduzione? Quella in cache verrà sostituita.',
      'Rigenera Traduzione',
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
  elements.translateBtn.textContent = '🌍 Traduci Articolo';
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
