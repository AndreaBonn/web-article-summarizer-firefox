import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser.storage.local
const store = {};
global.browser = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        const result = {};
        for (const key of keys) {
          if (store[key] !== undefined) result[key] = store[key];
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((data) => {
        // JSON round-trip simulates Chrome storage serialization
        const serialized = JSON.parse(JSON.stringify(data));
        Object.assign(store, serialized);
        return Promise.resolve();
      }),
    },
  },
};

// Mock TranslationCache to avoid crypto.subtle dependency
vi.mock('@utils/storage/translation-cache.js', () => ({
  TranslationCache: {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    clearEntry: vi.fn().mockResolvedValue(undefined),
  },
}));

import { StorageManager } from '@utils/storage/storage-manager.js';

describe('StorageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
  });

  describe('API Keys', () => {
    it('saves and retrieves an API key', async () => {
      await StorageManager.saveApiKey('groq', 'gsk_test123');
      const key = await StorageManager.getApiKey('groq');
      expect(key).toBe('gsk_test123');
    });

    it('returns null for missing API key', async () => {
      const key = await StorageManager.getApiKey('openai');
      expect(key).toBeNull();
    });

    it('throws on legacy encrypted key format', async () => {
      store.apiKeys = { groq: { encrypted: 'data', salt: 'x', iv: 'y' } };
      await expect(StorageManager.getApiKey('groq')).rejects.toThrow('formato obsoleto');
    });

    it('saves multiple provider keys independently', async () => {
      await StorageManager.saveApiKey('groq', 'gsk_1');
      await StorageManager.saveApiKey('openai', 'sk-2');
      expect(await StorageManager.getApiKey('groq')).toBe('gsk_1');
      expect(await StorageManager.getApiKey('openai')).toBe('sk-2');
    });
  });

  describe('Settings', () => {
    it('returns default settings when none saved', async () => {
      const settings = await StorageManager.getSettings();
      expect(settings.selectedProvider).toBe('groq');
      expect(settings.summaryLength).toBe('medium');
      expect(settings.tone).toBe('neutral');
      expect(settings.saveHistory).toBe(true);
    });

    it('saves and retrieves custom settings', async () => {
      await StorageManager.saveSettings({ selectedProvider: 'openai', tone: 'formal' });
      const settings = await StorageManager.getSettings();
      expect(settings.selectedProvider).toBe('openai');
      expect(settings.tone).toBe('formal');
    });
  });

  describe('Language', () => {
    it('returns default output language (it)', async () => {
      expect(await StorageManager.getSelectedLanguage()).toBe('it');
    });

    it('saves and retrieves output language', async () => {
      await StorageManager.saveSelectedLanguage('en');
      expect(await StorageManager.getSelectedLanguage()).toBe('en');
    });

    it('returns default UI language (it)', async () => {
      expect(await StorageManager.getUILanguage()).toBe('it');
    });

    it('saves and retrieves UI language', async () => {
      await StorageManager.saveUILanguage('fr');
      expect(await StorageManager.getUILanguage()).toBe('fr');
    });
  });

  describe('Content Type', () => {
    it('returns default content type (auto)', async () => {
      expect(await StorageManager.getSelectedContentType()).toBe('auto');
    });

    it('saves and retrieves content type', async () => {
      await StorageManager.saveSelectedContentType('scientific');
      expect(await StorageManager.getSelectedContentType()).toBe('scientific');
    });
  });

  describe('Statistics', () => {
    it('initializes stats on first call', async () => {
      await StorageManager.updateStats('groq', 500, 2000);
      expect(store.stats.totalSummaries).toBe(1);
      expect(store.stats.totalWords).toBe(500);
      expect(store.stats.providerUsage.groq).toBe(1);
      expect(store.stats.totalTime).toBe(2000);
    });

    it('accumulates stats across calls', async () => {
      await StorageManager.updateStats('groq', 500, 2000);
      await StorageManager.updateStats('openai', 300, 1500);
      await StorageManager.updateStats('groq', 200, 1000);
      expect(store.stats.totalSummaries).toBe(3);
      expect(store.stats.totalWords).toBe(1000);
      expect(store.stats.providerUsage.groq).toBe(2);
      expect(store.stats.providerUsage.openai).toBe(1);
      expect(store.stats.totalTime).toBe(4500);
    });
  });

  describe('Translation Cache delegation', () => {
    it('delegates getCachedTranslation to TranslationCache', async () => {
      const { TranslationCache } = await import('@utils/storage/translation-cache.js');
      await StorageManager.getCachedTranslation('url', 'groq', 'en');
      expect(TranslationCache.get).toHaveBeenCalledWith('url', 'groq', 'en');
    });

    it('delegates saveCachedTranslation to TranslationCache', async () => {
      const { TranslationCache } = await import('@utils/storage/translation-cache.js');
      await StorageManager.saveCachedTranslation('url', 'groq', 'en', 'translated', 'it');
      expect(TranslationCache.save).toHaveBeenCalledWith('url', 'groq', 'en', 'translated', 'it');
    });

    it('delegates clearTranslationCacheEntry to TranslationCache', async () => {
      const { TranslationCache } = await import('@utils/storage/translation-cache.js');
      await StorageManager.clearTranslationCacheEntry('url', 'groq', 'en');
      expect(TranslationCache.clearEntry).toHaveBeenCalledWith('url', 'groq', 'en');
    });
  });
});
