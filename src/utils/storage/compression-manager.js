// Compression Manager - Facade che compone CompressionMaintenance + statistiche
import { Logger } from '../core/logger.js';
import { CompressionMaintenance } from './compression-maintenance.js';

export class CompressionManager extends CompressionMaintenance {
  /**
   * Ottieni statistiche compressione
   */
  async getStats() {
    try {
      const result = await browser.storage.local.get(['summaryHistory', 'summaryCache']);
      const history = result.summaryHistory || [];
      const cache = result.summaryCache || {};

      let totalOriginalSize = 0;
      let totalCompressedSize = 0;
      let compressedItems = 0;
      let uncompressedItems = 0;

      // Analizza cronologia
      for (const entry of history) {
        if (entry.compressed) {
          totalOriginalSize += entry.originalSize || 0;
          totalCompressedSize += entry.compressedSize || 0;
          compressedItems++;
        } else {
          const size = JSON.stringify(entry.summary || '').length;
          totalOriginalSize += size;
          totalCompressedSize += size;
          uncompressedItems++;
        }
      }

      // Analizza cache
      for (const entry of Object.values(cache)) {
        if (entry.data && entry.data.compressed) {
          totalOriginalSize += entry.data.originalSize || 0;
          totalCompressedSize += entry.data.compressedSize || 0;
          compressedItems++;
        } else {
          const size = JSON.stringify(entry.data || '').length;
          totalOriginalSize += size;
          totalCompressedSize += size;
          uncompressedItems++;
        }
      }

      const savedBytes = totalOriginalSize - totalCompressedSize;
      const savedMB = (savedBytes / (1024 * 1024)).toFixed(2);
      const compressionRatio =
        totalOriginalSize > 0
          ? ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(1)
          : 0;

      return {
        compressedItems,
        uncompressedItems,
        totalItems: compressedItems + uncompressedItems,
        totalOriginalSize: (totalOriginalSize / (1024 * 1024)).toFixed(2) + ' MB',
        totalCompressedSize: (totalCompressedSize / (1024 * 1024)).toFixed(2) + ' MB',
        savedMB: parseFloat(savedMB),
        compressionRatio: parseFloat(compressionRatio),
      };
    } catch (error) {
      Logger.error('Errore nel calcolare statistiche compressione:', error);
      return null;
    }
  }
}
