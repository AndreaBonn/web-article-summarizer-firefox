import { describe, expect, it, vi } from 'vitest';
import LZString from 'lz-string';
import {
  isWrappedCacheEntry,
  restoreCompressedData,
  restoreHistoryEntry,
} from '@utils/storage/compressed-data-recovery.js';

vi.mock('@utils/core/logger.js', () => ({
  Logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const LONG_SUMMARY = 'Il riassunto originale, abbastanza lungo da essere stato compresso. '.repeat(
  30,
);

// Shapes written by the retired CompressionMaintenance.compressOldHistory / compressOldCache
function compressedHistoryEntry(id) {
  const data = LZString.compressToUTF16(LONG_SUMMARY);
  return {
    id,
    timestamp: 1,
    summary: data,
    compressed: true,
    originalSize: LONG_SUMMARY.length,
    compressedSize: data.length,
  };
}

function memoryStorage(initial) {
  const store = structuredClone(initial);
  return {
    store,
    get: vi.fn(async (keys) =>
      Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, structuredClone(store[k])])),
    ),
    set: vi.fn(async (data) => Object.assign(store, structuredClone(data))),
  };
}

describe('restoreHistoryEntry', () => {
  it('decodes a compressed summary and drops the compression markers', () => {
    expect(restoreHistoryEntry(compressedHistoryEntry('a'))).toEqual({
      id: 'a',
      timestamp: 1,
      summary: LONG_SUMMARY,
    });
  });

  it('only strips the markers of a short summary that was never actually compressed', () => {
    const entry = {
      id: 'b',
      summary: 'breve',
      compressed: false,
      originalSize: 5,
      compressedSize: 5,
    };
    expect(restoreHistoryEntry(entry)).toEqual({ id: 'b', summary: 'breve' });
  });

  it('returns null when the decoded text does not match the stored original length', () => {
    const entry = { ...compressedHistoryEntry('d'), originalSize: LONG_SUMMARY.length + 1 };
    expect(restoreHistoryEntry(entry)).toBeNull();
  });

  it('returns null for a summary that does not decode', () => {
    expect(restoreHistoryEntry({ id: 'c', summary: '', compressed: true })).toBeNull();
  });
});

describe('isWrappedCacheEntry', () => {
  it('recognises the wrapper the old cache compression wrote', () => {
    const wrapped = { data: { compressed: true, data: 'x', originalSize: 9, compressedSize: 1 } };
    expect(isWrappedCacheEntry(wrapped)).toBe(true);
  });

  it('leaves a normal cache entry alone', () => {
    expect(isWrappedCacheEntry({ data: { summary: 's', keyPoints: [] } })).toBe(false);
  });
});

describe('restoreCompressedData', () => {
  it('makes compressed summaries readable again and drops wrapped cache entries', async () => {
    const plain = { id: 'p', timestamp: 2, summary: 'leggibile' };
    const storage = memoryStorage({
      summaryHistory: [compressedHistoryEntry('a'), plain],
      summaryCache: {
        ok: { data: { summary: 's' }, timestamp: 1 },
        old: { data: { compressed: false, data: '{}', originalSize: 2, compressedSize: 2 } },
      },
    });

    const result = await restoreCompressedData(storage);

    expect(result).toEqual({ historyRestored: 1, historyUnreadable: 0, cacheDropped: 1 });
    expect(storage.store.summaryHistory).toEqual([
      { id: 'a', timestamp: 1, summary: LONG_SUMMARY },
      plain,
    ]);
    expect(Object.keys(storage.store.summaryCache)).toEqual(['ok']);
  });

  it('keeps an undecodable entry as it is instead of losing it', async () => {
    const broken = { id: 'x', summary: '', compressed: true };
    const storage = memoryStorage({ summaryHistory: [broken, compressedHistoryEntry('a')] });

    const result = await restoreCompressedData(storage);

    expect(result.historyUnreadable).toBe(1);
    expect(storage.store.summaryHistory[0]).toEqual(broken);
    expect(storage.store.summaryHistory[1].summary).toBe(LONG_SUMMARY);
  });

  it('writes nothing when there is nothing to restore', async () => {
    const storage = memoryStorage({
      summaryHistory: [{ id: 'p', summary: 's' }],
      summaryCache: { ok: { data: { summary: 's' } } },
    });

    const result = await restoreCompressedData(storage);

    expect(result).toEqual({ historyRestored: 0, historyUnreadable: 0, cacheDropped: 0 });
    expect(storage.set).not.toHaveBeenCalled();
    expect(storage.get).toHaveBeenCalled();
  });

  it('handles empty storage', async () => {
    const storage = memoryStorage({});
    await expect(restoreCompressedData(storage)).resolves.toEqual({
      historyRestored: 0,
      historyUnreadable: 0,
      cacheDropped: 0,
    });
  });

  it('keeps a summary saved between the read and the write', async () => {
    const storage = memoryStorage({ summaryHistory: [compressedHistoryEntry('a')] });
    const firstGet = storage.get.getMockImplementation();
    storage.get.mockImplementationOnce(async (keys) => {
      const snapshot = await firstGet(keys);
      storage.store.summaryHistory = [
        { id: 'new', summary: 'appena salvato' },
        ...storage.store.summaryHistory,
      ];
      return snapshot;
    });

    await restoreCompressedData(storage);

    expect(storage.store.summaryHistory).toEqual([
      { id: 'new', summary: 'appena salvato' },
      { id: 'a', timestamp: 1, summary: LONG_SUMMARY },
    ]);
  });

  it('does not rewrite the history when every marked entry is unreadable', async () => {
    const storage = memoryStorage({ summaryHistory: [{ id: 'x', summary: '', compressed: true }] });
    await restoreCompressedData(storage);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('skips null entries instead of failing', async () => {
    const storage = memoryStorage({ summaryHistory: [null, compressedHistoryEntry('a')] });
    const result = await restoreCompressedData(storage);
    expect(result.historyRestored).toBe(1);
    expect(storage.store.summaryHistory[0]).toBeNull();
  });
});
