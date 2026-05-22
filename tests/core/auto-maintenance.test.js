import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

vi.mock('@utils/storage/cache-manager.js', () => ({
  CacheManager: class {
    cleanExpired() {
      return Promise.resolve(5);
    }
    cleanLRU() {
      return Promise.resolve(3);
    }
  },
}));

vi.mock('@utils/storage/compression-manager.js', () => ({
  CompressionManager: class {
    compressOldHistory() {
      return Promise.resolve(2);
    }
    compressOldCache() {
      return Promise.resolve(1);
    }
  },
}));

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
  alarms: {
    create: vi.fn().mockResolvedValue(undefined),
  },
};

import { AutoMaintenance } from '@utils/core/auto-maintenance.js';

describe('AutoMaintenance', () => {
  let maintenance;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
    maintenance = new AutoMaintenance();
  });

  describe('shouldRunMaintenance()', () => {
    it('test_shouldRunMaintenance_firstTime_returnsTrue', async () => {
      expect(await maintenance.shouldRunMaintenance()).toBe(true);
    });

    it('test_shouldRunMaintenance_recentRun_returnsFalse', async () => {
      store.lastMaintenanceRun = Date.now();
      expect(await maintenance.shouldRunMaintenance()).toBe(false);
    });

    it('test_shouldRunMaintenance_oldRun_returnsTrue', async () => {
      store.lastMaintenanceRun = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      expect(await maintenance.shouldRunMaintenance()).toBe(true);
    });

    it('test_shouldRunMaintenance_storageError_returnsFalse', async () => {
      browser.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
      expect(await maintenance.shouldRunMaintenance()).toBe(false);
    });
  });

  describe('getSettings()', () => {
    it('test_getSettings_noSettings_returnsDefaults', async () => {
      const settings = await maintenance.getSettings();
      expect(settings).toEqual({ autoCleanup: true, enableCompression: true });
    });

    it('test_getSettings_customSettings_returnsStored', async () => {
      store.settings = { autoCleanup: false, enableCompression: false };
      const settings = await maintenance.getSettings();
      expect(settings.autoCleanup).toBe(false);
    });

    it('test_getSettings_error_returnsSafeDefaults', async () => {
      browser.storage.local.get.mockRejectedValueOnce(new Error('fail'));
      const settings = await maintenance.getSettings();
      expect(settings).toEqual({ autoCleanup: false, enableCompression: false });
    });
  });

  describe('deleteOldHistory()', () => {
    it('test_deleteOldHistory_noHistory_returnsZero', async () => {
      const count = await maintenance.deleteOldHistory(180);
      expect(count).toBe(0);
    });

    it('test_deleteOldHistory_allRecent_deletesNone', async () => {
      store.summaryHistory = [{ timestamp: Date.now() }, { timestamp: Date.now() - 1000 }];
      const count = await maintenance.deleteOldHistory(180);
      expect(count).toBe(0);
    });

    it('test_deleteOldHistory_someOld_deletesOldOnes', async () => {
      const now = Date.now();
      store.summaryHistory = [
        { timestamp: now },
        { timestamp: now - 200 * 24 * 60 * 60 * 1000 }, // 200 days ago
      ];
      const count = await maintenance.deleteOldHistory(180);
      expect(count).toBe(1);
      expect(store.summaryHistory).toHaveLength(1);
    });

    it('test_deleteOldHistory_storageError_returnsZero', async () => {
      browser.storage.local.get.mockRejectedValueOnce(new Error('fail'));
      const count = await maintenance.deleteOldHistory(180);
      expect(count).toBe(0);
    });
  });

  describe('runMaintenance()', () => {
    it('test_runMaintenance_autoCleanupEnabled_runsAllSteps', async () => {
      store.settings = { autoCleanup: true, enableCompression: true };
      const results = await maintenance.runMaintenance();

      expect(results.cacheExpired).toBe(5);
      expect(results.cacheLRU).toBe(3);
      expect(results.historyCompressed).toBe(2);
      expect(results.cacheCompressed).toBe(1);
      expect(results.errors).toEqual([]);
      expect(store.lastMaintenanceRun).toBeDefined();
    });

    it('test_runMaintenance_autoCleanupDisabled_skips', async () => {
      store.settings = { autoCleanup: false };
      const result = await maintenance.runMaintenance();
      expect(result).toBeUndefined();
    });
  });

  describe('handleAlarm()', () => {
    it('test_handleAlarm_correctName_runsMaintenance', async () => {
      store.settings = { autoCleanup: true, enableCompression: false };
      await maintenance.handleAlarm({ name: 'autoMaintenance' });
      expect(store.lastMaintenanceRun).toBeDefined();
    });

    it('test_handleAlarm_wrongName_doesNothing', async () => {
      await maintenance.handleAlarm({ name: 'otherAlarm' });
      expect(store.lastMaintenanceRun).toBeUndefined();
    });
  });

  describe('getLastMaintenanceStats()', () => {
    it('test_getLastMaintenanceStats_noData_returnsNulls', async () => {
      const stats = await maintenance.getLastMaintenanceStats();
      expect(stats.lastRun).toBeUndefined();
      expect(stats.nextRun).toBeNull();
    });

    it('test_getLastMaintenanceStats_withData_calculatesNextRun', async () => {
      const now = Date.now();
      store.lastMaintenanceRun = now;
      store.lastMaintenanceResults = { cacheExpired: 3 };

      const stats = await maintenance.getLastMaintenanceStats();
      expect(stats.lastRun).toBe(now);
      expect(stats.nextRun).toBe(now + 24 * 60 * 60 * 1000);
      expect(stats.results.cacheExpired).toBe(3);
    });
  });

  describe('scheduleMaintenance()', () => {
    it('test_scheduleMaintenance_createsAlarm', async () => {
      await maintenance.scheduleMaintenance();
      expect(browser.alarms.create).toHaveBeenCalledWith('autoMaintenance', {
        periodInMinutes: 1440,
      });
    });
  });
});
