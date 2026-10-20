import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as handlers from '../../src/background/message-handlers.js';
import { StorageManager } from '../../src/utils/storage/storage-manager.js';
import { CacheManager } from '../../src/utils/storage/cache-manager.js';
import { APIOrchestrator } from '../../src/utils/ai/api-orchestrator.js';
import { CitationExtractor } from '../../src/utils/ai/citation-extractor.js';
import { Translator } from '../../src/utils/core/translator.js';
import { AdvancedAnalysis } from '../../src/utils/ai/advanced-analysis.js';
import {
  translatePDFText,
  extractPDFCitations,
  askQuestionPDF,
} from '../../src/pages/reading-mode/pdf.js';
import { ErrorHandler } from '../../src/utils/core/error-handler.js';
import { Logger } from '../../src/utils/core/logger.js';
const cache = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('../../src/utils/storage/storage-manager.js', () => ({
  StorageManager: { getApiKey: vi.fn(), getSettings: vi.fn(), updateStats: vi.fn() },
}));
vi.mock('../../src/utils/storage/cache-manager.js', () => ({
  CacheManager: Object.assign(
    vi.fn(function () {
      return cache;
    }),
    { hashContent: vi.fn() },
  ),
}));
vi.mock('../../src/utils/ai/api-orchestrator.js', () => ({
  APIOrchestrator: { callAPI: vi.fn(), parseResponse: vi.fn(), generateCompletion: vi.fn() },
}));
vi.mock('../../src/utils/ai/citation-extractor.js', () => ({
  CitationExtractor: { extractCitations: vi.fn() },
}));
vi.mock('../../src/utils/core/translator.js', () => ({
  Translator: { translateArticle: vi.fn() },
}));
vi.mock('../../src/utils/ai/advanced-analysis.js', () => ({
  AdvancedAnalysis: { askQuestion: vi.fn() },
}));
vi.mock('../../src/pages/reading-mode/pdf.js', () => ({
  translatePDFText: vi.fn(),
  extractPDFCitations: vi.fn(),
  askQuestionPDF: vi.fn(),
}));
vi.mock('../../src/utils/core/error-handler.js', () => ({
  ErrorHandler: { getErrorMessage: vi.fn(), logError: vi.fn() },
}));
vi.mock('../../src/utils/core/logger.js', () => ({ Logger: { error: vi.fn() } }));
const article = { url: 'https://example.com/article', content: 'Article text', wordCount: 42 };
const settings = { summaryLength: 'short' };
const request = {
  provider: 'groq',
  article,
  settings,
  targetLanguage: 'en',
  question: 'Why?',
  summary: 'Summary',
  text: 'PDF text',
  extractedText: 'Extracted PDF',
  filename: 'paper.pdf',
};
const requestHandlers = [
  [
    'handleTranslateArticle',
    Translator.translateArticle,
    { translation: 'Translated' },
    'Translated',
  ],
  ['handleAskQuestion', AdvancedAnalysis.askQuestion, { answer: 'Answer' }, 'Answer'],
  [
    'handleTranslatePDF',
    translatePDFText,
    { translation: 'PDF translated' },
    { translation: 'PDF translated' },
  ],
  [
    'handleExtractPDFCitations',
    extractPDFCitations,
    { citations: ['Source'] },
    { citations: ['Source'] },
  ],
  ['handleAskPDFQuestion', askQuestionPDF, { answer: 'PDF answer' }, 'PDF answer'],
];
const invoke = (name) =>
  ['handleGenerateSummary', 'handleExtractCitations'].includes(name)
    ? handlers[name](article, 'groq', settings)
    : handlers[name](request);
describe('message handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    StorageManager.getApiKey.mockResolvedValue('secret');
    StorageManager.getSettings.mockResolvedValue({});
    CacheManager.mockImplementation(function () {
      return cache;
    });
    CacheManager.hashContent.mockReturnValue('content-hash');
    APIOrchestrator.callAPI.mockResolvedValue('response');
    APIOrchestrator.parseResponse.mockReturnValue({ summary: 'Summary', keyPoints: ['Point'] });
    CitationExtractor.extractCitations.mockResolvedValue(['Citation']);
    ErrorHandler.getErrorMessage.mockReturnValue('User-facing error');
    ErrorHandler.logError.mockResolvedValue();
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValue(125);
  });
  afterEach(() => vi.restoreAllMocks());
  it.each(['groq', 'openai', 'anthropic', 'gemini'])(
    'test_validateProvider_%s_acceptsProvider',
    (provider) => {
      expect(handlers.validateProvider(provider)).toBe(provider);
    },
  );
  it.each(['foo', undefined, null, ''])('test_validateProvider_%s_rejectsProvider', (provider) => {
    expect(() => handlers.validateProvider(provider)).toThrow(`Provider non valido: ${provider}`);
  });
  it.each([
    'handleGenerateSummary',
    'handleExtractCitations',
    ...requestHandlers.map(([name]) => name),
  ])('test_%s_missingKey_rejectsBeforeCallingAI', async (name) => {
    StorageManager.getApiKey.mockResolvedValue('');
    await expect(invoke(name)).rejects.toThrow('API key non configurata. Vai nelle impostazioni.');
    expect(StorageManager.getApiKey).toHaveBeenCalledWith('groq');
    expect(APIOrchestrator.callAPI).not.toHaveBeenCalled();
  });
  it('test_handleGenerateSummary_cacheHit_returnsCachedSummary', async () => {
    cache.get.mockResolvedValue({ summary: 'Cached', keyPoints: ['Cached point'] });
    expect(await invoke('handleGenerateSummary')).toEqual({
      summary: 'Cached',
      keyPoints: ['Cached point'],
      fromCache: true,
      usedProvider: 'groq',
    });
    expect(cache.get).toHaveBeenCalledWith(article.url, 'groq', settings, 'content-hash');
    expect(APIOrchestrator.callAPI).not.toHaveBeenCalled();
  });
  it.each([{}, { enableCache: false }])(
    'test_handleGenerateSummary_cacheMiss_updatesStats %j',
    async (performance) => {
      StorageManager.getSettings.mockResolvedValue(performance);
      expect(await invoke('handleGenerateSummary')).toEqual({
        summary: 'Summary',
        keyPoints: ['Point'],
        fromCache: false,
        usedProvider: 'groq',
        generationTime: 25,
      });
      expect(APIOrchestrator.callAPI).toHaveBeenCalledWith('groq', 'secret', article, settings);
      expect(StorageManager.updateStats).toHaveBeenCalledWith('groq', 42, 25);
      if (performance.enableCache === false) {
        expect(CacheManager).not.toHaveBeenCalled();
      } else {
        expect(cache.set).toHaveBeenCalledWith(
          article.url,
          'groq',
          settings,
          { summary: 'Summary', keyPoints: ['Point'] },
          null,
          'content-hash',
        );
      }
    },
  );
  it('test_handleExtractCitations_cacheHit_returnsCitations', async () => {
    cache.get.mockResolvedValue(['Cached citation']);
    expect(await invoke('handleExtractCitations')).toEqual({
      citations: ['Cached citation'],
      fromCache: true,
      usedProvider: 'groq',
    });
    expect(cache.get).toHaveBeenCalledWith(
      article.url + '_citations',
      'groq',
      { type: 'citations' },
      'content-hash',
    );
    expect(CitationExtractor.extractCitations).not.toHaveBeenCalled();
  });
  it.each([{}, { enableCache: false }])(
    'test_handleExtractCitations_cacheMiss_extractsAndStores %j',
    async (performance) => {
      StorageManager.getSettings.mockResolvedValue(performance);
      expect(await invoke('handleExtractCitations')).toEqual({
        citations: ['Citation'],
        fromCache: false,
        usedProvider: 'groq',
        extractionTime: 25,
      });
      expect(CitationExtractor.extractCitations).toHaveBeenCalledWith(
        article,
        'groq',
        'secret',
        settings,
      );
      if (performance.enableCache === false) {
        expect(CacheManager).not.toHaveBeenCalled();
      } else {
        expect(cache.set).toHaveBeenCalledWith(
          article.url + '_citations',
          'groq',
          { type: 'citations' },
          ['Citation'],
          null,
          'content-hash',
        );
      }
    },
  );
  it.each(requestHandlers)(
    'test_%s_success_returnsResult',
    async (name, boundary, expected, response) => {
      boundary.mockResolvedValue(response);
      expect(await invoke(name)).toEqual(expected);
      const args = {
        handleTranslateArticle: [article, 'en', 'groq', 'secret', null],
        handleAskQuestion: ['Why?', article, 'Summary', 'groq', 'secret', settings],
        handleTranslatePDF: ['PDF text', 'en', 'groq', 'secret', false],
        handleExtractPDFCitations: ['PDF text', 'paper.pdf', 'groq', 'secret'],
        handleAskPDFQuestion: ['Why?', 'Extracted PDF', 'Summary', 'groq', 'secret'],
      };
      expect(boundary).toHaveBeenCalledWith(...args[name]);
    },
  );
  it.each(requestHandlers)('test_%s_invalidProvider_rejectsBeforeKeyLookup', async (name) => {
    await expect(handlers[name]({ ...request, provider: 'foo' })).rejects.toThrow(
      'Provider non valido: foo',
    );
    expect(StorageManager.getApiKey).not.toHaveBeenCalled();
  });
  it('test_requestHandlers_optionalValues_preservesSuppliedAndDefaultArguments', async () => {
    await handlers.handleTranslateArticle({ ...request, contentType: 'news' });
    expect(Translator.translateArticle).toHaveBeenCalledWith(
      article,
      'en',
      'groq',
      'secret',
      'news',
    );
    await handlers.handleTranslatePDF({ ...request, forceTranslate: true });
    expect(translatePDFText).toHaveBeenCalledWith('PDF text', 'en', 'groq', 'secret', true);
    await handlers.handleAskQuestion({ ...request, settings: undefined });
    expect(AdvancedAnalysis.askQuestion).toHaveBeenCalledWith(
      'Why?',
      article,
      'Summary',
      'groq',
      'secret',
      {},
    );
  });
  it.each([
    ['handleGenerateSummary', APIOrchestrator.callAPI],
    ['handleExtractCitations', CitationExtractor.extractCitations],
    ...requestHandlers,
  ])('test_%s_boundaryFailure_preservesCauseAndLogsContext', async (name, boundary) => {
    const error = new Error('Technical failure');
    boundary.mockRejectedValue(error);
    await expect(invoke(name)).rejects.toMatchObject({
      message: 'User-facing error',
      cause: error,
    });
    expect(ErrorHandler.getErrorMessage).toHaveBeenCalledWith(error);
    expect(ErrorHandler.logError).toHaveBeenCalledWith(error, name);
    expect(ErrorHandler.getErrorMessage.mock.invocationCallOrder[0]).toBeLessThan(
      ErrorHandler.logError.mock.invocationCallOrder[0],
    );
    if (name === 'handleGenerateSummary' || name === 'handleExtractCitations') {
      expect(Logger.error).toHaveBeenCalledWith(
        name === 'handleGenerateSummary'
          ? 'Errore generazione riassunto:'
          : 'Errore estrazione citazioni:',
        error,
      );
      expect(Logger.error.mock.invocationCallOrder[0]).toBeLessThan(
        ErrorHandler.getErrorMessage.mock.invocationCallOrder[0],
      );
    }
  });
  it('test_testApiKey_success_sendsConnectivityProbe', async () => {
    expect(await handlers.testApiKey('openai', 'probe-key')).toBe(true);
    expect(APIOrchestrator.callAPI).toHaveBeenCalledWith(
      'openai',
      'probe-key',
      {
        title: 'Test Article',
        paragraphs: [{ id: 1, text: 'This is a test paragraph to verify API connectivity.' }],
        wordCount: 10,
        readingTimeMinutes: 1,
        content: 'This is a test paragraph to verify API connectivity.',
      },
      { summaryLength: 'short', tone: 'neutral', autoDetectLanguage: true },
    );
  });
  it('test_testApiKey_failure_preservesCauseAndPrefix', async () => {
    const error = new Error('Unauthorized');
    APIOrchestrator.callAPI.mockRejectedValue(error);
    await expect(handlers.testApiKey('groq', 'bad')).rejects.toMatchObject({
      message: 'Test fallito: Unauthorized',
      cause: error,
    });
  });
  it('test_handleGenerateCompletion_decryptsKeyInWorker_forwardsOnlyKnownOptions', async () => {
    APIOrchestrator.generateCompletion.mockResolvedValue('answer');

    const result = await handlers.handleGenerateCompletion({
      provider: 'openai',
      systemPrompt: 'sys',
      userPrompt: 'user',
      options: { temperature: 0.1, maxTokens: 500, responseFormat: 'json', model: 'x' },
    });

    expect(result).toBe('answer');
    expect(StorageManager.getApiKey).toHaveBeenCalledWith('openai');
    expect(APIOrchestrator.generateCompletion).toHaveBeenCalledWith(
      'openai',
      'secret',
      'sys',
      'user',
      {
        temperature: 0.1,
        maxTokens: 500,
        responseFormat: 'json',
      },
    );
  });
  it('test_handleGenerateCompletion_noOptions_usesProviderDefaults', async () => {
    await handlers.handleGenerateCompletion({
      provider: 'groq',
      systemPrompt: 's',
      userPrompt: 'u',
    });
    expect(APIOrchestrator.generateCompletion).toHaveBeenCalledWith('groq', 'secret', 's', 'u', {});
  });
  it('test_handleGenerateCompletion_missingKey_rejectsWithoutCalling', async () => {
    StorageManager.getApiKey.mockResolvedValue(null);
    await expect(
      handlers.handleGenerateCompletion({ provider: 'groq', systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toThrow('API key non configurata');
    expect(APIOrchestrator.generateCompletion).not.toHaveBeenCalled();
  });
  it.each([
    [{ provider: 'evil', systemPrompt: 's', userPrompt: 'u' }, 'Provider non valido'],
    [{ provider: 'groq', systemPrompt: 's', userPrompt: 42 }, 'Prompt non valido'],
  ])('test_handleGenerateCompletion_invalidRequest_rejects %#', async (request, message) => {
    await expect(handlers.handleGenerateCompletion(request)).rejects.toThrow(message);
    expect(StorageManager.getApiKey).not.toHaveBeenCalled();
  });
  it('test_handleGenerateCompletion_providerError_isUserFacing', async () => {
    APIOrchestrator.generateCompletion.mockRejectedValue(new Error('HTTP 500'));
    await expect(
      handlers.handleGenerateCompletion({ provider: 'groq', systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toThrow('User-facing error');
  });
});
