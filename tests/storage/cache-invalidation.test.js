import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@utils/core/logger.js', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock browser.storage con serializzazione JSON reale e beforeEach reset
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
});

import { CacheInvalidation } from '@utils/storage/cache-invalidation.js';

// Normalizzatore identità usato nei test che non richiedono trasformazione
const identity = (url) => url;

describe('CacheInvalidation', () => {
  describe('invalidateByUrl', () => {
    it('test_invalidateByUrl_matchingEntries_deletesAndReturnsCount', async () => {
      // Arrange
      store.summaryCache = {
        key1: { url: 'https://example.com/page', data: 'a' },
        key2: { url: 'https://example.com/page', data: 'b' },
        key3: { url: 'https://other.com/page', data: 'c' },
      };
      const invalidation = new CacheInvalidation();

      // Act
      const count = await invalidation.invalidateByUrl('https://example.com/page', identity);

      // Assert
      expect(count).toBe(2);
      expect(store.summaryCache.key1).toBeUndefined();
      expect(store.summaryCache.key2).toBeUndefined();
      expect(store.summaryCache.key3).toBeDefined();
    });

    it('test_invalidateByUrl_noMatch_returnsZero', async () => {
      // Arrange
      store.summaryCache = {
        key1: { url: 'https://other.com/article', data: 'x' },
      };
      const invalidation = new CacheInvalidation();

      // Act
      const count = await invalidation.invalidateByUrl('https://example.com/page', identity);

      // Assert
      expect(count).toBe(0);
      expect(store.summaryCache.key1).toBeDefined();
    });
  });

  describe('invalidateIfContentChanged', () => {
    it('test_invalidateIfContentChanged_sameHash_doesNotInvalidate', async () => {
      // Arrange
      store.summaryCache = {
        key1: { url: 'https://example.com/page', contentHash: 'abc123', data: 'content' },
      };
      const invalidation = new CacheInvalidation();

      // Act
      const count = await invalidation.invalidateIfContentChanged(
        'https://example.com/page',
        'abc123',
        identity,
      );

      // Assert
      expect(count).toBe(0);
      expect(store.summaryCache.key1).toBeDefined();
    });

    it('test_invalidateIfContentChanged_differentHash_invalidates', async () => {
      // Arrange
      store.summaryCache = {
        key1: { url: 'https://example.com/page', contentHash: 'old-hash', data: 'content' },
      };
      const invalidation = new CacheInvalidation();

      // Act
      const count = await invalidation.invalidateIfContentChanged(
        'https://example.com/page',
        'new-hash',
        identity,
      );

      // Assert
      expect(count).toBe(1);
      expect(store.summaryCache.key1).toBeUndefined();
    });
  });

  describe('cleanExpired', () => {
    it('test_cleanExpired_expiredEntries_removesAndReturnsCount', async () => {
      // Arrange
      const now = Date.now();
      store.summaryCache = {
        expired1: { url: 'https://a.com', expiresAt: now - 10000 },
        expired2: { url: 'https://b.com', expiresAt: now - 1 },
        valid: { url: 'https://c.com', expiresAt: now + 100000 },
      };
      const invalidation = new CacheInvalidation();

      // Act
      const count = await invalidation.cleanExpired();

      // Assert
      expect(count).toBe(2);
      expect(store.summaryCache.expired1).toBeUndefined();
      expect(store.summaryCache.expired2).toBeUndefined();
      expect(store.summaryCache.valid).toBeDefined();
    });

    it('test_cleanExpired_emptyCache_returnsZero', async () => {
      // Arrange
      store.summaryCache = {};
      const invalidation = new CacheInvalidation();

      // Act
      const count = await invalidation.cleanExpired();

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('cleanLRU', () => {
    it('test_cleanLRU_underLimit_returnsZero', async () => {
      // Arrange
      store.summaryCache = {
        key1: { url: 'https://a.com', lastAccessed: Date.now() - 3000 },
        key2: { url: 'https://b.com', lastAccessed: Date.now() - 1000 },
      };
      const invalidation = new CacheInvalidation();

      // Act
      const count = await invalidation.cleanLRU(5);

      // Assert
      expect(count).toBe(0);
      expect(Object.keys(store.summaryCache)).toHaveLength(2);
    });

    it('test_cleanLRU_overLimit_removesOldestAndReturnsCount', async () => {
      // Arrange
      const base = Date.now();
      store.summaryCache = {
        newest: { url: 'https://a.com', lastAccessed: base - 1000 },
        middle: { url: 'https://b.com', lastAccessed: base - 5000 },
        oldest: { url: 'https://c.com', lastAccessed: base - 10000 },
      };
      const invalidation = new CacheInvalidation();

      // Act
      const count = await invalidation.cleanLRU(1);

      // Assert
      expect(count).toBe(2);
      expect(store.summaryCache.newest).toBeDefined();
      expect(store.summaryCache.middle).toBeUndefined();
      expect(store.summaryCache.oldest).toBeUndefined();
    });
  });
});
