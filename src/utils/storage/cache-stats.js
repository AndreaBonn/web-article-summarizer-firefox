// Cache Stats - Statistiche, log e telemetria della cache
import { Logger } from '../core/logger.js';

export class CacheStats {
  /**
   * Ottieni statistiche cache
   */
  async getStats() {
    try {
      const result = await browser.storage.local.get(['summaryCache', 'cacheLogs']);
      const cache = result.summaryCache || {};
      const logs = result.cacheLogs || [];

      const entries = Object.values(cache);
      const now = Date.now();

      const totalEntries = entries.length;
      const expiredEntries = entries.filter((e) => now > e.expiresAt).length;
      const validEntries = totalEntries - expiredEntries;

      const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
      const avgHits = totalEntries > 0 ? (totalHits / totalEntries).toFixed(1) : 0;

      // Calcola hit rate dai log
      const recentLogs = logs.slice(-100);
      const reads = recentLogs.filter((l) => l.operation === 'read');
      const hits = reads.filter((l) => l.success).length;
      const hitRate = reads.length > 0 ? ((hits / reads.length) * 100).toFixed(1) : 0;

      // Calcola dimensione approssimativa
      const sizeBytes = new Blob([JSON.stringify(cache)]).size;
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

      // Entry più popolari
      const topEntries = entries
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 5)
        .map((e) => ({
          url: e.url,
          provider: e.provider,
          hits: e.hits,
          age: this.formatAge(now - e.timestamp),
        }));

      return {
        totalEntries,
        validEntries,
        expiredEntries,
        totalHits,
        avgHits: parseFloat(avgHits),
        hitRate: parseFloat(hitRate),
        sizeMB: parseFloat(sizeMB),
        topEntries,
      };
    } catch (error) {
      Logger.error('Errore nel calcolare statistiche cache:', error);
      return null;
    }
  }

  /**
   * Formatta età in formato leggibile
   */
  formatAge(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}g`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }

  /**
   * Log operazione cache per telemetria
   */
  async logCacheOperation(operation, key, success, reason = null) {
    try {
      const result = await browser.storage.local.get(['cacheLogs']);
      const logs = result.cacheLogs || [];

      logs.push({
        operation,
        key,
        success,
        reason,
        timestamp: Date.now(),
      });

      // Mantieni solo gli ultimi 200 log
      if (logs.length > 200) {
        logs.shift();
      }

      await browser.storage.local.set({ cacheLogs: logs });
    } catch (error) {
      Logger.error('Errore nel salvare log cache:', error);
    }
  }

  /**
   * Pulisci tutti i log
   */
  async clearLogs() {
    await browser.storage.local.remove(['cacheLogs']);
  }
}
