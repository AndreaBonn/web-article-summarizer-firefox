const WORDS_PER_MINUTE = 225;

export function computeUsageSummary(stats) {
  stats = stats || { totalSummaries: 0, totalWords: 0, providerUsage: {}, totalTime: 0 };
  const totalSummaries = stats.totalSummaries;
  const totalWordsLabel = stats.totalWords.toLocaleString();
  const providers = Object.entries(stats.providerUsage);
  let mostUsedProvider;
  if (providers.length > 0) {
    const mostUsed = providers.reduce((a, b) => (a[1] > b[1] ? a : b));
    mostUsedProvider = mostUsed[0];
  }
  const minutesSaved = Math.floor(stats.totalWords / WORDS_PER_MINUTE);
  const hoursSaved = (minutesSaved / 60).toFixed(1);
  const timeSavedLabel = `${hoursSaved}h`;
  return { totalSummaries, totalWordsLabel, mostUsedProvider, timeSavedLabel };
}

export function createSerialQueue() {
  let saveQueue = Promise.resolve();
  return function enqueue(save) {
    saveQueue = saveQueue.then(save, save);
    return saveQueue;
  };
}

export function applyPreferences(previousSettings, form) {
  const settings = { ...previousSettings };
  settings.selectedProvider = form.defaultProvider.value;
  settings.summaryLength = 'detailed';
  settings.tone = 'neutral';
  settings.saveHistory = form.saveHistory.checked;
  return settings;
}

export function applyPerformanceSettings(previousSettings, form) {
  const settings = { ...previousSettings };
  settings.enableCache = form.enableCache.checked;
  settings.cacheTTL = parseInt(form.cacheTTL.value);
  settings.enableFallback = form.enableFallback.checked;
  settings.enableCompression = form.enableCompression.checked;
  settings.autoCleanup = form.autoCleanup.checked;
  return settings;
}

export function formatPerformanceStats({ cacheStats, apiStats, compressionStats }) {
  const labels = {};
  if (cacheStats) {
    labels.cacheEntries = cacheStats.validEntries;
    labels.cacheHitRate = cacheStats.hitRate + '%';
    labels.cacheSize = cacheStats.sizeMB + ' MB';
    labels.cacheSaved = cacheStats.totalHits;
  }
  if (apiStats) {
    labels.apiSuccessRate = apiStats.successRate + '%';
    labels.apiRetries = apiStats.retryCount;
    labels.apiFallbacks = apiStats.fallbackCount;
    labels.apiFailures = apiStats.failureCount;
  }
  if (compressionStats) {
    labels.compressedItems = compressionStats.compressedItems;
    labels.compressionRatio = compressionStats.compressionRatio + '%';
    labels.spaceSaved = compressionStats.savedMB + ' MB';
    labels.totalSize = compressionStats.totalCompressedSize;
  }
  return labels;
}
