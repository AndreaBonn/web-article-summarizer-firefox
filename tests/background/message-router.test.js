import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMessageListener } from '../../src/background/message-router.js';

vi.mock('../../src/utils/core/error-handler.js', () => ({
  ErrorHandler: { getErrorMessage: (error) => error.message },
}));
vi.mock('../../src/utils/core/logger.js', () => ({ Logger: { error: vi.fn() } }));

const actions = [
  ['generateSummary', 'handleGenerateSummary', 'Errore generazione:'],
  ['extractCitations', 'handleExtractCitations', 'Errore estrazione citazioni:'],
  ['testApiKey', 'testApiKey', 'Errore test API:'],
  ['translateArticle', 'handleTranslateArticle', 'Errore traduzione:'],
  ['askQuestion', 'handleAskQuestion', 'Errore Q&A:'],
  ['translatePDF', 'handleTranslatePDF', 'Errore traduzione PDF:'],
  ['extractPDFCitations', 'handleExtractPDFCitations', 'Errore citazioni PDF:'],
  ['askPDFQuestion', 'handleAskPDFQuestion', 'Errore Q&A PDF:'],
];
const sender = { id: 'extension-id' };

function setup() {
  const handlers = Object.fromEntries(
    actions.map(([, name]) => [name, vi.fn().mockResolvedValue('Result')]),
  );
  return { handlers, listener: createMessageListener(handlers), sendResponse: vi.fn() };
}

describe('message router', () => {
  beforeEach(() => vi.stubGlobal('browser', { runtime: { id: sender.id } }));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('test_createMessageListener_foreignSender_ignoresMessage', async () => {
    const { listener, handlers, sendResponse } = setup();
    const request = { action: 'generateSummary', provider: 'groq' };
    expect(listener(request, { id: 'foreign' }, sendResponse)).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
    expect(handlers.handleGenerateSummary).not.toHaveBeenCalled();
    expect(listener(request, sender, sendResponse)).toBe(true);
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ success: true, result: 'Result' }),
    );
    expect(handlers.handleGenerateSummary).toHaveBeenCalledOnce();
  });

  it.each([
    'unknown',
    'toString',
    '__proto__',
    undefined,
    ['generateSummary'],
    { toString: () => 'testApiKey' },
  ])('test_createMessageListener_unknownAction_%s_returnsFalse', async (action) => {
    const { listener, sendResponse } = setup();
    expect(listener({ action }, sender, sendResponse)).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
    expect(listener({ action: 'testApiKey', provider: 'groq' }, sender, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ success: true }));
  });

  it.each(actions.slice(0, 3))(
    'test_createMessageListener_%s_invalidProvider_returnsFalseSynchronously',
    (action, name) => {
      const { listener, handlers, sendResponse } = setup();
      expect(listener({ action, provider: 'foo' }, sender, sendResponse)).toBe(false);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Provider non valido: foo',
      });
      expect(handlers[name]).not.toHaveBeenCalled();
      expect(listener({ action, provider: 'groq' }, sender, sendResponse)).toBe(true);
      expect(handlers[name]).toHaveBeenCalledOnce();
    },
  );

  it.each(actions)(
    'test_createMessageListener_%s_success_keepsChannelOpenAndResponds',
    async (action, name) => {
      const { listener, handlers, sendResponse } = setup();
      const request = {
        action,
        provider: 'groq',
        article: { content: 'Text' },
        settings: { tone: 'neutral' },
        apiKey: 'secret',
      };
      expect(listener(request, sender, sendResponse)).toBe(true);
      expect(sendResponse).not.toHaveBeenCalled();
      const args =
        action === 'testApiKey'
          ? ['groq', 'secret']
          : ['generateSummary', 'extractCitations'].includes(action)
            ? [request.article, 'groq', request.settings]
            : [request];
      expect(handlers[name]).toHaveBeenCalledWith(...args);
      await vi.waitFor(() =>
        expect(sendResponse).toHaveBeenCalledWith(
          action === 'testApiKey' ? { success: true } : { success: true, result: 'Result' },
        ),
      );
    },
  );

  it.each(actions)(
    'test_createMessageListener_%s_rejection_returnsErrorAsynchronously',
    async (action, name, label) => {
      const { Logger } = await import('../../src/utils/core/logger.js');
      const { listener, handlers, sendResponse } = setup();
      const error = new Error('Provider failed');
      handlers[name].mockRejectedValue(error);
      expect(listener({ action, provider: 'groq' }, sender, sendResponse)).toBe(true);
      expect(sendResponse).not.toHaveBeenCalled();
      await vi.waitFor(() =>
        expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'Provider failed' }),
      );
      expect(Logger.error).toHaveBeenCalledWith(label, error);
    },
  );

  it.each(actions.slice(3))(
    'test_createMessageListener_%s_invalidProvider_isHandledAsynchronously',
    async (action, name) => {
      const { listener, handlers, sendResponse } = setup();
      handlers[name].mockImplementation(async (request) => {
        const { validateProvider } = await import('../../src/background/message-handlers.js');
        validateProvider(request.provider);
      });
      expect(listener({ action, provider: 'foo' }, sender, sendResponse)).toBe(true);
      expect(sendResponse).not.toHaveBeenCalled();
      await vi.waitFor(() =>
        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'Provider non valido: foo',
        }),
      );
    },
  );
});

describe('generateCompletion routing', () => {
  const EXTENSION_ROOT = 'moz-extension://uuid/';
  const request = { action: 'generateCompletion', provider: 'groq', systemPrompt: 's' };

  beforeEach(() =>
    vi.stubGlobal('browser', {
      runtime: { id: sender.id, getURL: (path) => EXTENSION_ROOT + path },
    }),
  );
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function setupCompletion() {
    const handlers = { handleGenerateCompletion: vi.fn().mockResolvedValue('Completion') };
    return { handlers, listener: createMessageListener(handlers), sendResponse: vi.fn() };
  }

  it('answers a message sent by an extension page', async () => {
    const { listener, handlers, sendResponse } = setupCompletion();
    const pageSender = { ...sender, url: `${EXTENSION_ROOT}src/pages/multi-analysis/x.html` };

    expect(listener(request, pageSender, sendResponse)).toBe(true);

    expect(handlers.handleGenerateCompletion).toHaveBeenCalledWith(request);
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ success: true, result: 'Completion' }),
    );
  });

  it.each([
    ['a content script on a web page', { url: 'https://evil.example/page', tab: { id: 1 } }],
    ['a sender without url', {}],
  ])('ignores %s', (_label, extra) => {
    const { listener, handlers, sendResponse } = setupCompletion();

    expect(listener(request, { ...sender, ...extra }, sendResponse)).toBe(false);

    expect(handlers.handleGenerateCompletion).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
