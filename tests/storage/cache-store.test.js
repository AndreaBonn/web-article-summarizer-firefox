import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@utils/core/logger.js', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Chrome storage mock con store condiviso
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
      remove: vi.fn((keys) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach((k) => delete store[k]);
        return Promise.resolve();
      }),
    },
  },
};

import { CacheStore } from '@utils/storage/cache-store.js';

describe('CacheStore', () => {
  let cacheStore;
  const settings = { summaryLength: 'medium', outputLanguage: 'it', contentType: 'general' };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
    cacheStore = new CacheStore();
  });

  describe('set', () => {
    it('test_set_validData_storesInChrome', async () => {
      // Arrange
      const data = { summary: 'test summary', keyPoints: [] };

      // Act
      const result = await cacheStore.set('https://example.com', 'groq', settings, data);

      // Assert
      expect(result).toBe(true);
      expect(store.summaryCache).toBeDefined();
      const entries = Object.values(store.summaryCache);
      expect(entries).toHaveLength(1);
      expect(entries[0].data).toEqual(data);
    });

    it('test_set_storesAllMetadata', async () => {
      // Arrange
      const data = { summary: 'meta test' };

      // Act
      await cacheStore.set('https://example.com', 'openai', settings, data);

      // Assert
      const entry = Object.values(store.summaryCache)[0];
      expect(entry.url).toBe('https://example.com');
      expect(entry.provider).toBe('openai');
      expect(entry.settings).toEqual(settings);
      expect(entry.hits).toBe(0);
      expect(entry.timestamp).toBeGreaterThan(0);
      expect(entry.expiresAt).toBeGreaterThan(entry.timestamp);
    });

    it('test_set_withCustomTTL_usesCustomExpiry', async () => {
      // Arrange
      const customTTL = 60000; // 1 minuto

      // Act
      await cacheStore.set('https://example.com', 'groq', settings, { summary: 'x' }, customTTL);

      // Assert
      const entry = Object.values(store.summaryCache)[0];
      expect(entry.expiresAt - entry.timestamp).toBe(customTTL);
    });

    it('test_set_withContentHash_storesHash', async () => {
      // Arrange
      const hash = 'abc123';

      // Act
      await cacheStore.set('https://example.com', 'groq', settings, { summary: 'x' }, null, hash);

      // Assert
      const entry = Object.values(store.summaryCache)[0];
      expect(entry.contentHash).toBe(hash);
    });

    it('test_set_withoutContentHash_storesNull', async () => {
      // Act
      await cacheStore.set('https://example.com', 'groq', settings, { summary: 'x' });

      // Assert
      const entry = Object.values(store.summaryCache)[0];
      expect(entry.contentHash).toBeNull();
    });

    it('test_set_storageError_returnsFalse', async () => {
      // Arrange
      browser.storage.local.set.mockRejectedValueOnce(new Error('storage full'));

      // Act
      const result = await cacheStore.set('https://example.com', 'groq', settings, {
        summary: 'x',
      });

      // Assert
      expect(result).toBe(false);
    });

    it('test_set_multipleEntries_coexist', async () => {
      // Act
      await cacheStore.set('https://a.com', 'groq', settings, { summary: 'a' });
      await cacheStore.set('https://b.com', 'groq', settings, { summary: 'b' });

      // Assert
      expect(Object.keys(store.summaryCache)).toHaveLength(2);
    });
  });

  describe('get', () => {
    it('test_get_existingEntry_returnsData', async () => {
      // Arrange
      const data = { summary: 'cached data' };
      await cacheStore.set('https://example.com', 'groq', settings, data);

      // Act
      const result = await cacheStore.get('https://example.com', 'groq', settings);

      // Assert
      expect(result).toEqual(data);
    });

    it('test_get_cacheMiss_returnsNull', async () => {
      // Act
      const result = await cacheStore.get('https://notfound.com', 'groq', settings);

      // Assert
      expect(result).toBeNull();
    });

    it('test_get_expiredEntry_returnsNull', async () => {
      // Arrange
      await cacheStore.set('https://example.com', 'groq', settings, { summary: 'old' });
      const key = cacheStore.generateCacheKey('https://example.com', 'groq', settings);
      store.summaryCache[key].expiresAt = Date.now() - 1000;

      // Act
      const result = await cacheStore.get('https://example.com', 'groq', settings);

      // Assert
      expect(result).toBeNull();
    });

    it('test_get_expiredEntry_invalidatesFromStore', async () => {
      // Arrange
      await cacheStore.set('https://example.com', 'groq', settings, { summary: 'old' });
      const key = cacheStore.generateCacheKey('https://example.com', 'groq', settings);
      store.summaryCache[key].expiresAt = Date.now() - 1000;

      // Act
      await cacheStore.get('https://example.com', 'groq', settings);

      // Assert — entry rimossa dallo store
      expect(store.summaryCache[key]).toBeUndefined();
    });

    it('test_get_contentHashMismatch_returnsNull', async () => {
      // Arrange
      await cacheStore.set(
        'https://example.com',
        'groq',
        settings,
        { summary: 'cached' },
        null,
        'hash-v1',
      );

      // Act
      const result = await cacheStore.get('https://example.com', 'groq', settings, 'hash-v2');

      // Assert
      expect(result).toBeNull();
    });

    it('test_get_contentHashMatch_returnsData', async () => {
      // Arrange
      const data = { summary: 'valid' };
      await cacheStore.set('https://example.com', 'groq', settings, data, null, 'hash-v1');

      // Act
      const result = await cacheStore.get('https://example.com', 'groq', settings, 'hash-v1');

      // Assert
      expect(result).toEqual(data);
    });

    it('test_get_noContentHashProvided_ignoresHashValidation', async () => {
      // Arrange
      const data = { summary: 'any hash' };
      await cacheStore.set('https://example.com', 'groq', settings, data, null, 'some-hash');

      // Act — no hash arg → skip hash validation
      const result = await cacheStore.get('https://example.com', 'groq', settings);

      // Assert
      expect(result).toEqual(data);
    });

    it('test_get_oldCacheEntry_stillReturnsData', async () => {
      // Arrange — > 24h old but within defaultTTL (7 days)
      const data = { summary: 'old but valid' };
      await cacheStore.set('https://example.com', 'groq', settings, data);
      const key = cacheStore.generateCacheKey('https://example.com', 'groq', settings);
      store.summaryCache[key].timestamp = Date.now() - 25 * 60 * 60 * 1000;

      // Act
      const result = await cacheStore.get('https://example.com', 'groq', settings);

      // Assert
      expect(result).toEqual(data);
    });

    it('test_get_storageError_returnsNull', async () => {
      // Arrange
      browser.storage.local.get.mockRejectedValueOnce(new Error('storage error'));

      // Act
      const result = await cacheStore.get('https://example.com', 'groq', settings);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('invalidate', () => {
    it('test_invalidate_existingKey_removesEntry_returnsTrue', async () => {
      // Arrange
      await cacheStore.set('https://example.com', 'groq', settings, { summary: 'x' });
      const key = cacheStore.generateCacheKey('https://example.com', 'groq', settings);

      // Act
      const result = await cacheStore.invalidate(key);

      // Assert
      expect(result).toBe(true);
      expect(store.summaryCache[key]).toBeUndefined();
    });

    it('test_invalidate_nonExistentKey_returnsFalse', async () => {
      // Act
      const result = await cacheStore.invalidate('does-not-exist');

      // Assert
      expect(result).toBe(false);
    });

    it('test_invalidate_storageError_returnsFalse', async () => {
      // Arrange
      await cacheStore.set('https://example.com', 'groq', settings, { summary: 'x' });
      const key = cacheStore.generateCacheKey('https://example.com', 'groq', settings);
      browser.storage.local.get.mockRejectedValueOnce(new Error('error'));

      // Act
      const result = await cacheStore.invalidate(key);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('test_clearAll_removesEntireSummaryCache', async () => {
      // Arrange
      await cacheStore.set('https://a.com', 'groq', settings, { summary: 'a' });
      await cacheStore.set('https://b.com', 'groq', settings, { summary: 'b' });

      // Act
      await cacheStore.clearAll();

      // Assert
      expect(store.summaryCache).toBeUndefined();
    });
  });

  describe('setDefaultTTL / getDefaultTTL', () => {
    it('test_setDefaultTTL_changesStoredTTLInDays', () => {
      // Act
      cacheStore.setDefaultTTL(30);

      // Assert
      expect(cacheStore.getDefaultTTL()).toBe(30);
    });

    it('test_getDefaultTTL_defaultIs7days', () => {
      expect(cacheStore.getDefaultTTL()).toBe(7);
    });
  });

  describe('hashContent (static)', () => {
    it('test_hashContent_nullInput_returnsNull', () => {
      expect(CacheStore.hashContent(null)).toBeNull();
      expect(CacheStore.hashContent('')).toBeNull();
      expect(CacheStore.hashContent(undefined)).toBeNull();
    });

    it('test_hashContent_shortContent_returnsString', () => {
      const hash = CacheStore.hashContent('Hello world');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('test_hashContent_sameContent_returnsSameHash', () => {
      const content = 'consistent content';
      expect(CacheStore.hashContent(content)).toBe(CacheStore.hashContent(content));
    });

    it('test_hashContent_differentContent_returnsDifferentHash', () => {
      const h1 = CacheStore.hashContent('content A');
      const h2 = CacheStore.hashContent('content B');
      expect(h1).not.toBe(h2);
    });

    it('test_hashContent_longContent_samplesAndReturnsHash', () => {
      // Content > 700*3 chars triggers all sampling branches
      const longContent = 'x'.repeat(5000);
      const hash = CacheStore.hashContent(longContent);
      expect(typeof hash).toBe('string');
    });

    it('test_hashContent_mediumContent_samplesStartAndMiddle', () => {
      // Content > 700*2 but < 700*3 triggers start + middle sample
      const mediumContent = 'y'.repeat(2000);
      const hash = CacheStore.hashContent(mediumContent);
      expect(typeof hash).toBe('string');
    });
  });

  describe('invalidateByUrl', () => {
    it('test_invalidateByUrl_removesAllEntriesForUrl', async () => {
      // Arrange
      await cacheStore.set('https://example.com', 'groq', settings, { summary: '1' });
      await cacheStore.set('https://example.com', 'openai', settings, { summary: '2' });
      await cacheStore.set('https://other.com', 'groq', settings, { summary: '3' });

      // Act
      const count = await cacheStore.invalidateByUrl('https://example.com');

      // Assert
      expect(count).toBe(2);
    });

    it('test_invalidateByUrl_strips_UTM_before_matching', async () => {
      // Arrange
      await cacheStore.set('https://example.com/page', 'groq', settings, { summary: 'x' });

      // Act — URL with UTM params should still match
      const count = await cacheStore.invalidateByUrl('https://example.com/page?utm_source=twitter');

      // Assert
      expect(count).toBe(1);
    });

    it('test_invalidateByUrl_noMatchingUrl_returnsZero', async () => {
      // Arrange
      await cacheStore.set('https://other.com', 'groq', settings, { summary: 'x' });

      // Act
      const count = await cacheStore.invalidateByUrl('https://notfound.com');

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('invalidateIfContentChanged', () => {
    it('test_invalidateIfContentChanged_changedHash_invalidates', async () => {
      // Arrange
      await cacheStore.set(
        'https://example.com',
        'groq',
        settings,
        { summary: 'old' },
        null,
        'hash-old',
      );

      // Act
      const count = await cacheStore.invalidateIfContentChanged('https://example.com', 'hash-new');

      // Assert
      expect(count).toBe(1);
    });

    it('test_invalidateIfContentChanged_sameHash_doesNotInvalidate', async () => {
      // Arrange
      await cacheStore.set(
        'https://example.com',
        'groq',
        settings,
        { summary: 'same' },
        null,
        'hash-1',
      );

      // Act
      const count = await cacheStore.invalidateIfContentChanged('https://example.com', 'hash-1');

      // Assert
      expect(count).toBe(0);
    });

    it('test_invalidateIfContentChanged_noContentHash_doesNotInvalidate', async () => {
      // Arrange — entry has no contentHash
      await cacheStore.set('https://example.com', 'groq', settings, { summary: 'no hash' });

      // Act
      const count = await cacheStore.invalidateIfContentChanged('https://example.com', 'hash-new');

      // Assert — entry without contentHash is not invalidated
      expect(count).toBe(0);
    });
  });
});
