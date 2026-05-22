import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@utils/core/logger.js', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@utils/ai/api-orchestrator.js', () => ({
  APIOrchestrator: { callAPI: vi.fn() },
}));

const store = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
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
          const serialized = JSON.parse(JSON.stringify(data));
          Object.assign(store, serialized);
          return Promise.resolve();
        }),
        remove: vi.fn((keys) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          keyList.forEach((k) => delete store[k]);
          return Promise.resolve();
        }),
      },
    },
  };
  vi.clearAllMocks();
});

import { FallbackStrategy } from '@utils/ai/fallback-strategy.js';

// FallbackStrategy espone metodi di istanza — creiamo un'istanza condivisa
const strategy = new FallbackStrategy();

describe('FallbackStrategy', () => {
  describe('getFallbackOrder', () => {
    it('test_getFallbackOrder_groqPrimary_returnsCorrectOrder', () => {
      // Arrange
      const apiKeys = { groq: 'gsk_1', openai: 'sk-2', anthropic: 'ant-3', gemini: 'gem-4' };

      // Act
      const order = strategy.getFallbackOrder('groq', apiKeys);

      // Assert — groq è il primo, poi gli altri
      expect(order[0]).toBe('groq');
      expect(order.length).toBeGreaterThan(1);
    });

    it('test_getFallbackOrder_filtersProvidersWithoutKeys', () => {
      // Arrange — solo groq e openai hanno una chiave
      const apiKeys = { groq: 'gsk_1', openai: 'sk-2', anthropic: '', gemini: null };

      // Act
      const order = strategy.getFallbackOrder('groq', apiKeys);

      // Assert
      expect(order).toContain('groq');
      expect(order).toContain('openai');
      expect(order).not.toContain('anthropic');
      expect(order).not.toContain('gemini');
    });
  });

  describe('callWithFallback', () => {
    it('test_callWithFallback_fallbackDisabled_usesOnlyPrimary', async () => {
      // Arrange
      const callWithRetry = vi.fn().mockResolvedValue({ summary: 'ok' });
      const params = {
        primaryProvider: 'groq',
        enableFallback: false,
        apiKeys: { groq: 'gsk_1', openai: 'sk-2' },
        article: {},
        settings: {},
      };

      // Act
      const result = await strategy.callWithFallback(params, callWithRetry, vi.fn());

      // Assert
      expect(callWithRetry).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ usedProvider: 'groq' });
    });

    it('test_callWithFallback_primarySucceeds_returnsWithProvider', async () => {
      // Arrange
      const callWithRetry = vi.fn().mockResolvedValue({ summary: 'Testo' });
      const params = {
        primaryProvider: 'groq',
        enableFallback: true,
        apiKeys: { groq: 'gsk_1', openai: 'sk-2' },
        article: {},
        settings: {},
      };

      // Act
      const result = await strategy.callWithFallback(params, callWithRetry, vi.fn());

      // Assert
      expect(callWithRetry).toHaveBeenCalledTimes(1);
      expect(result.usedProvider).toBe('groq');
    });

    it('test_callWithFallback_primaryFails_fallsBackToNext', async () => {
      // Arrange
      const callWithRetry = vi
        .fn()
        .mockRejectedValueOnce(new Error('Groq unavailable'))
        .mockResolvedValueOnce({ summary: 'From OpenAI' });
      const logFallback = vi.fn().mockResolvedValue(undefined);
      const params = {
        primaryProvider: 'groq',
        enableFallback: true,
        apiKeys: { groq: 'gsk_1', openai: 'sk-2' },
        article: {},
        settings: {},
      };

      // Act
      const result = await strategy.callWithFallback(params, callWithRetry, logFallback);

      // Assert
      expect(callWithRetry).toHaveBeenCalledTimes(2);
      expect(result.usedProvider).toBe('openai');
    });

    it('test_callWithFallback_allProvidersFail_throwsWithLastError', async () => {
      // Arrange
      const callWithRetry = vi.fn().mockRejectedValue(new Error('All providers down'));
      const logFallback = vi.fn().mockResolvedValue(undefined);
      const params = {
        primaryProvider: 'groq',
        enableFallback: true,
        apiKeys: { groq: 'gsk_1' }, // un solo provider disponibile
        article: {},
        settings: {},
      };

      // Act & Assert
      await expect(strategy.callWithFallback(params, callWithRetry, logFallback)).rejects.toThrow();
    });

    it('test_callWithFallback_onFallbackCallback_calledOnFallback', async () => {
      // Arrange
      const callWithRetry = vi
        .fn()
        .mockRejectedValueOnce(new Error('Groq down'))
        .mockResolvedValueOnce({ summary: 'Fallback result' });
      const logFallback = vi.fn().mockResolvedValue(undefined);
      const params = {
        primaryProvider: 'groq',
        enableFallback: true,
        apiKeys: { groq: 'gsk_1', openai: 'sk-2' },
        article: {},
        settings: {},
      };

      // Act
      await strategy.callWithFallback(params, callWithRetry, logFallback);

      // Assert — il callback di logging deve essere stato invocato per il fallback
      expect(logFallback).toHaveBeenCalled();
      expect(logFallback).toHaveBeenCalledWith(
        expect.objectContaining({ primaryProvider: 'groq', usedProvider: 'openai' }),
      );
    });
  });
});
