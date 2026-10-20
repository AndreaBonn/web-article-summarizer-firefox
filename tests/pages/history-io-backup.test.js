import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/core/modal.js', () => ({
  Modal: { confirm: vi.fn(), alert: vi.fn(), error: vi.fn() },
}));
vi.mock('@utils/storage/storage-manager.js', () => ({ StorageManager: { getSettings: vi.fn() } }));

import { importHistory } from '@pages/history/io-backup.js';
import { state } from '@pages/history/state.js';
import { HistoryManager } from '@utils/storage/history-manager.js';
import { Modal } from '@utils/core/modal.js';

const store = {};

function makeBackup(overrides = {}) {
  return {
    version: '1.0.0',
    exportDate: '2026-01-01T00:00:00.000Z',
    data: {
      singleArticles: [
        {
          id: 'entry-1',
          timestamp: 1700000000000,
          article: { title: 'T', url: 'https://example.com/a', content: 'C', excerpt: 'E' },
          summary: 'Summary',
          keyPoints: [{ title: 'K', description: 'D' }],
          translation: { text: 'Traduzione', targetLanguage: 'it', originalLanguage: 'en' },
          qa: [{ question: 'Q?', answer: 'A.' }],
          citations: { citations: [{ id: 'c1', text: 'quote' }], total_citations: 1 },
          notes: 'my notes',
          favorite: true,
          metadata: { provider: 'openai', language: 'en', contentType: 'news' },
        },
      ],
      multiAnalysis: [],
    },
    metadata: { totalSingleArticles: 1, totalMultiAnalysis: 0 },
    ...overrides,
  };
}

function pickFile(backup) {
  const text = typeof backup === 'string' ? backup : JSON.stringify(backup);
  return {
    target: {
      value: 'backup.json',
      files: [
        {
          name: 'backup.json',
          type: 'application/json',
          size: text.length,
          text: async () => text,
        },
      ],
    },
  };
}

describe('importHistory', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    document.body.innerHTML = '<button id="importHistoryBtn">Import</button>';
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn(async (keys) =>
            Object.fromEntries(
              keys.filter((k) => store[k] !== undefined).map((k) => [k, structuredClone(store[k])]),
            ),
          ),
          set: vi.fn(async (data) => Object.assign(store, structuredClone(data))),
        },
      },
    });
    state.loadHistory = vi.fn();
    state.loadMultiAnalysisHistory = vi.fn();
    Modal.confirm.mockResolvedValue(true);
    Modal.alert.mockResolvedValue(undefined);
    Modal.error.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('restores translation, Q&A, citations, notes, favorite and the original id', async () => {
    await importHistory(pickFile(makeBackup()));

    const [saved] = await HistoryManager.getHistory();
    expect(saved).toEqual(
      expect.objectContaining({
        id: 'entry-1',
        timestamp: 1700000000000,
        summary: 'Summary',
        translation: { text: 'Traduzione', targetLanguage: 'it', originalLanguage: 'en' },
        qa: [{ question: 'Q?', answer: 'A.' }],
        citations: { citations: [{ id: 'c1', text: 'quote' }], total_citations: 1 },
        notes: 'my notes',
        favorite: true,
      }),
    );
  });

  it('does not duplicate entries when the same backup is imported twice', async () => {
    await importHistory(pickFile(makeBackup()));
    await importHistory(pickFile(makeBackup()));

    expect(await HistoryManager.getHistory()).toHaveLength(1);
    expect(Modal.alert).toHaveBeenLastCalledWith(
      expect.stringContaining('Articoli singoli importati: 0'),
      expect.anything(),
      expect.anything(),
    );
  });

  it('imports a backup that has no metadata block', async () => {
    const backup = makeBackup();
    delete backup.metadata;

    await importHistory(pickFile(backup));

    expect(Modal.error).not.toHaveBeenCalled();
    expect(await HistoryManager.getHistory()).toHaveLength(1);
    expect(Modal.confirm.mock.calls[0][0]).toContain('📄 Articoli singoli: 1');
  });

  it('reports a format error for a JSON null file', async () => {
    await importHistory(pickFile('null'));

    expect(Modal.error).toHaveBeenCalledWith(
      expect.stringContaining('File di backup non valido'),
      expect.anything(),
    );
    expect(Modal.confirm).not.toHaveBeenCalled();
  });

  it('imports multi-analysis entries as exported (flattened article summaries)', async () => {
    const backup = makeBackup();
    backup.data.singleArticles = [];
    backup.data.multiAnalysis = [
      {
        id: 'multi-1',
        timestamp: 1700000000000,
        articles: [{ id: 'a1', title: 'First', url: 'https://example.com/1', wordCount: 10 }],
        analysis: {
          globalSummary: 'G',
          comparison: 'C',
          qa: { interactive: false, questions: [] },
        },
        metadata: { articlesCount: 1, provider: 'groq' },
      },
    ];

    await importHistory(pickFile(backup));

    expect(Modal.error).not.toHaveBeenCalled();
    const [saved] = await HistoryManager.getMultiAnalysisHistory();
    expect(saved.articles).toEqual([
      { id: 'a1', title: 'First', url: 'https://example.com/1', wordCount: 10 },
    ]);
    expect(saved.analysis.globalSummary).toBe('G');
  });

  it('does not duplicate multi-analysis entries when the same backup is imported twice', async () => {
    const backup = makeBackup();
    backup.data.singleArticles = [];
    backup.data.multiAnalysis = [
      {
        id: 'multi-1',
        timestamp: 1700000000000,
        articles: [{ id: 'a1', title: 'First', url: 'https://example.com/1', wordCount: 10 }],
        analysis: {
          globalSummary: 'G',
          comparison: 'C',
          qa: { interactive: false, questions: [] },
        },
        metadata: { articlesCount: 1, provider: 'groq' },
      },
    ];

    await importHistory(pickFile(backup));
    await importHistory(pickFile(backup));

    const saved = await HistoryManager.getMultiAnalysisHistory();
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('multi-1');
    expect(Modal.alert).toHaveBeenLastCalledWith(
      expect.stringContaining('Analisi multiple importate: 0'),
      expect.anything(),
      expect.anything(),
    );
  });

  it('does not count entries dropped by the history limit as imported', async () => {
    store.summaryHistory = Array.from({ length: 50 }, (_, i) => ({
      id: `e${i}`,
      timestamp: 2000000000000 - i * 1000,
      article: { title: 'T', url: `https://example.com/${i}` },
      summary: 's',
      keyPoints: [],
      metadata: { provider: 'openai' },
    }));

    const backup = makeBackup();
    backup.data.singleArticles[0].favorite = false;

    await importHistory(pickFile(backup));

    const history = await HistoryManager.getHistory();
    expect(history).toHaveLength(50);
    expect(history.map((e) => e.id)).not.toContain('entry-1');
    expect(Modal.alert).toHaveBeenLastCalledWith(
      expect.stringContaining('Articoli singoli importati: 0'),
      expect.anything(),
      expect.anything(),
    );
  });
});
