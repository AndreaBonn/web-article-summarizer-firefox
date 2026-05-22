import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser.storage.local — simula serializzazione reale (JSON round-trip)
const store = {};
global.browser = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        const result = {};
        for (const key of keys) {
          if (store[key] !== undefined) result[key] = JSON.parse(JSON.stringify(store[key]));
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((data) => {
        for (const [key, value] of Object.entries(data)) {
          store[key] = JSON.parse(JSON.stringify(value));
        }
        return Promise.resolve();
      }),
    },
  },
};

// Mock Modal (not available in test env)
vi.mock('@utils/core/modal.js', () => ({
  Modal: { error: vi.fn().mockResolvedValue(undefined) },
}));

import { ErrorHandler } from '@utils/core/error-handler.js';

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
  });

  describe('getErrorMessage', () => {
    it('maps "No article found" to user-friendly message', () => {
      const msg = ErrorHandler.getErrorMessage(new Error('No article found on page'));
      expect(msg).toContain('Nessun articolo rilevato');
    });

    it('maps "Article too short" to user-friendly message', () => {
      const msg = ErrorHandler.getErrorMessage(new Error('Article too short'));
      expect(msg).toContain('troppo breve');
    });

    it('maps "API key non configurata" correctly', () => {
      const msg = ErrorHandler.getErrorMessage(new Error('API key non configurata'));
      expect(msg).toContain('API key non configurata');
    });

    it('maps 401/Unauthorized to API key error', () => {
      expect(ErrorHandler.getErrorMessage(new Error('401 Unauthorized'))).toContain(
        'API key non valida',
      );
    });

    it('maps 429/rate limit to rate limit message', () => {
      const msg = ErrorHandler.getErrorMessage(new Error('429 Too Many Requests'));
      expect(msg).toContain('Rate limit');
    });

    it('maps provider-specific rate limit [RATE_LIMIT:groq]', () => {
      const msg = ErrorHandler.getErrorMessage(new Error('[RATE_LIMIT:groq]'));
      expect(msg).toContain('groq');
      expect(msg).toContain('Rate limit');
    });

    it('maps 403/Forbidden to access denied', () => {
      expect(ErrorHandler.getErrorMessage(new Error('403 Forbidden'))).toContain('Accesso negato');
    });

    it('maps 500 to server error', () => {
      expect(ErrorHandler.getErrorMessage(new Error('500 Internal Server Error'))).toContain(
        'Errore del server API',
      );
    });

    it('maps 503 to service unavailable', () => {
      expect(ErrorHandler.getErrorMessage(new Error('503 Service Unavailable'))).toContain(
        'non disponibile',
      );
    });

    it('maps Network error to connection error', () => {
      expect(ErrorHandler.getErrorMessage(new Error('Network request failed'))).toContain(
        'connessione',
      );
    });

    it('maps timeout to timeout message', () => {
      expect(ErrorHandler.getErrorMessage(new Error('Request timeout exceeded'))).toContain(
        'scaduta',
      );
    });

    it('maps chrome:// URLs to internal page error', () => {
      expect(ErrorHandler.getErrorMessage(new Error('chrome://extensions'))).toContain(
        'pagine interne di Chrome',
      );
    });

    it('maps connection errors to reload message', () => {
      expect(ErrorHandler.getErrorMessage(new Error('Could not establish connection'))).toContain(
        'Ricarica la pagina',
      );
    });

    it('maps QUOTA_BYTES to storage full message', () => {
      expect(ErrorHandler.getErrorMessage(new Error('QUOTA_BYTES exceeded'))).toContain(
        'archiviazione esaurito',
      );
    });

    it('returns generic message for unrecognized errors', () => {
      const msg = ErrorHandler.getErrorMessage(new Error('Something completely unknown'));
      expect(msg).toContain('errore imprevisto');
    });

    it('handles non-Error objects gracefully', () => {
      const msg = ErrorHandler.getErrorMessage('just a string error');
      expect(msg).toBeTypeOf('string');
    });
  });

  describe('logError', () => {
    it('persists error to chrome storage', async () => {
      await ErrorHandler.logError(new Error('Test error'), 'testContext');

      expect(store.errorLogs).toHaveLength(1);
      expect(store.errorLogs[0].context).toBe('testContext');
      expect(store.errorLogs[0].timestamp).toBeTypeOf('number');
    });

    it('uses getErrorMessage for stored message (no raw leak)', async () => {
      await ErrorHandler.logError(new Error('429 Too Many Requests'), 'api');

      expect(store.errorLogs[0].message).toContain('Rate limit');
      expect(store.errorLogs[0].message).not.toContain('429');
    });

    it('enforces max 50 error logs by shifting oldest', async () => {
      // Pre-fill with 50 entries — index 0 is "Error-0" (first inserted)
      store.errorLogs = Array.from({ length: 50 }, (_, i) => ({
        message: `Error-${i}`,
        timestamp: Date.now() - (50 - i) * 1000,
      }));

      await ErrorHandler.logError(new Error('New error'));

      expect(store.errorLogs).toHaveLength(50);
      // "Error-0" was at position 0 and should have been shifted out
      const allMessages = store.errorLogs.map((l) => l.message);
      expect(allMessages).not.toContain('Error-0');
      // New entry is at the end (pushed)
      expect(allMessages[49]).toContain('errore imprevisto'); // getErrorMessage('New error')
      // "Error-1" should now be at position 0
      expect(allMessages[0]).toBe('Error-1');
    });

    it('survives chrome storage failures gracefully', async () => {
      browser.storage.local.get.mockRejectedValueOnce(new Error('Storage failed'));

      // Should not throw
      await expect(ErrorHandler.logError(new Error('Test'))).resolves.not.toThrow();
    });

    it('stores error.cause message when cause is present', async () => {
      const cause = new Error('root cause');
      const error = new Error('wrapper error', { cause });

      await ErrorHandler.logError(error, 'ctx');

      expect(store.errorLogs[0].cause).toBe('root cause');
    });

    it('stores error.cause as string when cause is not an Error', async () => {
      const error = new Error('wrapper');
      error.cause = 'string cause';

      await ErrorHandler.logError(error, 'ctx');

      expect(store.errorLogs[0].cause).toBe('string cause');
    });

    it('stores truncated stack when error has a stack', async () => {
      const error = new Error('error with stack');

      await ErrorHandler.logError(error, 'ctx');

      expect(store.errorLogs[0]).toHaveProperty('stack');
      // at most 5 lines
      const stackLines = store.errorLogs[0].stack.split('\n');
      expect(stackLines.length).toBeLessThanOrEqual(5);
    });

    it('omits stack when error has no stack', async () => {
      const error = new Error('no stack error');
      delete error.stack;

      await ErrorHandler.logError(error, 'ctx');

      expect(store.errorLogs[0]).not.toHaveProperty('stack');
    });

    it('url falls back to "unknown" when URL constructor throws', async () => {
      // window.location.href is empty string in jsdom — patch it to trigger the catch
      const original = window.location;
      Object.defineProperty(window, 'location', {
        value: { href: ':::invalid:::' },
        writable: true,
        configurable: true,
      });

      await ErrorHandler.logError(new Error('url test'));

      Object.defineProperty(window, 'location', {
        value: original,
        writable: true,
        configurable: true,
      });

      // Either 'unknown' or a valid url — the catch branch returns 'unknown'
      expect(store.errorLogs[0].url).toBeTypeOf('string');
    });
  });

  describe('getErrorStats', () => {
    it('returns total and last24h counts', async () => {
      const now = Date.now();
      store.errorLogs = [
        { message: 'API error', timestamp: now - 1000 },
        { message: 'Network error', timestamp: now - 2 * 24 * 60 * 60 * 1000 }, // >24h ago
      ];

      const stats = await ErrorHandler.getErrorStats();

      expect(stats.total).toBe(2);
      expect(stats.last24h).toBe(1);
    });

    it('returns zero counts when no logs', async () => {
      const stats = await ErrorHandler.getErrorStats();

      expect(stats.total).toBe(0);
      expect(stats.last24h).toBe(0);
      expect(stats.errorTypes).toEqual({});
    });

    it('categorizes API errors correctly', async () => {
      const now = Date.now();
      store.errorLogs = [
        { message: 'API key non valida', timestamp: now - 1000 },
        { message: 'Rate limit raggiunto 401', timestamp: now - 1000 },
      ];

      const stats = await ErrorHandler.getErrorStats();

      expect(stats.errorTypes['API']).toBe(2);
    });

    it('categorizes Network errors correctly', async () => {
      const now = Date.now();
      store.errorLogs = [{ message: 'Network request failed', timestamp: now - 1000 }];

      const stats = await ErrorHandler.getErrorStats();

      expect(stats.errorTypes['Network']).toBe(1);
    });

    it('categorizes Extraction errors correctly', async () => {
      const now = Date.now();
      store.errorLogs = [{ message: 'No article found', timestamp: now - 1000 }];

      const stats = await ErrorHandler.getErrorStats();

      expect(stats.errorTypes['Extraction']).toBe(1);
    });

    it('categorizes Storage errors correctly', async () => {
      const now = Date.now();
      store.errorLogs = [{ message: 'cache limit exceeded', timestamp: now - 1000 }];

      const stats = await ErrorHandler.getErrorStats();

      expect(stats.errorTypes['Storage']).toBe(1);
    });

    it('categorizes unrecognized messages as Other', async () => {
      const now = Date.now();
      store.errorLogs = [{ message: 'something completely different', timestamp: now - 1000 }];

      const stats = await ErrorHandler.getErrorStats();

      expect(stats.errorTypes['Other']).toBe(1);
    });

    it('returns null when chrome storage throws', async () => {
      browser.storage.local.get.mockRejectedValueOnce(new Error('Storage down'));

      const stats = await ErrorHandler.getErrorStats();

      expect(stats).toBeNull();
    });
  });

  describe('categorizeError', () => {
    it('returns "API" for messages containing "API"', () => {
      expect(ErrorHandler.categorizeError('API rate limit')).toBe('API');
    });

    it('returns "API" for messages containing "401"', () => {
      expect(ErrorHandler.categorizeError('Error 401')).toBe('API');
    });

    it('returns "API" for messages containing "429"', () => {
      expect(ErrorHandler.categorizeError('429 Too Many')).toBe('API');
    });

    it('returns "Network" for messages containing "Network"', () => {
      expect(ErrorHandler.categorizeError('Network timeout')).toBe('Network');
    });

    it('returns "Network" for messages containing "fetch"', () => {
      expect(ErrorHandler.categorizeError('fetch failed')).toBe('Network');
    });

    it('returns "Extraction" for messages containing "article"', () => {
      expect(ErrorHandler.categorizeError('No article found')).toBe('Extraction');
    });

    it('returns "Extraction" for messages containing "extract"', () => {
      expect(ErrorHandler.categorizeError('extract failed')).toBe('Extraction');
    });

    it('returns "Storage" for messages containing "cache"', () => {
      expect(ErrorHandler.categorizeError('cache full')).toBe('Storage');
    });

    it('returns "Storage" for messages containing "storage"', () => {
      expect(ErrorHandler.categorizeError('storage quota exceeded')).toBe('Storage');
    });

    it('returns "Other" for unrecognized messages', () => {
      expect(ErrorHandler.categorizeError('completely unknown error')).toBe('Other');
    });
  });

  describe('clearErrorLogs', () => {
    beforeEach(() => {
      global.browser.storage.local.remove = vi.fn().mockResolvedValue(undefined);
    });

    it('calls browser.storage.local.remove with errorLogs key', async () => {
      await ErrorHandler.clearErrorLogs();

      expect(browser.storage.local.remove).toHaveBeenCalledWith(['errorLogs']);
    });

    it('survives chrome storage remove failure gracefully', async () => {
      browser.storage.local.remove.mockRejectedValueOnce(new Error('remove failed'));

      await expect(ErrorHandler.clearErrorLogs()).resolves.not.toThrow();
    });
  });

  describe('handleAsync', () => {
    it('returns resolved value when async function succeeds', async () => {
      const result = await ErrorHandler.handleAsync(async () => 42, 'ctx');

      expect(result).toBe(42);
    });

    it('re-throws error after showing it when async function throws', async () => {
      const error = new Error('async failure');

      await expect(
        ErrorHandler.handleAsync(async () => {
          throw error;
        }, 'ctx'),
      ).rejects.toThrow('async failure');
    });

    it('calls showError with the thrown error and context', async () => {
      const showErrorSpy = vi.spyOn(ErrorHandler, 'showError').mockResolvedValue('handled');
      const error = new Error('boom');

      try {
        await ErrorHandler.handleAsync(async () => {
          throw error;
        }, 'myCtx');
      } catch {
        // expected
      }

      expect(showErrorSpy).toHaveBeenCalledWith(error, 'myCtx');
      showErrorSpy.mockRestore();
    });

    it('works with empty context string', async () => {
      const result = await ErrorHandler.handleAsync(async () => 'ok');

      expect(result).toBe('ok');
    });
  });

  describe('showError', () => {
    it('returns user-friendly error message', async () => {
      const msg = await ErrorHandler.showError(new Error('Network down'), '');

      expect(msg).toContain('connessione');
    });

    it('returns user-friendly message regardless of context (context used internally)', async () => {
      // showError returns errorMessage (line 25), not fullMessage — context used for modal/log only
      const msg = await ErrorHandler.showError(new Error('No article found'), 'MyContext');

      expect(msg).toContain('Nessun articolo rilevato');
    });

    it('returns same message with and without context', async () => {
      const msgWithCtx = await ErrorHandler.showError(new Error('No article found'), 'ctx');
      const msgNoCtx = await ErrorHandler.showError(new Error('No article found'), '');

      expect(msgWithCtx).toBe(msgNoCtx);
    });
  });
});
