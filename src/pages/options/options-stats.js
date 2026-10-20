const WORDS_PER_MINUTE = 225;
const DEFAULT_CACHE_TTL_DAYS = 7;

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
  const ttl = parseInt(form.cacheTTL.value, 10);
  if (ttl > 0) {
    settings.cacheTTL = ttl;
  } else if (!(settings.cacheTTL > 0)) {
    // Same default the options page shows when no TTL is stored.
    settings.cacheTTL = DEFAULT_CACHE_TTL_DAYS;
  }
  settings.autoCleanup = form.autoCleanup.checked;
  return settings;
}

export function formatPerformanceStats({ cacheStats }) {
  const labels = {};
  if (cacheStats) {
    labels.cacheEntries = cacheStats.validEntries;
    labels.cacheHitRate = cacheStats.hitRate + '%';
    labels.cacheSize = cacheStats.sizeMB + ' MB';
    labels.cacheSaved = cacheStats.totalHits;
  }
  return labels;
}
