import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadReadingModeData,
  computeSplitPercentage,
} from '../../src/pages/reading-mode/reading-mode-data.js';
import { Logger } from '../../src/utils/core/logger.js';

function createStorage(data) {
  const calls = [];
  return {
    calls,
    async get(keys) {
      calls.push(['get', keys]);
      return Object.fromEntries(keys.map((key) => [key, data[key]]));
    },
    async remove(keys) {
      calls.push(['remove', keys]);
      keys.forEach((key) => delete data[key]);
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('loadReadingModeData', () => {
  it('loads PDF data, cleans its storage key, then logs', async () => {
    const storage = createStorage({ pdfReadingMode: { summary: 'PDF summary' } });
    vi.spyOn(Logger, 'info').mockImplementation((message) => storage.calls.push(['log', message]));
    const result = await loadReadingModeData({
      search: '?source=pdf',
      storage,
      hasExtensionStorage: true,
    });
    expect(result).toEqual({ summary: 'PDF summary', isPDF: true });
    expect(storage.calls).toEqual([
      ['get', ['pdfReadingMode']],
      ['remove', ['pdfReadingMode']],
      ['log', 'Dati PDF caricati:'],
    ]);
  });

  it('falls back from missing PDF data to the popup handoff and removes it', async () => {
    const storage = createStorage({ readingModeData: { summary: 'Article summary' } });
    await expect(
      loadReadingModeData({ search: '?source=pdf', storage, hasExtensionStorage: true }),
    ).resolves.toEqual({ summary: 'Article summary' });
    expect(storage.calls).toEqual([
      ['get', ['pdfReadingMode']],
      ['get', ['readingModeData']],
      ['remove', ['readingModeData']],
    ]);
  });

  it('ignores an id in the URL and loads the popup handoff', async () => {
    const storage = createStorage({
      summaryHistory: [{ id: 7, summary: 'From history' }],
      readingModeData: { summary: 'Handoff' },
    });
    await expect(
      loadReadingModeData({ search: '?id=7', storage, hasExtensionStorage: true }),
    ).resolves.toEqual({ summary: 'Handoff' });
    expect(storage.calls).toEqual([
      ['get', ['readingModeData']],
      ['remove', ['readingModeData']],
    ]);
  });

  it('reports NODATA for an empty extension handoff', async () => {
    await expect(
      loadReadingModeData({ search: '', storage: createStorage({}), hasExtensionStorage: true }),
    ).rejects.toThrow('NODATA');
  });

  it('loads JSON from session storage when extension storage is unavailable', async () => {
    const session = { getItem: vi.fn(() => '{"summary":"Session summary"}') };
    await expect(
      loadReadingModeData({ search: '', sessionStorage: session, hasExtensionStorage: false }),
    ).resolves.toEqual({ summary: 'Session summary' });
    expect(session.getItem).toHaveBeenCalledWith('readingModeData');
  });

  it.each([null, '{broken'])('reports NODATA for invalid session data: %j', async (value) => {
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    await expect(
      loadReadingModeData({
        search: '',
        sessionStorage: { getItem: () => value },
        hasExtensionStorage: false,
      }),
    ).rejects.toThrow('NODATA');
  });

  it('propagates and logs storage failures without consuming the handoff', async () => {
    const failure = new Error('Storage unavailable');
    const storage = {
      get: async () => {
        throw failure;
      },
      remove: vi.fn(),
    };
    const calls = [];
    vi.spyOn(Logger, 'error').mockImplementation((...args) => calls.push(args));
    await expect(
      loadReadingModeData({ search: '', storage, hasExtensionStorage: true }),
    ).rejects.toBe(failure);
    expect(calls).toEqual([['Error loading data:', failure]]);
    expect(storage.remove).not.toHaveBeenCalled();
  });
});

describe('computeSplitPercentage', () => {
  it.each([
    [139.8, null],
    [140, 20],
    [200, 50],
    [260, 80],
    [260.2, null],
  ])('maps clientX %s into the permitted split: %s', (clientX, expected) => {
    expect(computeSplitPercentage(clientX, { left: 100, width: 200 })).toBe(expected);
  });
});
