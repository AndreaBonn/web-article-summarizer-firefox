import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import itMessages from '../../src/utils/i18n/locales/it.json';
const mocks = vi.hoisted(() => ({
  storage: {
    getSettings: vi.fn(),
    getCachedTranslation: vi.fn(),
    saveCachedTranslation: vi.fn(),
    clearTranslationCacheEntry: vi.fn(),
  },
  history: { updateSummaryWithQA: vi.fn(), updateSummaryWithTranslation: vi.fn() },
  confirm: vi.fn(),
  toast: vi.fn(),
  detectLanguage: vi.fn(),
  sendMessage: vi.fn(),
  createTTSButton: vi.fn((text) =>
    Object.assign(document.createElement('button'), { textContent: text }),
  ),
}));
vi.mock('../../src/utils/storage/storage-manager.js', () => ({ StorageManager: mocks.storage }));
vi.mock('../../src/utils/storage/history-manager.js', () => ({ HistoryManager: mocks.history }));
vi.mock('../../src/utils/core/modal.js', () => ({ Modal: { confirm: mocks.confirm } }));
vi.mock('../../src/utils/core/toast.js', () => ({ Toast: { show: mocks.toast } }));
vi.mock('../../src/utils/ai/content-detector.js', () => ({
  ContentDetector: { detectLanguage: mocks.detectLanguage },
}));
vi.mock('../../src/pages/popup/voice.js', () => ({
  createTTSButton: mocks.createTTSButton,
}));
vi.mock('../../src/utils/voice/voice-controller.js', () => ({
  VoiceController: { mapLanguageCode: () => 'it-IT' },
}));
vi.mock('../../src/utils/core/logger.js', () => ({
  Logger: { error: vi.fn(), info: vi.fn() },
}));
import { ErrorHandler } from '../../src/utils/core/error-handler.js';
import { I18n } from '../../src/utils/i18n/i18n.js';
import { state, elements, initElements } from '../../src/pages/popup/state.js';
import {
  askQuestion,
  translateArticle,
  getCurrentTranslation,
  setCurrentTranslation,
  getCurrentCitations,
  setCurrentCitations,
} from '../../src/pages/popup/features.js';
beforeEach(() => {
  vi.resetAllMocks();
  I18n.currentLanguage = 'it';
  document.body.innerHTML = `
    <input id="questionInput"><button id="askBtn">Chiedi</button>
    <div id="qaAnswer" class="qa-answer hidden"></div>
    <select id="providerSelect"><option value="groq">Groq</option></select>
    <div id="translationContent"><div class="translation-empty">
      <button id="translateBtn">Traduci Articolo</button>
    </div></div>
    <div id="setupState"></div><div id="initialState"></div>
    <div id="loadingState"></div><div id="resultsState"></div>
    <div id="errorState"></div><div id="articleInfo"></div>
    <h2 id="errorTitle"></h2><p id="errorMessage"></p>
    <button id="errorConfigureBtn"></button><button id="errorOtherProviderBtn"></button>
    <button id="errorPdfBtn"></button><button id="retryBtn"></button>`;
  initElements();
  Object.assign(state, {
    currentArticle: { url: 'https://example.org/article', content: 'An English article.' },
    currentResults: { summary: 'Un riassunto' },
    currentQA: [],
    selectedLanguage: 'it',
  });
  setCurrentTranslation(null);
  setCurrentCitations(null);
  mocks.storage.getSettings.mockResolvedValue({ outputLanguage: 'en' });
  mocks.storage.getCachedTranslation.mockResolvedValue(null);
  mocks.detectLanguage.mockReturnValue('en');
  vi.stubGlobal('browser', { runtime: { sendMessage: mocks.sendMessage } });
  vi.spyOn(ErrorHandler, 'logError').mockResolvedValue();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setCurrentTranslation(null);
  setCurrentCitations(null);
  document.body.replaceChildren();
});
describe('askQuestion', () => {
  it('test_askQuestion_empty_keepsFormIdleWithoutRequest', async () => {
    elements.questionInput.value = '   ';
    await askQuestion();
    expect(elements.askBtn.disabled).toBe(false);
    expect(elements.qaAnswer.classList.contains('hidden')).toBe(true);
    expect(state.currentQA).toEqual([]);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(mocks.storage.getSettings).not.toHaveBeenCalled();
  });

  it('test_askQuestion_twoCharacters_showsValidationReason', async () => {
    elements.questionInput.value = 'ab';
    await askQuestion();
    expect(mocks.toast).toHaveBeenCalledWith(
      itMessages['qa.invalidQuestion'] + 'Testo troppo corto (minimo 3 caratteri)',
      'error',
    );
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it.each(['currentArticle', 'currentResults'])(
    'test_askQuestion_missing_%s_showsArticleError',
    async (field) => {
      state[field] = null;
      elements.questionInput.value = 'Perché?';
      await askQuestion();
      expect(elements.errorMessage.textContent).toBe('Nessun articolo analizzato');
      expect(elements.errorState.classList.contains('hidden')).toBe(false);
      expect(mocks.sendMessage).not.toHaveBeenCalled();
    },
  );

  it('test_askQuestion_success_appendsSanitizedQuestionAndPersistsConversation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
    const previous = { question: 'Prima?', answer: 'Sì', timestamp: '2026-10-19T10:00:00Z' };
    state.currentQA = [previous];
    elements.questionInput.value = '  <b>Quale risultato?</b>  ';
    mocks.sendMessage.mockResolvedValue({
      success: true,
      result: { answer: 'Il risultato è 42.' },
    });
    const pending = askQuestion();
    expect(elements.askBtn.disabled).toBe(true);
    expect(elements.qaAnswer.textContent).toBe(itMessages['feedback.thinking']);
    await pending;
    expect(mocks.sendMessage).toHaveBeenCalledWith({
      action: 'askQuestion',
      question: 'Quale risultato?',
      article: state.currentArticle,
      summary: 'Un riassunto',
      provider: 'groq',
      settings: { outputLanguage: 'it' },
    });
    expect(state.currentQA).toEqual([
      previous,
      {
        question: 'Quale risultato?',
        answer: 'Il risultato è 42.',
        timestamp: '2026-10-20T10:00:00.000Z',
      },
    ]);
    expect(mocks.history.updateSummaryWithQA).toHaveBeenCalledWith(
      'https://example.org/article',
      state.currentQA,
    );
    expect(mocks.createTTSButton).toHaveBeenCalledWith(
      'Il risultato è 42.',
      'it-IT',
      'Leggi Risposta',
    );
    expect(elements.qaAnswer.querySelector('.qa-answer-text').textContent).toBe(
      'Il risultato è 42.',
    );
    expect(elements.questionInput.value).toBe('');
    expect(elements.askBtn.disabled).toBe(false);
    expect(elements.askBtn.textContent).toBe(itMessages['qa.ask']);
  });

  it('test_askQuestion_serviceError_rendersErrorAndReenablesButton', async () => {
    elements.questionInput.value = 'Quale risultato?';
    mocks.sendMessage.mockResolvedValue({ success: false, error: '503 Service Unavailable' });
    await askQuestion();
    expect(elements.qaAnswer.textContent).toBe(
      itMessages['feedback.error'] +
        ' Servizio temporaneamente non disponibile. Riprova più tardi.',
    );
    expect(elements.askBtn.disabled).toBe(false);
    expect(elements.askBtn.textContent).toBe(itMessages['qa.ask']);
    expect(state.currentQA).toEqual([]);
    expect(ErrorHandler.logError).toHaveBeenCalledWith(expect.any(Error), 'askQuestion');
  });
});

describe('translateArticle', () => {
  it('test_translateArticle_missingArticle_showsError', async () => {
    state.currentArticle = null;
    await translateArticle();
    expect(elements.errorMessage.textContent).toBe('Nessun articolo da tradurre');
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it('test_translateArticle_cached_rendersEscapedTranslationWithoutRequest', async () => {
    mocks.storage.getCachedTranslation.mockResolvedValue({ translation: '<b>Ciao</b>' });
    await translateArticle();
    expect(getCurrentTranslation()).toBe('<b>Ciao</b>');
    expect(elements.translationContent.querySelector('.translation-text').textContent).toBe(
      '<b>Ciao</b>',
    );
    expect(elements.translationContent.querySelector('.cache-badge').textContent).toBe('Da cache');
    expect(elements.translationContent.querySelector('.translation-text b')).toBeNull();
    expect(mocks.storage.getCachedTranslation).toHaveBeenCalledWith(
      'https://example.org/article',
      'groq',
      'it',
    );
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it('test_translateArticle_sameLanguageCancelled_restoresEmptyView', async () => {
    mocks.detectLanguage.mockReturnValue('it');
    mocks.confirm.mockResolvedValue(false);
    await translateArticle();
    expect(mocks.confirm).toHaveBeenCalledWith(
      "L'articolo sembra già essere in it. Vuoi comunque tradurlo?",
      'Conferma Traduzione',
      '🌍',
    );
    expect(elements.translationContent.querySelector('.translation-empty p').textContent).toBe(
      "Clicca sul pulsante per tradurre l'articolo completo",
    );
    expect(document.getElementById('translateBtn').disabled).toBe(false);
    expect(getCurrentTranslation()).toBeNull();
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it('test_translateArticle_confirmed_savesTranslationAndHistory', async () => {
    mocks.detectLanguage.mockReturnValue('it');
    mocks.confirm.mockResolvedValue(true);
    mocks.sendMessage.mockResolvedValue({
      success: true,
      result: { translation: 'Testo tradotto' },
    });
    await translateArticle();
    expect(mocks.sendMessage).toHaveBeenCalledWith({
      action: 'translateArticle',
      article: state.currentArticle,
      targetLanguage: 'it',
      provider: 'groq',
    });
    expect(mocks.storage.saveCachedTranslation).toHaveBeenCalledWith(
      'https://example.org/article',
      'groq',
      'it',
      'Testo tradotto',
      'it',
    );
    expect(mocks.history.updateSummaryWithTranslation).toHaveBeenCalledWith(
      'https://example.org/article',
      'Testo tradotto',
      'it',
      'it',
    );
    expect(getCurrentTranslation()).toBe('Testo tradotto');
    expect(elements.translateBtn.disabled).toBe(false);
  });

  it('test_translateArticle_error_rendersEscapedMessageAndRetryWorks', async () => {
    mocks.sendMessage.mockRejectedValueOnce(new Error('<b>Offline</b>'));
    await translateArticle();
    expect(elements.translationContent.querySelector('.translation-error').textContent).toBe(
      '❌ Errore durante la traduzione: <b>Offline</b>',
    );
    expect(elements.translationContent.querySelector('.translation-error b')).toBeNull();
    mocks.sendMessage.mockResolvedValue({ success: true, result: { translation: 'Recuperata' } });
    document.getElementById('translateBtn').click();
    await vi.waitFor(() => expect(getCurrentTranslation()).toBe('Recuperata'));
    expect(mocks.sendMessage).toHaveBeenCalledTimes(2);
  });

  it.each([true, false])(
    'test_copyTranslation_clipboardSuccess_%s_showsFeedback',
    async (success) => {
      vi.useFakeTimers();
      const writeText = vi.fn();
      if (success) writeText.mockResolvedValue();
      else writeText.mockRejectedValue(new Error('Clipboard denied'));
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      mocks.storage.getCachedTranslation.mockResolvedValue({ translation: 'Da copiare' });
      await translateArticle();
      const button = document.getElementById('copyTranslationBtn');
      button.click();
      await vi.waitFor(() => expect(button.textContent).toBe(success ? '✓' : '✗'));
      expect(writeText).toHaveBeenCalledWith('Da copiare');
      await vi.advanceTimersByTimeAsync(2000);
      expect(button.textContent).toBe('📋');
    },
  );

  it('test_retranslate_confirmed_clearsCacheAndRendersFreshTranslation', async () => {
    mocks.storage.getCachedTranslation.mockResolvedValueOnce({ translation: 'Vecchia' });
    await translateArticle();
    mocks.confirm.mockResolvedValue(true);
    mocks.storage.clearTranslationCacheEntry.mockResolvedValue();
    mocks.sendMessage.mockResolvedValue({ success: true, result: { translation: 'Nuova' } });
    document.getElementById('retranslateBtn').click();
    await vi.waitFor(() => expect(getCurrentTranslation()).toBe('Nuova'));
    expect(mocks.storage.clearTranslationCacheEntry).toHaveBeenCalledWith(
      'https://example.org/article',
      'groq',
      'it',
    );
    expect(elements.translationContent.querySelector('.translation-text').textContent).toBe(
      'Nuova',
    );
  });
});

it('test_citationsAccessors_roundTripData', () => {
  setCurrentCitations({ citations: [{ author: 'Ada' }] });
  expect(getCurrentCitations()).toEqual({ citations: [{ author: 'Ada' }] });
});
