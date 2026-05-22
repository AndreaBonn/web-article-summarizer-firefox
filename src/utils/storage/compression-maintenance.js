// Compression Maintenance - Compressione dati storici e cache vecchi
import { Logger } from '../core/logger.js';
import { CompressionStorage } from './compression-storage.js';

export class CompressionMaintenance extends CompressionStorage {
  /**
   * Comprimi cronologia vecchia
   */
  async compressOldHistory(daysOld = 30) {
    try {
      const result = await browser.storage.local.get(['summaryHistory']);
      const history = result.summaryHistory || [];

      const cutoffDate = Date.now() - daysOld * 24 * 60 * 60 * 1000;
      let compressedCount = 0;

      for (const entry of history) {
        if (entry.timestamp < cutoffDate && !entry.compressed) {
          // Comprimi il riassunto
          if (entry.summary) {
            const compressed = this.compress(entry.summary);
            entry.summary = compressed.data;
            entry.compressed = compressed.compressed;
            entry.originalSize = compressed.originalSize;
            entry.compressedSize = compressed.compressedSize;
            compressedCount++;
          }
        }
      }

      if (compressedCount > 0) {
        await browser.storage.local.set({ summaryHistory: history });
      }

      return compressedCount;
    } catch (error) {
      Logger.error('Errore nella compressione cronologia:', error);
      return 0;
    }
  }

  /**
   * Comprimi cache vecchia
   */
  async compressOldCache(daysOld = 7) {
    try {
      const result = await browser.storage.local.get(['summaryCache']);
      const cache = result.summaryCache || {};

      const cutoffDate = Date.now() - daysOld * 24 * 60 * 60 * 1000;
      let compressedCount = 0;

      for (const [, entry] of Object.entries(cache)) {
        if (entry.timestamp < cutoffDate && !entry.data.compressed) {
          // Comprimi i dati
          const compressed = this.compress(JSON.stringify(entry.data));
          entry.data = {
            compressed: compressed.compressed,
            data: compressed.data,
            originalSize: compressed.originalSize,
            compressedSize: compressed.compressedSize,
          };
          compressedCount++;
        }
      }

      if (compressedCount > 0) {
        await browser.storage.local.set({ summaryCache: cache });
      }

      return compressedCount;
    } catch (error) {
      Logger.error('Errore nella compressione cache:', error);
      return 0;
    }
  }

  /**
   * Cleanup automatico: comprimi e archivia dati vecchi
   */
  async autoCleanup(options = {}) {
    const {
      compressHistoryOlderThan = 30, // giorni
      compressCacheOlderThan = 7, // giorni
      deleteHistoryOlderThan = 180, // giorni
      maxCacheEntries = 100,
    } = options;

    const results = {
      compressedHistory: 0,
      compressedCache: 0,
      deletedHistory: 0,
      cleanedCache: 0,
    };

    try {
      // Comprimi cronologia vecchia
      results.compressedHistory = await this.compressOldHistory(compressHistoryOlderThan);

      // Comprimi cache vecchia
      results.compressedCache = await this.compressOldCache(compressCacheOlderThan);

      // Elimina cronologia molto vecchia
      if (deleteHistoryOlderThan > 0) {
        const result = await browser.storage.local.get(['summaryHistory']);
        const history = result.summaryHistory || [];
        const cutoffDate = Date.now() - deleteHistoryOlderThan * 24 * 60 * 60 * 1000;

        const filteredHistory = history.filter((entry) => entry.timestamp >= cutoffDate);
        results.deletedHistory = history.length - filteredHistory.length;

        if (results.deletedHistory > 0) {
          await browser.storage.local.set({ summaryHistory: filteredHistory });
        }
      }

      // Pulisci cache LRU — import lazy per evitare dipendenza circolare
      const { CacheManager } = await import('./cache-manager.js');
      const cacheManager = new CacheManager();
      results.cleanedCache = await cacheManager.cleanLRU(maxCacheEntries);

      return results;
    } catch (error) {
      Logger.error("Errore nell'auto cleanup:", error);
      return results;
    }
  }
}
