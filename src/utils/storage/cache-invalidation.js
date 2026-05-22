// Cache Invalidation - Invalidazione selettiva e pulizia cache
import { Logger } from '../core/logger.js';

export class CacheInvalidation {
  /**
   * Invalida tutte le entry per un URL specifico
   * @param {string} normalizedUrl - URL già normalizzato
   * @param {Function} normalizeUrl - Funzione di normalizzazione URL
   */
  async invalidateByUrl(normalizedUrl, normalizeUrl) {
    try {
      const result = await browser.storage.local.get(['summaryCache']);
      const cache = result.summaryCache || {};

      let invalidatedCount = 0;

      for (const [key, entry] of Object.entries(cache)) {
        if (normalizeUrl(entry.url) === normalizedUrl) {
          delete cache[key];
          invalidatedCount++;
        }
      }

      if (invalidatedCount > 0) {
        await browser.storage.local.set({ summaryCache: cache });
      }

      return invalidatedCount;
    } catch (error) {
      Logger.error("Errore nell'invalidare cache per URL:", error);
      return 0;
    }
  }

  /**
   * Invalida cache per URL se il contenuto è cambiato
   * @param {string} normalizedUrl - URL già normalizzato
   * @param {string} newContentHash - Nuovo hash del contenuto
   * @param {Function} normalizeUrl - Funzione di normalizzazione URL
   */
  async invalidateIfContentChanged(normalizedUrl, newContentHash, normalizeUrl) {
    try {
      const result = await browser.storage.local.get(['summaryCache']);
      const cache = result.summaryCache || {};

      let invalidatedCount = 0;

      for (const [key, entry] of Object.entries(cache)) {
        if (normalizeUrl(entry.url) === normalizedUrl) {
          if (entry.contentHash && entry.contentHash !== newContentHash) {
            delete cache[key];
            invalidatedCount++;
          }
        }
      }

      if (invalidatedCount > 0) {
        await browser.storage.local.set({ summaryCache: cache });
      }

      return invalidatedCount;
    } catch (error) {
      Logger.error("Errore nell'invalidare cache per contenuto:", error);
      return 0;
    }
  }

  /**
   * Pulisci cache scadute
   */
  async cleanExpired() {
    try {
      const result = await browser.storage.local.get(['summaryCache']);
      const cache = result.summaryCache || {};

      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, entry] of Object.entries(cache)) {
        if (now > entry.expiresAt) {
          delete cache[key];
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        await browser.storage.local.set({ summaryCache: cache });
      }

      return cleanedCount;
    } catch (error) {
      Logger.error('Errore nella pulizia cache:', error);
      return 0;
    }
  }

  /**
   * Pulisci cache LRU (Least Recently Used)
   */
  async cleanLRU(maxEntries = 100) {
    try {
      const result = await browser.storage.local.get(['summaryCache']);
      const cache = result.summaryCache || {};

      const entries = Object.entries(cache);

      if (entries.length <= maxEntries) {
        return 0;
      }

      // Ordina per lastAccessed (più vecchi prima)
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      const toRemove = entries.length - maxEntries;
      const newCache = {};

      for (let i = toRemove; i < entries.length; i++) {
        newCache[entries[i][0]] = entries[i][1];
      }

      await browser.storage.local.set({ summaryCache: newCache });

      return toRemove;
    } catch (error) {
      Logger.error('Errore nella pulizia LRU:', error);
      return 0;
    }
  }
}
