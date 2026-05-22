import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser.storage.local for logApiCall/logFallback
const mockStorage = {};
global.browser = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        const result = {};
        for (const key of keys) result[key] = mockStorage[key];
        return Promise.resolve(result);
      }),
      set: vi.fn((data) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      }),
    },
  },
};

vi.mock('@utils/ai/api-orchestrator.js', () => ({
  APIOrchestrator: { callAPI: vi.fn() },
}));
vi.mock('@utils/core/logger.js', () => ({
  Logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { APIResilience } from '@utils/ai/api-resilience.js';

describe('APIResilience', () => {
  let resilience;

  beforeEach(() => {
    vi.restoreAllMocks();
    resilience = new APIResilience();
  });

  describe('callWithRetry', () => {
    it('returns result on first successful call', async () => {
      const apiCall = vi.fn().mockResolvedValue('success');
      const result = await resilience.callWithRetry(apiCall);
      expect(result).toBe('success');
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    it('retries on temporary error and succeeds', async () => {
      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockResolvedValueOnce('recovered');

      const result = await resilience.callWithRetry(apiCall, {
        initialDelay: 1,
        maxRetries: 2,
      });
      expect(result).toBe('recovered');
      expect(apiCall).toHaveBeenCalledTimes(2);
    });

    it('throws immediately on permanent error (401)', async () => {
      const error = new Error('401 Unauthorized');
      const apiCall = vi.fn().mockRejectedValue(error);

      await expect(
        resilience.callWithRetry(apiCall, { maxRetries: 3, initialDelay: 1 }),
      ).rejects.toThrow('401');
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    it('throws after max retries exhausted', async () => {
      const apiCall = vi.fn().mockRejectedValue(new Error('HTTP 500'));

      await expect(
        resilience.callWithRetry(apiCall, { maxRetries: 2, initialDelay: 1 }),
      ).rejects.toThrow('500');
      expect(apiCall).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('calls onRetry callback with attempt info', async () => {
      const onRetry = vi.fn();
      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockResolvedValueOnce('ok');

      await resilience.callWithRetry(apiCall, {
        maxRetries: 2,
        initialDelay: 1,
        onRetry,
      });
      expect(onRetry).toHaveBeenCalledWith(1, 3, expect.any(Number));
    });
  });

  describe('callWithFallback', () => {
    it('returns { result, usedProvider } without fallback', async () => {
      const { APIClient } = await import('@utils/ai/api-client.js');
      APIClient.callAPI.mockResolvedValue('primary result');

      const result = await resilience.callWithFallback({
        primaryProvider: 'groq',
        apiKeys: { groq: 'key1' },
        article: {},
        settings: {},
        enableFallback: false,
      });

      expect(result).toEqual({
        result: 'primary result',
        usedProvider: 'groq',
      });
    });

    it('returns { result, usedProvider } with fallback enabled', async () => {
      const { APIClient } = await import('@utils/ai/api-client.js');
      APIClient.callAPI.mockResolvedValue('fallback result');

      const result = await resilience.callWithFallback({
        primaryProvider: 'groq',
        apiKeys: { groq: 'key1', openai: 'key2' },
        article: {},
        settings: {},
        enableFallback: true,
      });

      expect(result.result).toBe('fallback result');
      expect(result.usedProvider).toBe('groq');
    });

    // Note: fallback with retry is slow to test (real delays).
    // The return shape consistency is already tested above.
  });

  describe('extractStatusCode', () => {
    it('extracts status from error.status property', () => {
      const error = new Error('fail');
      error.status = 429;
      expect(resilience.extractStatusCode(error)).toBe(429);
    });

    it('extracts status from "status: 429" pattern', () => {
      expect(resilience.extractStatusCode(new Error('status: 429'))).toBe(429);
    });

    it('extracts status from "code: 500" pattern', () => {
      expect(resilience.extractStatusCode(new Error('code: 500'))).toBe(500);
    });

    it('extracts status code at start of message', () => {
      expect(resilience.extractStatusCode(new Error('401 Unauthorized'))).toBe(401);
    });

    it('returns null for unknown error format', () => {
      expect(resilience.extractStatusCode(new Error('Something went wrong'))).toBeNull();
    });

    it('returns null for RATE_LIMIT tag without numeric code', () => {
      expect(resilience.extractStatusCode(new Error('[RATE_LIMIT:Groq]'))).toBeNull();
    });
  });

  describe('getFallbackOrder', () => {
    it('puts primary provider first', () => {
      const order = resilience.getFallbackOrder('openai', {
        groq: 'k1',
        openai: 'k2',
        anthropic: 'k3',
      });
      expect(order[0]).toBe('openai');
    });

    it('only includes providers with API keys', () => {
      const order = resilience.getFallbackOrder('groq', {
        groq: 'k1',
        openai: null,
        anthropic: 'k3',
      });
      expect(order).not.toContain('openai');
      expect(order).toContain('groq');
      expect(order).toContain('anthropic');
    });
  });

  describe('static error classifications', () => {
    it('defines temporary errors', () => {
      expect(APIResilience.TEMPORARY_ERRORS).toContain(429);
      expect(APIResilience.TEMPORARY_ERRORS).toContain(500);
      expect(APIResilience.TEMPORARY_ERRORS).toContain(503);
    });

    it('defines permanent errors', () => {
      expect(APIResilience.PERMANENT_ERRORS).toContain(401);
      expect(APIResilience.PERMANENT_ERRORS).toContain(403);
      expect(APIResilience.PERMANENT_ERRORS).toContain(404);
    });
  });

  // ---------------------------------------------------------------------------
  // logApiCall — lines 107-122
  // ---------------------------------------------------------------------------

  describe('logApiCall', () => {
    beforeEach(() => {
      Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      vi.clearAllMocks();
    });

    it('saves log entry to browser.storage', async () => {
      browser.storage.local.get.mockResolvedValue({ apiLogs: [] });
      browser.storage.local.set.mockResolvedValue(undefined);

      const entry = { success: true, attempt: 1, timestamp: Date.now() };
      await resilience.logApiCall(entry);

      expect(browser.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ apiLogs: expect.arrayContaining([entry]) }),
      );
    });

    it('initializes log array when storage is empty', async () => {
      browser.storage.local.get.mockResolvedValue({});
      browser.storage.local.set.mockResolvedValue(undefined);

      const entry = { success: false, error: 'timeout', timestamp: Date.now() };
      await resilience.logApiCall(entry);

      const [saved] = browser.storage.local.set.mock.calls[0];
      expect(saved.apiLogs).toHaveLength(1);
      expect(saved.apiLogs[0]).toBe(entry);
    });

    it('trims log array to MAX_API_LOGS (100) entries', async () => {
      const existing = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      browser.storage.local.get.mockResolvedValue({ apiLogs: existing });
      browser.storage.local.set.mockResolvedValue(undefined);

      await resilience.logApiCall({ success: true, id: 100 });

      const [saved] = browser.storage.local.set.mock.calls[0];
      expect(saved.apiLogs).toHaveLength(100);
      // The oldest entry (id: 0) should have been removed
      expect(saved.apiLogs[0].id).toBe(1);
    });

    it('does not throw when browser.storage.local.get rejects', async () => {
      browser.storage.local.get.mockRejectedValue(new Error('storage error'));
      await expect(resilience.logApiCall({ success: true })).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // logFallback — lines 127-141
  // ---------------------------------------------------------------------------

  describe('logFallback', () => {
    beforeEach(() => {
      Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      vi.clearAllMocks();
    });

    it('saves fallback log entry to browser.storage', async () => {
      browser.storage.local.get.mockResolvedValue({ fallbackLogs: [] });
      browser.storage.local.set.mockResolvedValue(undefined);

      const entry = { primaryProvider: 'groq', usedProvider: 'openai', success: true };
      await resilience.logFallback(entry);

      expect(browser.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ fallbackLogs: expect.arrayContaining([entry]) }),
      );
    });

    it('initializes fallback log array when storage is empty', async () => {
      browser.storage.local.get.mockResolvedValue({});
      browser.storage.local.set.mockResolvedValue(undefined);

      await resilience.logFallback({ success: false });

      const [saved] = browser.storage.local.set.mock.calls[0];
      expect(saved.fallbackLogs).toHaveLength(1);
    });

    it('trims fallback log to MAX_FALLBACK_LOGS (50) entries', async () => {
      const existing = Array.from({ length: 50 }, (_, i) => ({ id: i }));
      browser.storage.local.get.mockResolvedValue({ fallbackLogs: existing });
      browser.storage.local.set.mockResolvedValue(undefined);

      await resilience.logFallback({ id: 50 });

      const [saved] = browser.storage.local.set.mock.calls[0];
      expect(saved.fallbackLogs).toHaveLength(50);
      expect(saved.fallbackLogs[0].id).toBe(1);
    });

    it('does not throw when browser.storage.local rejects', async () => {
      browser.storage.local.get.mockRejectedValue(new Error('quota exceeded'));
      await expect(resilience.logFallback({ success: true })).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getStats — lines 146-174
  // ---------------------------------------------------------------------------

  describe('getStats', () => {
    beforeEach(() => {
      Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      vi.clearAllMocks();
    });

    it('calculates correct success rate', async () => {
      const apiLogs = [{ success: true }, { success: true }, { success: false, retrying: false }];
      browser.storage.local.get.mockResolvedValue({ apiLogs, fallbackLogs: [] });

      const stats = await resilience.getStats();

      expect(stats.totalCalls).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
      expect(stats.successRate).toBeCloseTo(66.7, 0);
    });

    it('counts retrying entries separately from failures', async () => {
      const apiLogs = [
        { success: false, retrying: true },
        { success: false, retrying: true },
        { success: false, retrying: false },
      ];
      browser.storage.local.get.mockResolvedValue({ apiLogs, fallbackLogs: [] });

      const stats = await resilience.getStats();

      expect(stats.retryCount).toBe(2);
      expect(stats.failureCount).toBe(1);
    });

    it('returns successRate 0 when there are no api logs', async () => {
      browser.storage.local.get.mockResolvedValue({ apiLogs: [], fallbackLogs: [] });

      const stats = await resilience.getStats();

      expect(stats.successRate).toBe(0);
      expect(stats.totalCalls).toBe(0);
    });

    it('includes fallbackCount from fallbackLogs', async () => {
      const fallbackLogs = [{ primaryProvider: 'groq', usedProvider: 'openai' }];
      browser.storage.local.get.mockResolvedValue({ apiLogs: [], fallbackLogs });

      const stats = await resilience.getStats();

      expect(stats.fallbackCount).toBe(1);
    });

    it('includes recentLogs (last 10 entries)', async () => {
      const apiLogs = Array.from({ length: 15 }, (_, i) => ({ id: i, success: true }));
      browser.storage.local.get.mockResolvedValue({ apiLogs, fallbackLogs: [] });

      const stats = await resilience.getStats();

      expect(stats.recentLogs).toHaveLength(10);
      expect(stats.recentLogs[0].id).toBe(5); // slice(-10) starts from index 5
    });

    it('returns null when browser.storage throws', async () => {
      browser.storage.local.get.mockRejectedValue(new Error('read error'));

      const stats = await resilience.getStats();

      expect(stats).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // clearLogs — lines 179-185
  // ---------------------------------------------------------------------------

  describe('clearLogs', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('calls browser.storage.local.remove with correct keys', async () => {
      browser.storage.local.remove = vi.fn().mockResolvedValue(undefined);

      await resilience.clearLogs();

      expect(browser.storage.local.remove).toHaveBeenCalledWith(['apiLogs', 'fallbackLogs']);
    });

    it('does not throw when browser.storage.local.remove rejects', async () => {
      browser.storage.local.remove = vi.fn().mockRejectedValue(new Error('remove error'));

      await expect(resilience.clearLogs()).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // sleep — line 187
  // ---------------------------------------------------------------------------

  describe('sleep', () => {
    it('resolves after the given delay', async () => {
      const start = Date.now();
      await resilience.sleep(20);
      expect(Date.now() - start).toBeGreaterThanOrEqual(15);
    });

    it('resolves immediately for 0ms', async () => {
      await expect(resilience.sleep(0)).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // canMakeRequest / consumeToken / getWaitTime (proxy to rate limiter)
  // ---------------------------------------------------------------------------

  describe('rate limiter proxy methods', () => {
    it('exposes requestQueue from rate limiter', () => {
      expect(Array.isArray(resilience.requestQueue)).toBe(true);
    });

    it('exposes isProcessing from rate limiter', () => {
      expect(typeof resilience.isProcessing).toBe('boolean');
    });

    it('exposes rateLimits from rate limiter', () => {
      expect(typeof resilience.rateLimits).toBe('object');
    });
  });
});
