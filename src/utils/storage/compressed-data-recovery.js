// Undoes the retired history/cache compression: no reader ever decompressed those entries,
// so every summary it touched was unreadable until restored here
import LZString from 'lz-string';
import { Logger } from '../core/logger.js';

const COMPRESSION_FIELDS = ['compressed', 'originalSize', 'compressedSize'];

function withoutCompressionFields(entry) {
  const rest = { ...entry };
  for (const field of COMPRESSION_FIELDS) delete rest[field];
  return rest;
}

/**
 * Returns the history entry with a readable summary, or null when the compressed summary
 * cannot be decoded (the entry is then left untouched by the caller).
 * Entries the old code marked but never compressed (summary under 1 KB) only lose the markers.
 */
export function restoreHistoryEntry(entry) {
  if (entry.compressed !== true) return withoutCompressionFields(entry);
  const summary = LZString.decompressFromUTF16(entry.summary ?? '');
  if (!summary) return null;
  // Corrupt input can decode to plausible garbage: the stored original length catches it
  if (Number.isFinite(entry.originalSize) && summary.length !== entry.originalSize) return null;
  return { ...withoutCompressionFields(entry), summary };
}

export function isMarkedHistoryEntry(entry) {
  return !!entry && typeof entry === 'object' && COMPRESSION_FIELDS.some((field) => field in entry);
}

/**
 * Cache entries rewritten by the old code hold {compressed, data, originalSize, ...} where the
 * cached result used to be, and could even be wrapped more than once. A cache is rebuilt on the
 * next request, so they are dropped instead of decoded.
 */
export function isWrappedCacheEntry(entry) {
  const data = entry?.data;
  return (
    !!data &&
    typeof data === 'object' &&
    typeof data.compressed === 'boolean' &&
    'originalSize' in data
  );
}

/**
 * Restores compressed history summaries and drops wrapped cache entries, writing back only
 * what changed.
 * @returns {Promise<{historyRestored: number, historyUnreadable: number, cacheDropped: number}>}
 */
export async function restoreCompressedData(storage = browser.storage.local) {
  const result = { historyRestored: 0, historyUnreadable: 0, cacheDropped: 0 };
  const { summaryHistory, summaryCache } = await storage.get(['summaryHistory', 'summaryCache']);

  if (Array.isArray(summaryHistory) && summaryHistory.some(isMarkedHistoryEntry)) {
    const restoredById = new Map();
    for (const entry of summaryHistory.filter(isMarkedHistoryEntry)) {
      const fixed = restoreHistoryEntry(entry);
      if (fixed === null) result.historyUnreadable++;
      else restoredById.set(entry.id, fixed);
    }
    result.historyRestored = restoredById.size;
    if (restoredById.size > 0) {
      // Re-read just before writing so a summary saved meanwhile by a page is not overwritten
      const fresh = (await storage.get(['summaryHistory'])).summaryHistory ?? [];
      await storage.set({
        summaryHistory: fresh.map((entry) => restoredById.get(entry?.id) ?? entry),
      });
    }
  }

  if (summaryCache && typeof summaryCache === 'object') {
    const kept = Object.fromEntries(
      Object.entries(summaryCache).filter(([, entry]) => !isWrappedCacheEntry(entry)),
    );
    result.cacheDropped = Object.keys(summaryCache).length - Object.keys(kept).length;
    if (result.cacheDropped > 0) await storage.set({ summaryCache: kept });
  }

  if (result.historyUnreadable > 0) {
    Logger.warn(`${result.historyUnreadable} compressed history summaries could not be decoded`);
  }
  return result;
}
