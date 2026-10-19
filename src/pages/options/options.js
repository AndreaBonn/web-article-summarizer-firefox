// Options Script - Gestione impostazioni
import { Logger } from '../../utils/core/logger.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { APIResilience } from '../../utils/ai/api-resilience.js';
import { CacheManager } from '../../utils/storage/cache-manager.js';
import { CompressionManager } from '../../utils/storage/compression-manager.js';
import { Modal } from '../../utils/core/modal.js';
import { Toast } from '../../utils/core/toast.js';
import { ThemeManager } from '../../utils/core/theme-manager.js';
import { eventCleanup } from '../../utils/core/event-cleanup.js';
import { loadApiKeys, bindKeyInputs, focusProviderFromHash } from './options-keys.js';

const STATS_REFRESH_MS = 30000;
const WORDS_PER_MINUTE = 225;

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
    document.getElementById('enableCompression').checked = settings.enableCompression !== false;
    document.getElementById('autoCleanup').checked = settings.autoCleanup !== false;
  } catch (error) {
    Logger.error('Errore caricamento impostazioni:', error);
    showToast(I18n.t('settings.error.loadDefaults'), 'error');
  }
}

// Saves run one after the other: two quick changes both read-modify-write `settings`,
// and in parallel the second would overwrite the first
let saveQueue = Promise.resolve();
function queueSave(save) {
  saveQueue = saveQueue.then(save, save);
  return saveQueue;
}

// Every preference saves itself on change: no section loses edits to another's save button
function bindAutosave() {
  ['defaultProvider', 'saveHistory'].forEach((id) => {
    eventCleanup.addEventListener(document.getElementById(id), 'change', () =>
      queueSave(savePreferences),
    );
  });
  ['enableCache', 'cacheTTL', 'enableFallback', 'enableCompression', 'autoCleanup'].forEach(
    (id) => {
      eventCleanup.addEventListener(document.getElementById(id), 'change', () =>
        queueSave(savePerformanceSettings),
      );
    },
  );
}

async function savePreferences() {
  try {
    const settings = await StorageManager.getSettings();
    settings.selectedProvider = document.getElementById('defaultProvider').value;
    settings.summaryLength = 'detailed'; // Fisso a dettagliato per massima completezza
    settings.tone = 'neutral'; // Fisso a neutrale
    settings.saveHistory = document.getElementById('saveHistory').checked;

    await StorageManager.saveSettings(settings);
    showToast(I18n.t('settings.toast.autosaved'), 'success');
  } catch (error) {
    Logger.error('Errore salvataggio impostazioni:', error);
    showToast(I18n.t('settings.error.saveFailed'), 'error');
  }
}

async function savePerformanceSettings() {
  try {
    const settings = await StorageManager.getSettings();

    settings.enableCache = document.getElementById('enableCache').checked;
    settings.cacheTTL = parseInt(document.getElementById('cacheTTL').value);
    settings.enableFallback = document.getElementById('enableFallback').checked;
    settings.enableCompression = document.getElementById('enableCompression').checked;
    settings.autoCleanup = document.getElementById('autoCleanup').checked;

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
    const stats = result.stats || {
      totalSummaries: 0,
      totalWords: 0,
      providerUsage: {},
      totalTime: 0,
    };

    document.getElementById('totalSummaries').textContent = stats.totalSummaries;
    document.getElementById('totalWords').textContent = stats.totalWords.toLocaleString();

    const providers = Object.entries(stats.providerUsage);
    if (providers.length > 0) {
      const mostUsed = providers.reduce((a, b) => (a[1] > b[1] ? a : b));
      document.getElementById('mostUsedProvider').textContent = mostUsed[0];
    }

    const minutesSaved = Math.floor(stats.totalWords / WORDS_PER_MINUTE);
    const hoursSaved = (minutesSaved / 60).toFixed(1);
    document.getElementById('timeSaved').textContent = `${hoursSaved}h`;
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
    if (cacheStats) {
      document.getElementById('cacheEntries').textContent = cacheStats.validEntries;
      document.getElementById('cacheHitRate').textContent = cacheStats.hitRate + '%';
      document.getElementById('cacheSize').textContent = cacheStats.sizeMB + ' MB';
      document.getElementById('cacheSaved').textContent = cacheStats.totalHits;
    }

    const apiStats = await new APIResilience().getStats();
    if (apiStats) {
      document.getElementById('apiSuccessRate').textContent = apiStats.successRate + '%';
      document.getElementById('apiRetries').textContent = apiStats.retryCount;
      document.getElementById('apiFallbacks').textContent = apiStats.fallbackCount;
      document.getElementById('apiFailures').textContent = apiStats.failureCount;
    }

    const compressionStats = await new CompressionManager().getStats();
    if (compressionStats) {
      document.getElementById('compressedItems').textContent = compressionStats.compressedItems;
      document.getElementById('compressionRatio').textContent =
        compressionStats.compressionRatio + '%';
      document.getElementById('spaceSaved').textContent = compressionStats.savedMB + ' MB';
      document.getElementById('totalSize').textContent = compressionStats.totalCompressedSize;
    }
  } catch (error) {
    Logger.error('Errore nel caricare statistiche performance:', error);
  }
}

async function runCleanup() {
  showToast(I18n.t('settings.cleanup.running'), 'info');

  try {
    const results = await new CompressionManager().autoCleanup({
      compressHistoryOlderThan: 30,
      compressCacheOlderThan: 7,
      deleteHistoryOlderThan: 180,
      maxCacheEntries: 100,
    });

    const message = I18n.tf('settings.cleanup.completed', {
      compressedHistory: results.compressedHistory,
      compressedCache: results.compressedCache,
      deletedHistory: results.deletedHistory,
      cleanedCache: results.cleanedCache,
    });
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
