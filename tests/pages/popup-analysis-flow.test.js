import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import itMessages from '../../src/utils/i18n/locales/it.json';

const mocks = vi.hoisted(() => ({
  storage: { getSettings: vi.fn() },
  history: { getHistory: vi.fn(), saveSummary: vi.fn() },
  classifier: { classifyArticle: vi.fn() },
  addTTSButtons: vi.fn(),
  tabsQuery: vi.fn(),
  tabsSendMessage: vi.fn(),
  runtimeSendMessage: vi.fn(),
}));
vi.mock('../../src/utils/storage/storage-manager.js', () => ({ StorageManager: mocks.storage }));
vi.mock('../../src/utils/storage/history-manager.js', () => ({ HistoryManager: mocks.history }));
vi.mock('../../src/utils/ai/content-classifier.js', () => ({
  ContentClassifier: mocks.classifier,
}));
vi.mock('../../src/utils/core/toast.js', () => ({ Toast: { show: vi.fn() } }));
vi.mock('../../src/utils/core/modal.js', () => ({ Modal: {} }));
vi.mock('../../src/pages/popup/voice.js', () => ({
  addTTSButtons: mocks.addTTSButtons,
  createTTSButton: vi.fn(),
}));
vi.mock('../../src/utils/voice/voice-controller.js', () => ({
  VoiceController: { mapLanguageCode: () => 'it-IT' },
}));
vi.mock('../../src/utils/core/logger.js', () => ({
  Logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { ErrorHandler } from '../../src/utils/core/error-handler.js';
import { I18n } from '../../src/utils/i18n/i18n.js';
import { state, elements, initElements } from '../../src/pages/popup/state.js';
import { analyzeArticle, generateSummary } from '../../src/pages/popup/analysis.js';

const ARTICLE_URL = 'https://example.org/post';
const KEY_POINTS = [
  { title: 'Primo punto', description: 'Descrizione uno', paragraphs: 2 },
  { title: 'Secondo <b>punto</b>', description: 'Descrizione due', paragraphs: 5 },
];
const SUMMARY_RESULT = { summary: 'Riassunto <script>x</script> finale', keyPoints: KEY_POINTS };

function makeTracker() {
  return { start: vi.fn(), setStep: vi.fn(), complete: vi.fn(), hide: vi.fn() };
}

function extractedArticle() {
  return {
    title: 'Titolo articolo',
    content: 'Testo dell articolo',
    wordCount: 1200,
    readingTimeMinutes: 6,
  };
}

// Runs the whole flow, advancing the fake timers (300/800/1200/200/100 ms delays)
async function runFlow(fn) {
  const promise = fn();
  await vi.runAllTimersAsync();
  await promise;
  await vi.runAllTimersAsync();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  I18n.currentLanguage = 'it';
  document.body.innerHTML = `
    <div id="setupState" class="hidden"></div>
    <div id="initialState"></div>
    <div id="loadingState" class="hidden"><div id="loadingText"></div></div>
    <div id="errorState" class="hidden">
      <div id="errorBox" class="error-box"><h2 id="errorTitle"></h2><p id="errorMessage"></p></div>
      <button id="errorConfigureBtn"></button><button id="errorOtherProviderBtn"></button>
      <button id="errorPdfBtn"></button><button id="retryBtn"></button>
    </div>
    <div id="resultsState" class="hidden">
      <div id="articleInfo"><h3 id="articleTitle"></h3><div id="articleStats"></div></div>
      <div id="summaryContent"></div><div id="keypointsContent"></div>
    </div>
    <select id="providerSelect"><option value="groq">Groq</option><option value="openai">OpenAI</option></select>
    <select id="contentTypeSelect"><option value="auto">auto</option><option value="news">news</option><option value="scientific">scientific</option></select>`;
  initElements();
  elements.providerSelect.value = 'groq';
  Object.assign(state, {
    currentArticle: null,
    currentResults: null,
    selectedLanguage: 'it',
    selectedContentType: 'auto',
    currentQA: [],
    progressTracker: makeTracker(),
    configuredProviders: ['groq'],
  });
  mocks.tabsQuery.mockResolvedValue([{ id: 7, url: ARTICLE_URL }]);
  mocks.tabsSendMessage.mockResolvedValue({ success: true, article: extractedArticle() });
  mocks.storage.getSettings.mockResolvedValue({ selectedProvider: 'groq' });
  mocks.history.getHistory.mockResolvedValue([]);
  mocks.history.saveSummary.mockResolvedValue();
  mocks.classifier.classifyArticle.mockResolvedValue({ category: 'news' });
  mocks.runtimeSendMessage.mockResolvedValue({ success: true, result: { ...SUMMARY_RESULT } });
  vi.stubGlobal('browser', {
    tabs: { query: mocks.tabsQuery, sendMessage: mocks.tabsSendMessage },
    runtime: { sendMessage: mocks.runtimeSendMessage },
  });
  vi.spyOn(ErrorHandler, 'logError').mockResolvedValue();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('analyzeArticle - extraction errors', () => {
  it('test_analyzeArticle_unsupportedUrl_showsUnsupportedPageError', async () => {
    mocks.tabsQuery.mockResolvedValue([{ id: 7, url: 'about:preferences' }]);

    await runFlow(analyzeArticle);

    expect(elements.errorTitle.textContent).toBe(itMessages['error.title.unsupported']);
    expect(elements.errorMessage.textContent).toBe(itMessages['error.unsupportedDetail']);
    expect(elements.errorState.classList.contains('hidden')).toBe(false);
    expect(elements.loadingState.classList.contains('hidden')).toBe(true);
    expect(elements.errorPdfBtn.classList.contains('hidden')).toBe(false);
    expect(mocks.tabsSendMessage).not.toHaveBeenCalled();
    expect(mocks.runtimeSendMessage).not.toHaveBeenCalled();
  });

  it('test_analyzeArticle_httpUrl_isUnsupported', async () => {
    mocks.tabsQuery.mockResolvedValue([{ id: 7, url: 'http://example.org/post' }]);

    await runFlow(analyzeArticle);

    expect(elements.errorTitle.textContent).toBe(itMessages['error.title.unsupported']);
    expect(mocks.tabsSendMessage).not.toHaveBeenCalled();
  });

  it('test_analyzeArticle_receivingEndMissing_showsPageUnreachableError', async () => {
    mocks.tabsSendMessage.mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.'),
    );

    await runFlow(analyzeArticle);

    expect(elements.errorTitle.textContent).toBe(itMessages['error.title.unreachable']);
    expect(elements.errorMessage.textContent).toBe(itMessages['error.unreachableDetail']);
    expect(document.getElementById('errorBox').dataset.kind).toBe('page_unreachable');
    expect(ErrorHandler.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Impossibile comunicare con la pagina. Ricarica la pagina (F5) e riprova.',
      }),
      'Analisi articolo',
    );
    expect(mocks.runtimeSendMessage).not.toHaveBeenCalled();
  });

  it('test_analyzeArticle_missingContentScriptResponse_showsDefaultExtractionError', async () => {
    mocks.tabsSendMessage.mockResolvedValue(undefined);

    await runFlow(analyzeArticle);

    expect(elements.errorTitle.textContent).toBe(itMessages['error.title.generic']);
    expect(ErrorHandler.logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Errore durante l'estrazione" }),
      'Analisi articolo',
    );
    expect(mocks.runtimeSendMessage).not.toHaveBeenCalled();
  });

  it('test_analyzeArticle_contentScriptFailure_showsItsErrorMessage', async () => {
    mocks.tabsSendMessage.mockResolvedValue({ success: false, error: 'Article too short' });

    await runFlow(analyzeArticle);

    expect(elements.errorMessage.textContent).toBe(
      'Articolo troppo breve per essere riassunto (minimo 200 parole).',
    );
    expect(mocks.runtimeSendMessage).not.toHaveBeenCalled();
  });
});

describe('analyzeArticle - content type resolution', () => {
  it('test_analyzeArticle_urlAlreadyInHistory_reusesSavedTypeWithoutClassifying', async () => {
    mocks.history.getHistory.mockResolvedValue([
      { article: { url: 'https://other.org/x' }, metadata: { contentType: 'news' } },
      { article: { url: ARTICLE_URL }, metadata: { contentType: 'scientific' } },
    ]);

    await runFlow(analyzeArticle);

    expect(mocks.classifier.classifyArticle).not.toHaveBeenCalled();
    expect(state.selectedContentType).toBe('scientific');
    expect(elements.contentTypeSelect.value).toBe('scientific');
    const sent = mocks.runtimeSendMessage.mock.calls[0][0];
    expect(sent.settings.contentType).toBe('scientific');
    expect(state.currentResults.contentTypeMethod).toBe('manual');
  });

  it('test_analyzeArticle_noHistoryEntry_classifiesAutomatically', async () => {
    await runFlow(analyzeArticle);

    expect(mocks.classifier.classifyArticle).toHaveBeenCalledTimes(1);
    expect(mocks.classifier.classifyArticle.mock.calls[0][1]).toBe('auto');
    expect(mocks.runtimeSendMessage.mock.calls[0][0].settings.contentType).toBe('news');
    expect(state.currentResults.contentTypeMethod).toBe('auto');
  });

  it('test_generateSummary_classifierThrows_fallsBackToGeneral', async () => {
    state.currentArticle = { ...extractedArticle(), url: ARTICLE_URL };
    mocks.classifier.classifyArticle.mockRejectedValue(new Error('classifier down'));

    await runFlow(generateSummary);

    expect(mocks.runtimeSendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.runtimeSendMessage.mock.calls[0][0].settings.contentType).toBe('general');
    expect(ErrorHandler.logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'classifier down' }),
      'Classificazione contenuto',
    );
    // The summary is still shown despite the classifier failure
    expect(elements.resultsState.classList.contains('hidden')).toBe(false);
    expect(state.currentResults.detectedContentType).toBe('general');
  });
});

describe('analyzeArticle - successful flow', () => {
  it('test_analyzeArticle_success_sendsRequestWithProviderLanguageAndArticle', async () => {
    state.selectedLanguage = 'en';

    await runFlow(analyzeArticle);

    expect(mocks.tabsSendMessage).toHaveBeenCalledWith(7, { action: 'extractArticle' });
    expect(mocks.runtimeSendMessage).toHaveBeenCalledTimes(1);
    const sent = mocks.runtimeSendMessage.mock.calls[0][0];
    expect(sent.action).toBe('generateSummary');
    expect(sent.provider).toBe('groq');
    expect(sent.article.url).toBe(ARTICLE_URL);
    expect(sent.article.title).toBe('Titolo articolo');
    expect(sent.settings.outputLanguage).toBe('en');
    expect(sent.settings.summaryLength).toBe('detailed');
  });

  it('test_analyzeArticle_success_truncatesContentOver50000Characters', async () => {
    mocks.tabsSendMessage.mockResolvedValue({
      success: true,
      article: { ...extractedArticle(), content: 'a'.repeat(60000) },
    });

    await runFlow(analyzeArticle);

    expect(mocks.runtimeSendMessage.mock.calls[0][0].article.content).toHaveLength(50000);
  });

  it('test_analyzeArticle_success_rendersSummaryKeyPointsAndEscapesHtml', async () => {
    await runFlow(analyzeArticle);

    expect(elements.resultsState.classList.contains('hidden')).toBe(false);
    expect(elements.loadingState.classList.contains('hidden')).toBe(true);
    expect(elements.articleTitle.textContent).toBe('Titolo articolo');
    expect(elements.summaryContent.querySelector('p').textContent).toBe(
      'Riassunto <script>x</script> finale',
    );
    expect(elements.summaryContent.querySelector('script')).toBeNull();
    const titles = [...elements.keypointsContent.querySelectorAll('.keypoint-title')].map(
      (el) => el.textContent,
    );
    expect(titles).toEqual(['1. Primo punto', '2. Secondo <b>punto</b>']);
    expect(elements.keypointsContent.querySelector('b')).toBeNull();
    const refs = [...elements.keypointsContent.querySelectorAll('.keypoint')].map(
      (el) => el.dataset.paragraph,
    );
    expect(refs).toEqual(['2', '5']);
    expect(elements.articleStats.textContent).toContain('1200 parole');
    expect(elements.articleStats.textContent).toContain('6 min di lettura');
    expect(state.progressTracker.complete).toHaveBeenCalledTimes(1);
    expect(mocks.addTTSButtons).toHaveBeenCalledTimes(1);
  });

  it('test_analyzeArticle_success_savesHistoryWithExpectedMetadata', async () => {
    state.selectedLanguage = 'en';

    await runFlow(analyzeArticle);

    expect(mocks.history.saveSummary).toHaveBeenCalledTimes(1);
    const [article, summary, keyPoints, metadata] = mocks.history.saveSummary.mock.calls[0];
    expect(article.url).toBe(ARTICLE_URL);
    expect(summary).toBe('Riassunto <script>x</script> finale');
    expect(keyPoints).toEqual(KEY_POINTS);
    expect(metadata).toEqual({
      provider: 'groq',
      language: 'en',
      contentType: 'news',
      contentTypeMethod: 'auto',
      fromCache: false,
    });
  });

  it('test_analyzeArticle_cachedResult_showsCacheBadge', async () => {
    mocks.runtimeSendMessage.mockResolvedValue({
      success: true,
      result: { ...SUMMARY_RESULT, fromCache: true },
    });

    await runFlow(analyzeArticle);

    expect(elements.summaryContent.querySelector('.cache-badge').textContent).toBe(
      itMessages['results.fromCache'],
    );
    expect(mocks.history.saveSummary.mock.calls[0][3].fromCache).toBe(true);
  });

  it('test_analyzeArticle_historySaveFails_stillShowsResults', async () => {
    mocks.history.saveSummary.mockRejectedValue(new Error('quota exceeded'));

    await runFlow(analyzeArticle);

    expect(elements.resultsState.classList.contains('hidden')).toBe(false);
    expect(ErrorHandler.logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'quota exceeded' }),
      'displayResults.saveHistory',
    );
  });
});

describe('generateSummary - service failures', () => {
  it('test_generateSummary_noArticle_showsNoArticleError', async () => {
    state.currentArticle = null;

    await runFlow(generateSummary);

    expect(elements.errorMessage.textContent).toBe(
      'Nessun articolo rilevato in questa pagina. Prova con un articolo di blog o news.',
    );
    expect(mocks.runtimeSendMessage).not.toHaveBeenCalled();
  });

  it('test_generateSummary_serviceReturnsFailure_showsMappedErrorAndSavesNothing', async () => {
    mocks.runtimeSendMessage.mockResolvedValue({
      success: false,
      error: '503 Service Unavailable',
    });

    await runFlow(analyzeArticle);

    expect(elements.errorState.classList.contains('hidden')).toBe(false);
    expect(elements.errorTitle.textContent).toBe(itMessages['error.title.generic']);
    expect(elements.errorMessage.textContent).toBe(
      'Servizio temporaneamente non disponibile. Riprova più tardi.',
    );
    expect(ErrorHandler.logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: '503 Service Unavailable' }),
      'Generazione riassunto',
    );
    expect(elements.resultsState.classList.contains('hidden')).toBe(true);
    expect(state.progressTracker.hide).toHaveBeenCalledTimes(1);
    expect(state.progressTracker.complete).not.toHaveBeenCalled();
    expect(mocks.history.saveSummary).not.toHaveBeenCalled();
  });

  it('test_generateSummary_serviceSilent_showsServiceNotRespondingMessage', async () => {
    mocks.runtimeSendMessage.mockResolvedValue(undefined);

    await runFlow(analyzeArticle);

    expect(ErrorHandler.logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Il servizio non risponde. Riapri il popup e riprova.' }),
      'Generazione riassunto',
    );
    expect(elements.errorState.classList.contains('hidden')).toBe(false);
    expect(mocks.history.saveSummary).not.toHaveBeenCalled();
  });

  it('test_generateSummary_missingApiKey_showsMissingKeyActions', async () => {
    mocks.runtimeSendMessage.mockResolvedValue({
      success: false,
      error: 'API key non configurata per groq',
    });

    await runFlow(analyzeArticle);

    expect(elements.errorTitle.textContent).toBe('Manca la chiave per Groq');
    expect(elements.errorConfigureBtn.classList.contains('hidden')).toBe(false);
  });
});
