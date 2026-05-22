// Options Script - Gestione impostazioni
import { Logger } from '../../utils/core/logger.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { APIResilience } from '../../utils/ai/api-resilience.js';
import { CacheManager } from '../../utils/storage/cache-manager.js';
import { CompressionManager } from '../../utils/storage/compression-manager.js';
import { Modal } from '../../utils/core/modal.js';
import { eventCleanup } from '../../utils/core/event-cleanup.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await I18n.initPage();

    await loadSettings();
    await loadApiKeys();
    await loadStats();
    await loadPerformanceStats();

    // Event listeners (managed via eventCleanup for consistency)
    eventCleanup.addEventListener(document.getElementById('saveKeysBtn'), 'click', saveApiKeys);
    eventCleanup.addEventListener(
      document.getElementById('saveSettingsBtn'),
      'click',
      saveSettings,
    );
    eventCleanup.addEventListener(
      document.getElementById('savePerformanceBtn'),
      'click',
      savePerformanceSettings,
    );
    eventCleanup.addEventListener(document.getElementById('clearCacheBtn'), 'click', clearCache);
    eventCleanup.addEventListener(document.getElementById('clearLogsBtn'), 'click', clearLogs);
    eventCleanup.addEventListener(document.getElementById('runCleanupBtn'), 'click', runCleanup);

    // Test API keys
    document.querySelectorAll('.btn-test').forEach((btn) => {
      eventCleanup.addEventListener(btn, 'click', () => testApiKey(btn.dataset.provider));
    });

    // Applica tema in tempo reale quando cambia il checkbox
    eventCleanup.addEventListener(document.getElementById('darkMode'), 'change', (e) => {
      applyTheme(e.target.checked);
    });

    // Refresh stats ogni 30 secondi, solo quando la pagina è visibile
    let statsInterval = setInterval(async () => {
      if (!document.hidden) {
        await loadPerformanceStats();
      }
    }, 30000);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearInterval(statsInterval);
        statsInterval = null;
      } else if (!statsInterval) {
        statsInterval = setInterval(async () => {
          if (!document.hidden) {
            await loadPerformanceStats();
          }
        }, 30000);
      }
    });
  } catch (error) {
    Logger.error('Errore inizializzazione impostazioni:', error);
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = 'Errore durante il caricamento. Ricarica la pagina.';
      toast.className = 'toast error';
    }
  }
});

async function loadSettings() {
  try {
    const settings = await StorageManager.getSettings();

    document.getElementById('defaultProvider').value = settings.selectedProvider;
    document.getElementById('saveHistory').checked = settings.saveHistory;
    document.getElementById('darkMode').checked = settings.darkMode || false;

    // Performance settings
    document.getElementById('enableCache').checked = settings.enableCache !== false;
    document.getElementById('cacheTTL').value = settings.cacheTTL || 7;
    document.getElementById('enableFallback').checked = settings.enableFallback || false;
    document.getElementById('enableCompression').checked = settings.enableCompression !== false;
    document.getElementById('autoCleanup').checked = settings.autoCleanup !== false;

    // Applica il tema
    applyTheme(settings.darkMode);
  } catch (error) {
    Logger.error('Errore caricamento impostazioni:', error);
    showToast('Impossibile caricare le impostazioni. Valori predefiniti applicati.', 'error');
  }
}

async function loadApiKeys() {
  const providers = ['groq', 'openai', 'anthropic', 'gemini'];

  for (const provider of providers) {
    try {
      const key = await StorageManager.getApiKey(provider);
      if (key) {
        const input = document.getElementById(`${provider}Key`);
        // Mostra solo gli ultimi 4 caratteri per sicurezza
        const masked = '\u2022'.repeat(Math.max(0, key.length - 4)) + key.slice(-4);
        input.value = masked;
        input.dataset.masked = 'true';
        // Al focus, se ancora mascherato, svuota per nuovo inserimento
        input.addEventListener(
          'focus',
          function onFocus() {
            if (this.dataset.masked === 'true') {
              this.value = '';
              this.dataset.masked = 'false';
            }
          },
          { once: true },
        );
        showStatus(provider, 'success', I18n.t('settings.status.configured'));
      }
    } catch (error) {
      Logger.warn(`API key ${provider} in formato obsoleto:`, error.message);
      showStatus(provider, 'error', error.message);
    }
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

    // Provider più usato
    const providers = Object.entries(stats.providerUsage);
    if (providers.length > 0) {
      const mostUsed = providers.reduce((a, b) => (a[1] > b[1] ? a : b));
      document.getElementById('mostUsedProvider').textContent = mostUsed[0];
    }

    // Tempo risparmiato (assumendo 225 parole/min)
    const minutesSaved = Math.floor(stats.totalWords / 225);
    const hoursSaved = (minutesSaved / 60).toFixed(1);
    document.getElementById('timeSaved').textContent = `${hoursSaved}h`;
  } catch (error) {
    Logger.error('Errore caricamento statistiche:', error);
    document.getElementById('totalSummaries').textContent = '—';
    document.getElementById('totalWords').textContent = '—';
    document.getElementById('mostUsedProvider').textContent = '—';
    document.getElementById('timeSaved').textContent = '—';
  }
}

const KEY_PREFIXES = {
  groq: 'gsk_',
  openai: 'sk-',
  anthropic: 'sk-ant-',
  gemini: 'AIza',
};

const KEY_MIN_LENGTHS = {
  groq: 40,
  openai: 40,
  anthropic: 50,
  gemini: 35,
};

async function saveApiKeys() {
  const providers = ['groq', 'openai', 'anthropic', 'gemini'];

  try {
    for (const provider of providers) {
      const input = document.getElementById(`${provider}Key`);
      const key = input.value.trim();

      // Non salvare se il campo è ancora mascherato (non modificato dall'utente)
      if (key && input.dataset.masked !== 'true') {
        const expectedPrefix = KEY_PREFIXES[provider];
        if (expectedPrefix && !key.startsWith(expectedPrefix)) {
          showStatus(
            provider,
            'error',
            `Formato non valido: la chiave ${provider} deve iniziare con "${expectedPrefix}"`,
          );
          continue;
        }
        const minLen = KEY_MIN_LENGTHS[provider];
        if (minLen && key.length < minLen) {
          showStatus(provider, 'error', `Chiave troppo corta (minimo ${minLen} caratteri)`);
          continue;
        }
        await StorageManager.saveApiKey(provider, key);
        showStatus(provider, 'success', I18n.t('settings.status.saved'));
      }
    }

    showToast(I18n.t('settings.toast.keysSaved'), 'success');
  } catch (error) {
    Logger.error('Errore salvataggio API keys:', error);
    showToast('Errore nel salvataggio delle chiavi API. Riprova.', 'error');
  }
}

async function saveSettings() {
  try {
    const darkMode = document.getElementById('darkMode').checked;

    // Merge with existing settings to preserve performance settings
    const settings = await StorageManager.getSettings();
    settings.selectedProvider = document.getElementById('defaultProvider').value;
    settings.summaryLength = 'detailed'; // Fisso a dettagliato per massima completezza
    settings.tone = 'neutral'; // Fisso a neutrale
    settings.saveHistory = document.getElementById('saveHistory').checked;
    settings.darkMode = darkMode;

    await StorageManager.saveSettings(settings);
    applyTheme(darkMode);
    showToast(I18n.t('settings.toast.prefSaved'), 'success');
  } catch (error) {
    Logger.error('Errore salvataggio impostazioni:', error);
    showToast('Errore nel salvataggio delle impostazioni. Riprova.', 'error');
  }
}

function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

async function testApiKey(provider) {
  const input = document.getElementById(`${provider}Key`);
  const key = input.value.trim();

  if (!key) {
    showStatus(provider, 'error', I18n.t('settings.test.enterKey'));
    return;
  }

  showStatus(provider, 'loading', I18n.t('settings.test.testing'));

  try {
    const response = await browser.runtime.sendMessage({
      action: 'testApiKey',
      provider: provider,
      apiKey: key,
    });

    if (!response) {
      showStatus(provider, 'error', 'Il servizio non risponde. Riprova.');
      return;
    }
    if (response.success) {
      showStatus(provider, 'success', I18n.t('settings.test.verified'));
    } else {
      showStatus(provider, 'error', `${I18n.t('settings.test.failed')} ${response.error}`);
    }
  } catch (error) {
    Logger.error('Errore test API key:', error);
    showStatus(
      provider,
      'error',
      I18n.t('settings.test.genericError') || 'Errore durante il test. Riprova.',
    );
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

    // Configura TTL cache
    const cacheManager = new CacheManager();
    cacheManager.setDefaultTTL(settings.cacheTTL);

    showToast(I18n.t('settings.toast.perfSaved'), 'success');

    // Refresh stats
    await loadPerformanceStats();
  } catch (error) {
    Logger.error('Errore salvataggio impostazioni performance:', error);
    showToast('Errore nel salvataggio. Riprova.', 'error');
  }
}

async function loadPerformanceStats() {
  try {
    // Cache stats
    const cacheManager = new CacheManager();
    const cacheStats = await cacheManager.getStats();

    if (cacheStats) {
      document.getElementById('cacheEntries').textContent = cacheStats.validEntries;
      document.getElementById('cacheHitRate').textContent = cacheStats.hitRate + '%';
      document.getElementById('cacheSize').textContent = cacheStats.sizeMB + ' MB';
      document.getElementById('cacheSaved').textContent = cacheStats.totalHits;
    }

    // API stats
    const resilience = new APIResilience();
    const apiStats = await resilience.getStats();

    if (apiStats) {
      document.getElementById('apiSuccessRate').textContent = apiStats.successRate + '%';
      document.getElementById('apiRetries').textContent = apiStats.retryCount;
      document.getElementById('apiFallbacks').textContent = apiStats.fallbackCount;
      document.getElementById('apiFailures').textContent = apiStats.failureCount;
    }

    // Compression stats
    const compressionManager = new CompressionManager();
    const compressionStats = await compressionManager.getStats();

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
    const compressionManager = new CompressionManager();
    const results = await compressionManager.autoCleanup({
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

    // Refresh stats
    await loadPerformanceStats();
  } catch (error) {
    Logger.error('Errore cleanup:', error);
    showToast(I18n.t('settings.cleanup.error') || 'Errore durante la pulizia. Riprova.', 'error');
  }
}

async function clearCache() {
  const confirmed = await Modal.confirm(
    I18n.t('settings.cache.confirmClear'),
    I18n.t('settings.cache.clearTitle') || 'Svuota Cache',
  );
  if (confirmed) {
    const cacheManager = new CacheManager();
    await cacheManager.clearAll();
    showToast(I18n.t('settings.cache.cleared'), 'success');
    await loadPerformanceStats();
  }
}

async function clearLogs() {
  const confirmed = await Modal.confirm(
    I18n.t('settings.logs.confirmClear'),
    I18n.t('settings.logs.clearTitle') || 'Svuota Log',
  );
  if (confirmed) {
    const resilience = new APIResilience();
    const cacheManager = new CacheManager();
    await resilience.clearLogs();
    await cacheManager.clearLogs();

    showToast(I18n.t('settings.logs.cleared'), 'success');
    await loadPerformanceStats();
  }
}

function showStatus(provider, type, message) {
  const statusEl = document.getElementById(`${provider}Status`);
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}
