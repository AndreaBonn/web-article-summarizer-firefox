import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@utils/core/logger.js', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
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
});

import { CacheStats } from '@utils/storage/cache-stats.js';

describe('CacheStats', () => {
  describe('formatAge', () => {
    it('test_formatAge_seconds_returnsS', () => {
      // Arrange
      const stats = new CacheStats();
      // Act
      const result = stats.formatAge(45000); // 45 secondi
      // Assert
      expect(result).toMatch(/s$/);
    });

    it('test_formatAge_minutes_returnsM', () => {
      // Arrange
      const stats = new CacheStats();
      // Act
      const result = stats.formatAge(5 * 60 * 1000); // 5 minuti
      // Assert
      expect(result).toMatch(/m$/);
    });

    it('test_formatAge_hours_returnsH', () => {
      // Arrange
      const stats = new CacheStats();
      // Act
      const result = stats.formatAge(3 * 60 * 60 * 1000); // 3 ore
      // Assert
      expect(result).toMatch(/h$/);
    });

    it('test_formatAge_days_returnsG', () => {
      // Arrange
      const stats = new CacheStats();
      // Act
      const result = stats.formatAge(2 * 24 * 60 * 60 * 1000); // 2 giorni
      // Assert
      expect(result).toMatch(/g$/);
    });
  });

  describe('getStats', () => {
    it('test_getStats_emptyCache_returnsZeros', async () => {
      // Arrange
      store.summaryCache = {};
      const stats = new CacheStats();

      // Act
      const result = await stats.getStats();

      // Assert
      expect(result.totalEntries).toBe(0);
      expect(result.validEntries).toBe(0);
      expect(result.expiredEntries).toBe(0);
      expect(result.totalHits).toBe(0);
      expect(result.avgHits).toBe(0);
    });

    it('test_getStats_withEntries_calculatesCorrectly', async () => {
      // Arrange
      const now = Date.now();
      store.summaryCache = {
        valid1: { url: 'https://a.com', expiresAt: now + 100000, hits: 4, size: 1024 },
        valid2: { url: 'https://b.com', expiresAt: now + 200000, hits: 2, size: 2048 },
        expired1: { url: 'https://c.com', expiresAt: now - 1000, hits: 0, size: 512 },
      };
      const stats = new CacheStats();

      // Act
      const result = await stats.getStats();

      // Assert
      expect(result.totalEntries).toBe(3);
      expect(result.validEntries).toBe(2);
      expect(result.expiredEntries).toBe(1);
      expect(result.totalHits).toBe(6);
      expect(result.avgHits).toBeCloseTo(2, 0); // 6 hits / 3 entries
    });
  });

  describe('logCacheOperation', () => {
    it('test_logCacheOperation_addsEntry', async () => {
      // Arrange
      store.cacheLogs = [];
      const stats = new CacheStats();

      // Act
      await stats.logCacheOperation('get', 'cache_key_123', true, 'hit');

      // Assert
      expect(store.cacheLogs).toHaveLength(1);
      expect(store.cacheLogs[0].operation).toBe('get');
      expect(store.cacheLogs[0].key).toBe('cache_key_123');
      expect(store.cacheLogs[0].success).toBe(true);
      expect(store.cacheLogs[0].reason).toBe('hit');
    });

    it('test_logCacheOperation_exceedsMax_shiftsOldest', async () => {
      // Arrange — popola 200 log (il massimo)
      store.cacheLogs = Array.from({ length: 200 }, (_, i) => ({
        operation: 'get',
        key: `key_${i}`,
        success: true,
        reason: 'hit',
        timestamp: Date.now() - (200 - i) * 1000,
      }));
      const stats = new CacheStats();

      // Act
      await stats.logCacheOperation('set', 'new_key', true, 'stored');

      // Assert — ancora 200 voci, la più vecchia è stata rimossa
      expect(store.cacheLogs).toHaveLength(200);
      expect(store.cacheLogs[store.cacheLogs.length - 1].key).toBe('new_key');
      expect(store.cacheLogs[0].key).toBe('key_1'); // key_0 rimossa
    });
  });

  describe('clearLogs', () => {
    it('test_clearLogs_existingLogs_removesAll', async () => {
      // Arrange
      store.cacheLogs = [{ operation: 'get', key: 'k1', success: true, timestamp: Date.now() }];
      const stats = new CacheStats();

      // Act
      await stats.clearLogs();

      // Assert
      const result = await browser.storage.local.get(['cacheLogs']);
      // cacheLogs rimosso oppure vuoto
      expect(!result.cacheLogs || result.cacheLogs.length === 0).toBe(true);
    });
  });
});
