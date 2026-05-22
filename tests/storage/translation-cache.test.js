import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@utils/core/logger.js', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// TTL usato dal sorgente: 24h in ms
const TTL_MS = 24 * 60 * 60 * 1000;

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

  // Mock crypto.subtle — hash deterministico basato sui byte dell'input.
  // global.crypto è read-only in jsdom: usare vi.stubGlobal invece di assegnazione diretta.
  vi.stubGlobal('crypto', {
    subtle: {
      digest: vi.fn(async (_algo, data) => {
        const arr = new Uint8Array(32);
        for (let i = 0; i < Math.min(data.length, 32); i++) arr[i] = data[i];
        return arr.buffer;
      }),
    },
  });

  global.TextEncoder = TextEncoder;
});

import { TranslationCache } from '@utils/storage/translation-cache.js';

describe('TranslationCache', () => {
  it('test_save_and_get_validEntry_returnsCachedData', async () => {
    // Arrange
    const url = 'https://example.com/article';
    const translation = 'Articolo tradotto';

    // Act
    await TranslationCache.save(url, 'groq', 'en', translation, 'it');
    const result = await TranslationCache.get(url, 'groq', 'en');

    // Assert
    expect(result).not.toBeNull();
    expect(result.translation).toBe(translation);
    expect(result.originalLanguage).toBe('it');
  });

  it('test_get_expiredEntry_returnsNull', async () => {
    // Arrange
    await TranslationCache.save('https://example.com', 'groq', 'en', 'Testo', 'it');

    // Forza scadenza: il sorgente usa Date.now() - cached.timestamp < TTL_MS
    // Per far scadere la entry, impostiamo timestamp = 0 (molto nel passato)
    const cacheData = store.translationCache;
    const firstKey = Object.keys(cacheData)[0];
    store.translationCache[firstKey].timestamp = 0;

    // Act
    const result = await TranslationCache.get('https://example.com', 'groq', 'en');

    // Assert
    expect(result).toBeNull();
  });

  it('test_get_nonExistentEntry_returnsNull', async () => {
    // Arrange — cache vuota
    store.translationCache = {};

    // Act
    const result = await TranslationCache.get('https://missing.com', 'groq', 'en');

    // Assert
    expect(result).toBeNull();
  });

  it('test_get_storageError_returnsNull', async () => {
    // Arrange
    global.browser.storage.local.get = vi.fn().mockRejectedValue(new Error('Storage error'));

    // Act
    const result = await TranslationCache.get('https://example.com', 'groq', 'en');

    // Assert
    expect(result).toBeNull();
  });

  it('test_save_exceedsMaxEntries_evictsOldest', async () => {
    // Arrange — popola 50 entry (limite massimo) con timestamp crescente
    // Il sorgente ordina per timestamp (ascendente) ed evita il più vecchio
    const baseTime = Date.now() - 60000;
    store.translationCache = {};
    for (let i = 0; i < 50; i++) {
      store.translationCache[`existing_key_${i}`] = {
        translation: `Traduzione ${i}`,
        originalLanguage: 'it',
        timestamp: baseTime + i * 100, // key_0 ha il timestamp più basso (più vecchio)
      };
    }
    const oldestKey = 'existing_key_0';

    // Act — salva una nuova entry che supera il limite di 50
    await TranslationCache.save('https://new-url.com', 'openai', 'fr', 'Nouveau texte', 'en');

    // Assert — la entry più vecchia è stata rimossa
    expect(store.translationCache[oldestKey]).toBeUndefined();
    expect(Object.keys(store.translationCache)).toHaveLength(50);
  });

  it('test_clearEntry_existingKey_removesFromCache', async () => {
    // Arrange
    await TranslationCache.save('https://example.com', 'groq', 'en', 'Test', 'it');
    const initialKeys = Object.keys(store.translationCache ?? {});
    expect(initialKeys).toHaveLength(1);

    // Act
    await TranslationCache.clearEntry('https://example.com', 'groq', 'en');

    // Assert
    expect(Object.keys(store.translationCache ?? {})).toHaveLength(0);
  });

  it('test_clearEntry_nonExistentKey_doesNotError', async () => {
    // Arrange
    store.translationCache = {};

    // Act & Assert — non deve lanciare
    await expect(
      TranslationCache.clearEntry('https://nonexistent.com', 'groq', 'en'),
    ).resolves.not.toThrow();
  });
});
