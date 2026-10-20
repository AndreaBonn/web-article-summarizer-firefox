// Options Script - Gestione impostazioni
import { Logger } from '../../utils/core/logger.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { APIResilience } from '../../utils/ai/api-resilience.js';
import { CacheManager } from '../../utils/storage/cache-manager.js';
import { AutoMaintenance } from '../../utils/core/auto-maintenance.js';
import { Modal } from '../../utils/core/modal.js';
import { Toast } from '../../utils/core/toast.js';
import { ThemeManager } from '../../utils/core/theme-manager.js';
import { eventCleanup } from '../../utils/core/event-cleanup.js';
import { loadApiKeys, bindKeyInputs, focusProviderFromHash } from './options-keys.js';
import {
  computeUsageSummary,
  createSerialQueue,
  applyPreferences,
  applyPerformanceSettings,
  formatPerformanceStats,
} from './options-stats.js';

const STATS_REFRESH_MS = 30000;
// Same limits the background maintenance applies
const HISTORY_RETENTION_DAYS = 180;
const MAX_CACHE_ENTRIES = 100;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await I18n.initPage();

    document.getElementById('appVersion').textContent = `v${browser.runtime.getManifest().version}`;

    await loadSettings();
    await loadApiKeys();
    await loadStats();
    await loadPerformanceStats();

    bindKeyInputs();
    bindAutosave();
    eventCleanup.addEventListener(document.getElementById('clearCacheBtn'), 'click', clearCache);
    eventCleanup.addEventListener(document.getElementById('clearLogsBtn'), 'click', clearLogs);
    eventCleanup.addEventListener(document.getElementById('runCleanupBtn'), 'click', runCleanup);
    eventCleanup.addEventListener(document.querySelector('[data-theme-toggle]'), 'click', () =>
      ThemeManager.toggle(),
    );
    eventCleanup.addEventListener(document.getElementById('welcomeStartBtn'), 'click', () => {
      document.getElementById('keysSection').scrollIntoView({ block: 'start' });
      document.getElementById('groqKey').focus();
    });

    applyHash(window.location.hash);
    startStatsRefresh();
  } catch (error) {
    Logger.error('Errore inizializzazione impostazioni:', error);
    showToast(I18n.t('settings.loadError'), 'error');
  }
});

// "#welcome" after install, "#<provider>" from the popup
function applyHash(hash) {
  if (hash === '#welcome') {
    document.getElementById('welcome').classList.remove('hidden');
    return;
  }
  focusProviderFromHash(hash);
}

function startStatsRefresh() {
  let statsInterval = null;
  const start = () => {
    statsInterval = setInterval(async () => {
      if (!document.hidden) await loadPerformanceStats();
    }, STATS_REFRESH_MS);
  };
  start();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(statsInterval);
      statsInterval = null;
    } else if (!statsInterval) {
      start();
    }
  });
}

async function loadSettings() {
  try {
    const settings = await StorageManager.getSettings();

    document.getElementById('defaultProvider').value = settings.selectedProvider;
    document.getElementById('saveHistory').checked = settings.saveHistory;

    document.getElementById('enableCache').checked = settings.enableCache !== false;
    document.getElementById('cacheTTL').value = settings.cacheTTL || 7;
    document.getElementById('enableFallback').checked = settings.enableFallback || false;
    document.getElementById('autoCleanup').checked = settings.autoCleanup !== false;
  } catch (error) {
    Logger.error('Errore caricamento impostazioni:', error);
    showToast(I18n.t('settings.error.loadDefaults'), 'error');
  }
}

// Saves run one after the other: two quick changes both read-modify-write `settings`,
// and in parallel the second would overwrite the first
const queueSave = createSerialQueue();

// Every preference saves itself on change: no section loses edits to another's save button
function bindAutosave() {
  ['defaultProvider', 'saveHistory'].forEach((id) => {
    eventCleanup.addEventListener(document.getElementById(id), 'change', () =>
      queueSave(savePreferences),
    );
  });
  ['enableCache', 'cacheTTL', 'enableFallback', 'autoCleanup'].forEach((id) => {
    eventCleanup.addEventListener(document.getElementById(id), 'change', () =>
      queueSave(savePerformanceSettings),
    );
  });
}

async function savePreferences() {
  try {
    const settings = applyPreferences(await StorageManager.getSettings(), {
      defaultProvider: document.getElementById('defaultProvider'),
      saveHistory: document.getElementById('saveHistory'),
    });

    await StorageManager.saveSettings(settings);
    showToast(I18n.t('settings.toast.autosaved'), 'success');
  } catch (error) {
    Logger.error('Errore salvataggio impostazioni:', error);
    showToast(I18n.t('settings.error.saveFailed'), 'error');
  }
}

async function savePerformanceSettings() {
  try {
    const settings = applyPerformanceSettings(await StorageManager.getSettings(), {
      enableCache: document.getElementById('enableCache'),
      cacheTTL: document.getElementById('cacheTTL'),
      enableFallback: document.getElementById('enableFallback'),
      autoCleanup: document.getElementById('autoCleanup'),
    });

    await StorageManager.saveSettings(settings);

    const cacheManager = new CacheManager();
    cacheManager.setDefaultTTL(settings.cacheTTL);

    showToast(I18n.t('settings.toast.autosaved'), 'success');
    await loadPerformanceStats();
  } catch (error) {
    Logger.error('Errore salvataggio impostazioni performance:', error);
    showToast(I18n.t('settings.error.saveFailed'), 'error');
  }
}

async function loadStats() {
  try {
    const result = await browser.storage.local.get(['stats']);
    const summary = computeUsageSummary(result.stats);
    document.getElementById('totalSummaries').textContent = summary.totalSummaries;
    document.getElementById('totalWords').textContent = summary.totalWordsLabel;
    if (summary.mostUsedProvider !== undefined) {
      document.getElementById('mostUsedProvider').textContent = summary.mostUsedProvider;
    }
    document.getElementById('timeSaved').textContent = summary.timeSavedLabel;
  } catch (error) {
    Logger.error('Errore caricamento statistiche:', error);
    ['totalSummaries', 'totalWords', 'mostUsedProvider', 'timeSaved'].forEach((id) => {
      document.getElementById(id).textContent = '—';
    });
  }
}

async function loadPerformanceStats() {
  try {
    const cacheStats = await new CacheManager().getStats();
    displayPerformanceStats({ cacheStats });

    const apiStats = await new APIResilience().getStats();
    displayPerformanceStats({ apiStats });
  } catch (error) {
    Logger.error('Errore nel caricare statistiche performance:', error);
  }
}

function displayPerformanceStats(stats) {
  Object.entries(formatPerformanceStats(stats)).forEach(([id, text]) => {
    document.getElementById(id).textContent = text;
  });
}

async function runCleanup() {
  showToast(I18n.t('settings.cleanup.running'), 'info');

  try {
    const deletedHistory = await new AutoMaintenance().deleteOldHistory(HISTORY_RETENTION_DAYS);
    const cleanedCache = await new CacheManager().cleanLRU(MAX_CACHE_ENTRIES);

    const message = I18n.tf('settings.cleanup.completed', { deletedHistory, cleanedCache });
    showToast(message, 'success');
    await loadPerformanceStats();
  } catch (error) {
    Logger.error('Errore cleanup:', error);
    showToast(I18n.t('settings.cleanup.error'), 'error');
  }
}

async function clearCache() {
  const confirmed = await Modal.confirm(
    I18n.t('settings.cache.confirmClear'),
    I18n.t('settings.cache.clearTitle'),
  );
  if (confirmed) {
    await new CacheManager().clearAll();
    showToast(I18n.t('settings.cache.cleared'), 'success');
    await loadPerformanceStats();
  }
}

async function clearLogs() {
  const confirmed = await Modal.confirm(
    I18n.t('settings.logs.confirmClear'),
    I18n.t('settings.logs.clearTitle'),
  );
  if (confirmed) {
    await new APIResilience().clearLogs();
    await new CacheManager().clearLogs();
    showToast(I18n.t('settings.logs.cleared'), 'success');
    await loadPerformanceStats();
  }
}

function showToast(message, type = 'success') {
  Toast.show(message, type);
}
