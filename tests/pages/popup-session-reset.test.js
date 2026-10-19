import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getCachedTranslation: vi.fn(),
  sendMessage: vi.fn(),
  updateCitations: vi.fn(),
}));
vi.mock('../../src/utils/storage/storage-manager.js', () => ({
  StorageManager: {
    getSettings: mocks.getSettings,
    getCachedTranslation: mocks.getCachedTranslation,
  },
}));
vi.mock('../../src/utils/storage/history-manager.js', () => ({
  HistoryManager: { updateSummaryWithCitations: mocks.updateCitations },
}));
vi.mock('../../src/pages/popup/voice.js', () => ({ createTTSButton: vi.fn() }));
vi.mock('../../src/utils/voice/voice-controller.js', () => ({ VoiceController: {} }));
vi.mock('../../src/utils/core/logger.js', () => ({
  Logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));
import { state, elements, initElements } from '../../src/pages/popup/state.js';
import {
  translationState,
  citationsState,
  setCurrentTranslation,
  setCurrentCitations,
} from '../../src/pages/popup/features.js';
import { extractCitations } from '../../src/pages/popup/citations.js';
import { resetArticleSession } from '../../src/pages/popup/session-reset.js';
import { I18n } from '../../src/utils/i18n/i18n.js';
import enMessages from '../../src/utils/i18n/locales/en.json';

const CITATIONS = {
  total_citations: 1,
  citations: [{ id: 1, quote_text: 'Old quote', paragraph: '2' }],
};

beforeEach(() => {
  vi.resetAllMocks();
  document.body.innerHTML = `
    <div id="setupState"></div><div id="initialState" class="hidden"></div>
    <div id="loadingState"></div><div id="resultsState"></div>
    <div id="errorState"></div><div id="articleInfo"></div>
    <h2 id="errorTitle"></h2><p id="errorMessage"></p>
    <button id="errorConfigureBtn"></button><button id="errorOtherProviderBtn"></button>
    <button id="errorPdfBtn"></button><button id="retryBtn"></button>
    <select id="contentTypeSelect"><option value="auto">auto</option><option value="news">news</option></select>
    <select id="providerSelect"><option value="groq">Groq</option></select>
    <div id="qaAnswer" class="qa-answer">Old answer</div>
    <div id="translationContent"><div class="translation-empty">
      <button id="translateBtn">Traduci Articolo</button></div></div>
    <div id="citationsTab" class="tab-pane">
      <div id="citationsContent"><div class="citations-empty">
        <button id="extractCitationsBtn">Estrai Citazioni</button></div></div>
    </div>`;
  initElements();
  Object.assign(state, {
    currentArticle: { url: 'https://example.org/a', title: 'A' },
    currentResults: { summary: 'S' },
    currentQA: [{ question: 'q', answer: 'a' }],
    selectedContentType: 'news',
  });
  vi.stubGlobal('browser', { runtime: { sendMessage: mocks.sendMessage } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  setCurrentTranslation(null);
  setCurrentCitations(null);
  document.body.replaceChildren();
});

describe('resetArticleSession', () => {
  it('test_reset_withTranslationAndCitations_dropsThemSoNewArticleDoesNotInheritThem', () => {
    setCurrentTranslation('Vecchia traduzione');
    setCurrentCitations(CITATIONS);
    elements.translationContent.innerHTML =
      '<div class="translation-header">Vecchia traduzione</div>';
    elements.citationsContent.innerHTML = '<div class="citations-list">Old quote</div>';
    const badge = document.createElement('span');
    badge.className = 'cache-badge';
    document.getElementById('citationsTab').appendChild(badge);

    resetArticleSession();

    expect(translationState.value).toBeNull();
    expect(citationsState.value).toBeNull();
    expect(elements.translationContent.textContent).not.toContain('Vecchia traduzione');
    expect(elements.translationContent.querySelector('#translateBtn')).not.toBeNull();
    expect(elements.citationsContent.textContent).not.toContain('Old quote');
    expect(elements.citationsContent.querySelector('#extractCitationsBtn')).not.toBeNull();
    expect(document.querySelector('.cache-badge')).toBeNull();
    expect(elements.qaAnswer.textContent).toBe('');
    expect(elements.qaAnswer.classList.contains('hidden')).toBe(true);
    expect(state.currentArticle).toBeNull();
    expect(state.currentResults).toBeNull();
    expect(state.currentQA).toEqual([]);
    expect(state.selectedContentType).toBe('auto');
    expect(elements.contentTypeSelect.value).toBe('auto');
    expect(elements.initialState.classList.contains('hidden')).toBe(false);
  });

  it('test_reset_restoredCitationsButton_extractsAgainOnClick', async () => {
    resetArticleSession();
    Object.assign(state, { currentArticle: { url: 'https://example.org/b' }, currentResults: {} });
    mocks.getSettings.mockResolvedValue({});
    mocks.sendMessage.mockResolvedValue({ success: true, result: { citations: CITATIONS } });
    elements.extractCitationsBtn.click();
    await vi.waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledTimes(1));
    expect(mocks.sendMessage.mock.calls[0][0].action).toBe('extractCitations');
  });

  it('test_reset_englishUi_restoresPanelsInTheUiLanguage', () => {
    const previousLanguage = I18n.currentLanguage;
    I18n.currentLanguage = 'en';
    try {
      resetArticleSession();
      expect(elements.translationContent.querySelector('p').textContent).toBe(
        enMessages['translation.empty'],
      );
      expect(elements.translateBtn.textContent.trim()).toBe(enMessages['translation.button']);
      expect(elements.citationsContent.querySelector('p').textContent).toBe(
        enMessages['citations.empty'],
      );
      expect(elements.extractCitationsBtn.textContent.trim()).toBe(enMessages['citations.button']);
    } finally {
      I18n.currentLanguage = previousLanguage;
    }
  });
});

describe('extractCitations cache badge', () => {
  it('test_extractCitations_fromCache_addsBadgeToCitationsTab', async () => {
    mocks.getSettings.mockResolvedValue({});
    mocks.sendMessage.mockResolvedValue({
      success: true,
      result: { citations: CITATIONS, fromCache: true },
    });
    await extractCitations();
    expect(document.querySelectorAll('#citationsTab .cache-badge')).toHaveLength(1);
    expect(document.querySelector('#citationsTab .cache-badge').textContent).toBe('Da cache');
  });
});
