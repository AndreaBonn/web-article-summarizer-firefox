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

import { CompressionManager } from '@utils/storage/compression-manager.js';

describe('CompressionManager', () => {
  let manager;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
    manager = new CompressionManager();
  });

  describe('getStats()', () => {
    it('test_getStats_emptyStorage_returnsZeros', async () => {
      const stats = await manager.getStats();

      expect(stats.compressedItems).toBe(0);
      expect(stats.uncompressedItems).toBe(0);
      expect(stats.totalItems).toBe(0);
      expect(stats.savedMB).toBe(0);
    });

    it('test_getStats_withUncompressedHistory_countsCorrectly', async () => {
      store.summaryHistory = [
        { summary: 'Short summary text', compressed: false },
        { summary: 'Another summary', compressed: false },
      ];

      const stats = await manager.getStats();
      expect(stats.uncompressedItems).toBe(2);
      expect(stats.compressedItems).toBe(0);
      expect(stats.totalItems).toBe(2);
    });

    it('test_getStats_withCompressedHistory_tracksCompression', async () => {
      store.summaryHistory = [{ compressed: true, originalSize: 1000, compressedSize: 500 }];

      const stats = await manager.getStats();
      expect(stats.compressedItems).toBe(1);
      expect(stats.compressionRatio).toBeGreaterThan(0);
    });

    it('test_getStats_withCache_includesCacheEntries', async () => {
      store.summaryCache = {
        key1: { data: { compressed: false, text: 'data' }, timestamp: Date.now() },
      };

      const stats = await manager.getStats();
      expect(stats.uncompressedItems).toBe(1);
    });

    it('test_getStats_storageError_returnsNull', async () => {
      browser.storage.local.get.mockRejectedValueOnce(new Error('fail'));
      const stats = await manager.getStats();
      expect(stats).toBeNull();
    });
  });
});
