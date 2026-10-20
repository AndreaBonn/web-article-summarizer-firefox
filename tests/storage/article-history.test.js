import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});

const store = {};
globalThis.browser = {
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
};

import { ArticleHistory } from '@utils/storage/article-history.js';

describe('ArticleHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
  });

  const mockArticle = {
    title: 'Test Article',
    url: 'https://example.com/test',
    content: 'Full content here',
    excerpt: 'Short excerpt',
    wordCount: 500,
    readingTimeMinutes: 3,
    paragraphs: ['p1', 'p2'],
  };

  const mockMetadata = {
    provider: 'openai',
    language: 'en',
    contentType: 'general',
  };

  describe('saveSummary()', () => {
    it('test_saveSummary_keyPoints_roundTripThroughHistory', async () => {
      const id = await ArticleHistory.saveSummary(
        mockArticle,
        'Summary',
        [{ title: 'Storage', description: 'Keep key points available for later reading.' }],
        mockMetadata,
      );

      const entry = await ArticleHistory.getSummaryById(id);

      expect(entry.summary).toBe('Summary');
      expect(entry.keyPoints).toEqual([
        { title: 'Storage', description: 'Keep key points available for later reading.' },
      ]);
    });

    it('test_saveSummary_validData_savesAndReturnsId', async () => {
      const id = await ArticleHistory.saveSummary(
        mockArticle,
        'Summary text',
        ['point1'],
        mockMetadata,
      );

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('test_saveSummary_savesCorrectStructure', async () => {
      await ArticleHistory.saveSummary(mockArticle, 'Summary', ['kp1'], mockMetadata);

      const history = await ArticleHistory.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].article.title).toBe('Test Article');
      expect(history[0].summary).toBe('Summary');
      expect(history[0].metadata.provider).toBe('openai');
      expect(history[0].translation).toBeNull();
      expect(history[0].notes).toBeNull();
    });
  });

  describe('getHistory()', () => {
    it('test_getHistory_empty_returnsEmptyArray', async () => {
      const history = await ArticleHistory.getHistory();
      expect(history).toEqual([]);
    });

    it('test_getHistory_multipleSaves_returnsAll', async () => {
      await ArticleHistory.saveSummary(mockArticle, 'Summary 1', [], mockMetadata);
      await ArticleHistory.saveSummary(
        { ...mockArticle, title: 'Second' },
        'Summary 2',
        [],
        mockMetadata,
      );

      const history = await ArticleHistory.getHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('getSummaryById()', () => {
    it('test_getSummaryById_existing_returnsEntry', async () => {
      const id = await ArticleHistory.saveSummary(mockArticle, 'Sum', [], mockMetadata);
      const entry = await ArticleHistory.getSummaryById(id);

      expect(entry).not.toBeNull();
      expect(entry.id).toBe(id);
      expect(entry.summary).toBe('Sum');
    });

    it('test_getSummaryById_nonExisting_returnsNull', async () => {
      const entry = await ArticleHistory.getSummaryById('nonexistent');
      expect(entry).toBeUndefined();
    });
  });

  describe('deleteSummary()', () => {
    it('test_deleteSummary_existing_removesEntry', async () => {
      const id = await ArticleHistory.saveSummary(mockArticle, 'Sum', [], mockMetadata);
      await ArticleHistory.deleteSummary(id);

      const history = await ArticleHistory.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('toggleFavorite()', () => {
    it('test_toggleFavorite_togglesValue', async () => {
      const id = await ArticleHistory.saveSummary(mockArticle, 'Sum', [], mockMetadata);

      const isFav1 = await ArticleHistory.toggleFavorite(id);
      expect(isFav1).toBe(true);

      const isFav2 = await ArticleHistory.toggleFavorite(id);
      expect(isFav2).toBe(false);
    });
  });

  describe('clearHistory()', () => {
    it('test_clearHistory_removesAll', async () => {
      await ArticleHistory.saveSummary(mockArticle, 'Sum1', [], mockMetadata);
      await ArticleHistory.saveSummary(mockArticle, 'Sum2', [], mockMetadata);
      await ArticleHistory.clearHistory();

      const history = await ArticleHistory.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('searchHistory()', () => {
    beforeEach(async () => {
      await ArticleHistory.saveSummary(
        { ...mockArticle, title: 'React Hooks Guide' },
        'Learn about hooks',
        [{ title: 'useState', description: 'State management hook' }],
        mockMetadata,
      );
      await ArticleHistory.saveSummary(
        { ...mockArticle, title: 'Python ML Tutorial', url: 'https://example.com/python' },
        'Machine learning basics',
        [],
        mockMetadata,
      );
    });

    it('test_searchHistory_byTitle_findsMatch', async () => {
      const results = await ArticleHistory.searchHistory('React');
      expect(results).toHaveLength(1);
      expect(results[0].article.title).toBe('React Hooks Guide');
    });

    it('test_searchHistory_bySummaryContent_findsMatch', async () => {
      const results = await ArticleHistory.searchHistory('machine learning');
      expect(results).toHaveLength(1);
    });

    it('test_searchHistory_byUrl_findsMatch', async () => {
      const results = await ArticleHistory.searchHistory('python');
      expect(results).toHaveLength(1);
    });

    it('test_searchHistory_noMatch_returnsEmpty', async () => {
      const results = await ArticleHistory.searchHistory('Rust');
      expect(results).toHaveLength(0);
    });

    it('test_searchHistory_caseInsensitive', async () => {
      const results = await ArticleHistory.searchHistory('react');
      expect(results).toHaveLength(1);
    });
  });

  describe('filterHistory()', () => {
    beforeEach(async () => {
      await ArticleHistory.saveSummary(mockArticle, 'Sum', [], {
        provider: 'openai',
        language: 'en',
        contentType: 'general',
      });
      await ArticleHistory.saveSummary(mockArticle, 'Sum2', [], {
        provider: 'anthropic',
        language: 'it',
        contentType: 'scientific',
      });
    });

    it('test_filterHistory_byProvider_filtersCorrectly', async () => {
      const results = await ArticleHistory.filterHistory({ provider: 'openai' });
      expect(results).toHaveLength(1);
      expect(results[0].metadata.provider).toBe('openai');
    });

    it('test_filterHistory_byLanguage_filtersCorrectly', async () => {
      const results = await ArticleHistory.filterHistory({ language: 'it' });
      expect(results).toHaveLength(1);
    });

    it('test_filterHistory_noFilters_returnsAll', async () => {
      const results = await ArticleHistory.filterHistory({});
      expect(results).toHaveLength(2);
    });
  });

  describe('importSummary()', () => {
    const backupEntry = () => ({
      id: 'original-id',
      timestamp: 1700000000000,
      article: mockArticle,
      summary: 'Imported summary',
      keyPoints: [{ title: 'K', description: 'D' }],
      translation: { text: 'Testo tradotto', targetLanguage: 'it', originalLanguage: 'en' },
      qa: [{ question: 'Q?', answer: 'A.' }],
      citations: { citations: [{ id: 'c1', text: 'quote' }], total_citations: 1 },
      notes: 'my notes',
      favorite: true,
      metadata: mockMetadata,
    });

    it('test_importSummary_backupEntry_keepsIdTimestampAndEveryUserField', async () => {
      const returned = await ArticleHistory.importSummary(backupEntry());

      const [saved] = await ArticleHistory.getHistory();
      expect(returned).toBe('original-id');
      const { metadata, ...rest } = backupEntry();
      expect(saved).toEqual(expect.objectContaining(rest));
      expect(saved.metadata).toEqual(expect.objectContaining(metadata));
    });

    it('test_importSummary_sameEntryTwice_isSkippedTheSecondTime', async () => {
      await ArticleHistory.importSummary(backupEntry());
      const second = await ArticleHistory.importSummary(backupEntry());

      expect(second).toBeNull();
      expect(await ArticleHistory.getHistory()).toHaveLength(1);
    });

    it('test_importSummary_missingOrInvalidId_assignsFreshId', async () => {
      const noId = { ...backupEntry(), id: undefined };
      const numericId = { ...backupEntry(), id: 42 };

      const first = await ArticleHistory.importSummary(noId);
      const second = await ArticleHistory.importSummary(numericId);

      expect(first).toEqual(expect.any(String));
      expect(second).toEqual(expect.any(String));
      expect(first).not.toBe(second);
      expect(await ArticleHistory.getHistory()).toHaveLength(2);
    });

    it('test_importSummary_olderEntry_isInsertedKeepingNewestFirst', async () => {
      const liveId = await ArticleHistory.saveSummary(mockArticle, 'live', [], mockMetadata);

      await ArticleHistory.importSummary(backupEntry());

      const history = await ArticleHistory.getHistory();
      expect(history.map((e) => e.id)).toEqual([liveId, 'original-id']);
    });

    const seedFull = (count, favoriteIds = []) => {
      store.summaryHistory = Array.from({ length: count }, (_, i) => ({
        id: `e${i}`,
        timestamp: 2000000000000 - i * 1000,
        favorite: favoriteIds.includes(`e${i}`),
        article: mockArticle,
        summary: 's',
        keyPoints: [],
        metadata: mockMetadata,
      }));
    };

    it('test_importSummary_fullHistoryWithOldFavorite_keepsTheFavorite', async () => {
      seedFull(50, ['e49']);

      const returned = await ArticleHistory.importSummary({
        ...backupEntry(),
        favorite: false,
        timestamp: 2000000000000 - 10500,
      });

      const ids = (await ArticleHistory.getHistory()).map((e) => e.id);
      expect(returned).toBe('original-id');
      expect(ids).toContain('e49');
      expect(ids).toContain('original-id');
      expect(ids).toHaveLength(50);
      expect(ids).not.toContain('e48');
    });

    it('test_importSummary_fullHistoryAndOlderThanAll_returnsNullAndStoresNothing', async () => {
      seedFull(50);

      const returned = await ArticleHistory.importSummary({ ...backupEntry(), favorite: false });

      const ids = (await ArticleHistory.getHistory()).map((e) => e.id);
      expect(returned).toBeNull();
      expect(ids).toHaveLength(50);
      expect(ids).not.toContain('original-id');
    });

    it('test_importSummary_optionalFieldsAbsent_defaultsToEmpty', async () => {
      await ArticleHistory.importSummary({
        id: 'min',
        article: mockArticle,
        summary: 's',
        keyPoints: [],
        metadata: mockMetadata,
      });

      const [saved] = await ArticleHistory.getHistory();
      expect(saved).toEqual(
        expect.objectContaining({ id: 'min', translation: null, notes: null, favorite: false }),
      );
      expect(saved.timestamp).toEqual(expect.any(Number));
    });
  });
});
