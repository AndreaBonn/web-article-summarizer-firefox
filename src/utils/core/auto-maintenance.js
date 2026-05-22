// Auto Maintenance - Cleanup automatico in background
import { CacheManager } from '../storage/cache-manager.js';
import { CompressionManager } from '../storage/compression-manager.js';
import { Logger } from '../core/logger.js';

export class AutoMaintenance {
  constructor() {
    this.maintenanceInterval = 24 * 60 * 60 * 1000; // 24 ore
    this.lastMaintenanceKey = 'lastMaintenanceRun';
  }

  /**
   * Inizializza il sistema di manutenzione automatica
   */
  async initialize() {
    // Controlla se è necessario eseguire la manutenzione
    const shouldRun = await this.shouldRunMaintenance();

    if (shouldRun) {
      await this.runMaintenance();
    }

    // Programma la prossima manutenzione
    this.scheduleMaintenance();
  }

  /**
   * Controlla se è necessario eseguire la manutenzione
   */
  async shouldRunMaintenance() {
    try {
      const result = await browser.storage.local.get([this.lastMaintenanceKey]);
      const lastRun = result[this.lastMaintenanceKey];

      if (!lastRun) {
        return true; // Prima esecuzione
      }

      const timeSinceLastRun = Date.now() - lastRun;
      return timeSinceLastRun >= this.maintenanceInterval;
    } catch (error) {
      Logger.error('Errore nel controllare ultima manutenzione:', error);
      return false;
    }
  }

  /**
   * Esegue la manutenzione completa
   */
  async runMaintenance() {
    Logger.debug('Avvio manutenzione automatica...');

    try {
      // Ottieni impostazioni
      const settings = await this.getSettings();

      if (!settings.autoCleanup) {
        Logger.debug('Auto cleanup disabilitato, skip manutenzione');
        return;
      }

      const results = {
        timestamp: Date.now(),
        cacheExpired: 0,
        cacheLRU: 0,
        historyCompressed: 0,
        cacheCompressed: 0,
        historyDeleted: 0,
        errors: [],
      };

      // 1. Pulisci cache scadute
      try {
        const cacheManager = new CacheManager();
        results.cacheExpired = await cacheManager.cleanExpired();
        Logger.debug(`Cache scadute pulite: ${results.cacheExpired}`);
      } catch (error) {
        Logger.error('Errore pulizia cache scadute:', error);
        results.errors.push({ step: 'cleanExpired', error: error.message });
      }

      // 2. Pulisci cache LRU
      try {
        const cacheManager = new CacheManager();
        results.cacheLRU = await cacheManager.cleanLRU(100);
        Logger.info(`Cache LRU pulite: ${results.cacheLRU}`);
      } catch (error) {
        Logger.error('Errore pulizia cache LRU:', error);
        results.errors.push({ step: 'cleanLRU', error: error.message });
      }

      // 3. Comprimi dati vecchi (se abilitato)
      if (settings.enableCompression) {
        try {
          const compressionManager = new CompressionManager();

          // Comprimi cronologia > 30 giorni
          results.historyCompressed = await compressionManager.compressOldHistory(30);
          Logger.info(`Cronologie compresse: ${results.historyCompressed}`);

          // Comprimi cache > 7 giorni
          results.cacheCompressed = await compressionManager.compressOldCache(7);
          Logger.info(`Cache compresse: ${results.cacheCompressed}`);
        } catch (error) {
          Logger.error('Errore compressione:', error);
          results.errors.push({ step: 'compression', error: error.message });
        }
      }

      // 4. Elimina cronologia molto vecchia (> 180 giorni)
      try {
        results.historyDeleted = await this.deleteOldHistory(180);
        Logger.info(`Cronologie eliminate: ${results.historyDeleted}`);
      } catch (error) {
        Logger.error('Errore eliminazione cronologia:', error);
        results.errors.push({ step: 'deleteHistory', error: error.message });
      }

      // Salva timestamp ultima manutenzione
      await browser.storage.local.set({
        [this.lastMaintenanceKey]: Date.now(),
        lastMaintenanceResults: results,
      });

      Logger.info('Manutenzione completata:', results);

      return results;
    } catch (error) {
      Logger.error('Errore durante manutenzione:', error);
      throw error;
    }
  }

  /**
   * Elimina cronologia vecchia
   */
  async deleteOldHistory(daysOld) {
    try {
      const result = await browser.storage.local.get(['summaryHistory']);
      const history = result.summaryHistory || [];

      const cutoffDate = Date.now() - daysOld * 24 * 60 * 60 * 1000;
      const filteredHistory = history.filter((entry) => entry.timestamp >= cutoffDate);

      const deletedCount = history.length - filteredHistory.length;

      if (deletedCount > 0) {
        await browser.storage.local.set({ summaryHistory: filteredHistory });
      }

      return deletedCount;
    } catch (error) {
      Logger.error('Errore eliminazione cronologia:', error);
      return 0;
    }
  }

  /**
   * Ottieni impostazioni
   */
  async getSettings() {
    try {
      const result = await browser.storage.local.get(['settings']);
      return (
        result.settings || {
          autoCleanup: true,
          enableCompression: true,
        }
      );
    } catch (error) {
      Logger.error('Errore lettura impostazioni:', error);
      // Safe fallback: do nothing rather than risk unwanted cleanup
      return {
        autoCleanup: false,
        enableCompression: false,
      };
    }
  }

  /**
   * Programma la prossima manutenzione via browser.alarms (persistente in MV3)
   */
  async scheduleMaintenance() {
    if (typeof browser !== 'undefined' && browser.alarms) {
      try {
        await browser.alarms.create('autoMaintenance', {
          periodInMinutes: this.maintenanceInterval / 60000,
        });
      } catch (error) {
        Logger.warn('Impossibile schedulare manutenzione automatica:', error);
      }
    }
  }

  /**
   * Handler per l'alarm — da registrare nel service worker
   */
  async handleAlarm(alarm) {
    if (alarm.name !== 'autoMaintenance') return;

    try {
      await this.runMaintenance();
    } catch (error) {
      Logger.error('Manutenzione automatica fallita:', error);
    }
  }

  /**
   * Ottieni statistiche ultima manutenzione
   */
  async getLastMaintenanceStats() {
    try {
      const result = await browser.storage.local.get([
        'lastMaintenanceResults',
        this.lastMaintenanceKey,
      ]);

      return {
        lastRun: result[this.lastMaintenanceKey],
        results: result.lastMaintenanceResults,
        nextRun: result[this.lastMaintenanceKey]
          ? result[this.lastMaintenanceKey] + this.maintenanceInterval
          : null,
      };
    } catch (error) {
      Logger.error('Errore lettura statistiche manutenzione:', error);
      return null;
    }
  }

  /**
   * Forza esecuzione manutenzione
   */
  async forceRun() {
    return await this.runMaintenance();
  }
}
