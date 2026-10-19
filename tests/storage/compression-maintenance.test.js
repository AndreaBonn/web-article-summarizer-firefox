import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

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
        Object.assign(store, JSON.parse(JSON.stringify(data)));
        return Promise.resolve();
      }),
    },
  },
};

import { CompressionMaintenance } from '@utils/storage/compression-maintenance.js';

describe('CompressionMaintenance', () => {
  let maintenance;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
    maintenance = new CompressionMaintenance();
  });

  describe('compressOldHistory()', () => {
    it('test_compressOldHistory_noHistory_returnsZero', async () => {
      const count = await maintenance.compressOldHistory(30);
      expect(count).toBe(0);
    });

    it('test_compressOldHistory_recentEntries_doesNotCompress', async () => {
      store.summaryHistory = [
        { timestamp: Date.now(), summary: 'Recent summary', compressed: false },
      ];

      const count = await maintenance.compressOldHistory(30);
      expect(count).toBe(0);
    });

    it('test_compressOldHistory_oldEntries_compressesThem', async () => {
      // Need > 1000 chars to trigger actual compression (CompressionCore threshold)
      const longSummary = 'A'.repeat(1500);
      store.summaryHistory = [
        {
          timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000,
          summary: longSummary,
          compressed: false,
        },
      ];

      const count = await maintenance.compressOldHistory(30);
      expect(count).toBe(1);
      expect(store.summaryHistory[0].compressed).toBe(true);
      expect(store.summaryHistory[0].originalSize).toBe(1500);
    });

    it('test_compressOldHistory_alreadyCompressed_skips', async () => {
      store.summaryHistory = [
        {
          timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000,
          summary: 'compressed-data',
          compressed: true,
        },
      ];

      const count = await maintenance.compressOldHistory(30);
      expect(count).toBe(0);
    });

    it('test_compressOldHistory_storageError_returnsZero', async () => {
      browser.storage.local.get.mockRejectedValueOnce(new Error('fail'));
      const count = await maintenance.compressOldHistory(30);
      expect(count).toBe(0);
    });
  });

  describe('compressOldCache()', () => {
    it('test_compressOldCache_noCache_returnsZero', async () => {
      const count = await maintenance.compressOldCache(7);
      expect(count).toBe(0);
    });

    it('test_compressOldCache_oldEntries_compressesThem', async () => {
      store.summaryCache = {
        key1: {
          timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
          data: { compressed: false, text: 'cache data' },
        },
      };

      const count = await maintenance.compressOldCache(7);
      expect(count).toBe(1);
    });

    it('test_compressOldCache_recentEntries_doesNotCompress', async () => {
      store.summaryCache = {
        key1: {
          timestamp: Date.now(),
          data: { compressed: false, text: 'recent' },
        },
      };

      const count = await maintenance.compressOldCache(7);
      expect(count).toBe(0);
    });
  });

  describe('autoCleanup()', () => {
    it('test_autoCleanup_zeroRetention_preservesHistory', async () => {
      const history = [
        { id: 'old', timestamp: Date.now() - 200 * 24 * 60 * 60 * 1000 },
        { id: 'recent', timestamp: Date.now() - 24 * 60 * 60 * 1000 },
      ];
      store.summaryHistory = structuredClone(history);

      const results = await maintenance.autoCleanup({ deleteHistoryOlderThan: 0 });
      const persisted = await browser.storage.local.get(['summaryHistory']);

      expect(results.deletedHistory).toBe(0);
      expect(persisted.summaryHistory).toEqual(history);
    });

    it('test_autoCleanup_positiveRetention_persistsSurvivingHistory', async () => {
      const recent = { id: 'recent', timestamp: Date.now() - 24 * 60 * 60 * 1000 };
      store.summaryHistory = [
        { id: 'old', timestamp: Date.now() - 200 * 24 * 60 * 60 * 1000 },
        recent,
      ];

      const results = await maintenance.autoCleanup({ deleteHistoryOlderThan: 180 });
      const persisted = await browser.storage.local.get(['summaryHistory']);

      expect(results.deletedHistory).toBe(1);
      expect(persisted.summaryHistory).toEqual([recent]);
    });

    it('test_autoCleanup_runsAllSteps_returnsResults', async () => {
      store.summaryHistory = [
        {
          timestamp: Date.now() - 200 * 24 * 60 * 60 * 1000,
          summary: 'very old',
          compressed: false,
        },
      ];

      // Mock lazy import of CacheManager
      vi.doMock('@utils/storage/cache-manager.js', () => ({
        CacheManager: class {
          cleanLRU() {
            return Promise.resolve(0);
          }
        },
      }));

      const results = await maintenance.autoCleanup();
      expect(results.deletedHistory).toBe(1);
    });
  });
});
