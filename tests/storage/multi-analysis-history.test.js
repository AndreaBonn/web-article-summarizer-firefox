import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});

const store = {};
global.browser = {
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

import { MultiAnalysisHistory } from '@utils/storage/multi-analysis-history.js';

describe('MultiAnalysisHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
  });

  const mockArticles = [
    { id: 'a1', article: { title: 'Article 1', url: 'https://a.com', wordCount: 100 } },
    { id: 'a2', article: { title: 'Article 2', url: 'https://b.com', wordCount: 200 } },
  ];

  const mockAnalysis = {
    globalSummary: 'Combined summary',
    comparison: 'Comparison text',
    qa: { interactive: true, articles: [], questions: [] },
    metadata: { provider: 'openai' },
  };

  describe('saveMultiAnalysis()', () => {
    it('test_saveMultiAnalysis_validData_returnsId', async () => {
      const id = await MultiAnalysisHistory.saveMultiAnalysis(mockAnalysis, mockArticles);
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('test_saveMultiAnalysis_savesCorrectStructure', async () => {
      await MultiAnalysisHistory.saveMultiAnalysis(mockAnalysis, mockArticles);
      const history = await MultiAnalysisHistory.getMultiAnalysisHistory();

      expect(history).toHaveLength(1);
      expect(history[0].articles).toHaveLength(2);
      expect(history[0].articles[0].title).toBe('Article 1');
      expect(history[0].analysis.globalSummary).toBe('Combined summary');
      expect(history[0].metadata.articlesCount).toBe(2);
      expect(history[0].metadata.provider).toBe('openai');
    });

    it('test_saveMultiAnalysis_missingFields_usesDefaults', async () => {
      await MultiAnalysisHistory.saveMultiAnalysis({}, mockArticles);
      const history = await MultiAnalysisHistory.getMultiAnalysisHistory();

      expect(history[0].analysis.globalSummary).toBeNull();
      expect(history[0].analysis.comparison).toBeNull();
      expect(history[0].metadata.provider).toBe('unknown');
    });
  });

  describe('getMultiAnalysisById()', () => {
    it('test_getMultiAnalysisById_existing_returnsEntry', async () => {
      const id = await MultiAnalysisHistory.saveMultiAnalysis(mockAnalysis, mockArticles);
      const entry = await MultiAnalysisHistory.getMultiAnalysisById(id);

      expect(entry).not.toBeNull();
      expect(entry.id).toBe(id);
    });

    it('test_getMultiAnalysisById_nonExisting_returnsNull', async () => {
      const entry = await MultiAnalysisHistory.getMultiAnalysisById('nonexistent');
      expect(entry).toBeUndefined();
    });
  });

  describe('deleteMultiAnalysis()', () => {
    it('test_deleteMultiAnalysis_existing_removesEntry', async () => {
      const id = await MultiAnalysisHistory.saveMultiAnalysis(mockAnalysis, mockArticles);
      await MultiAnalysisHistory.deleteMultiAnalysis(id);
      const history = await MultiAnalysisHistory.getMultiAnalysisHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('toggleMultiAnalysisFavorite()', () => {
    it('test_toggleMultiAnalysisFavorite_togglesCorrectly', async () => {
      const id = await MultiAnalysisHistory.saveMultiAnalysis(mockAnalysis, mockArticles);
      const isFav = await MultiAnalysisHistory.toggleMultiAnalysisFavorite(id);
      expect(isFav).toBe(true);

      const isNotFav = await MultiAnalysisHistory.toggleMultiAnalysisFavorite(id);
      expect(isNotFav).toBe(false);
    });
  });

  describe('clearMultiAnalysisHistory()', () => {
    it('test_clearMultiAnalysisHistory_removesAll', async () => {
      await MultiAnalysisHistory.saveMultiAnalysis(mockAnalysis, mockArticles);
      await MultiAnalysisHistory.saveMultiAnalysis(mockAnalysis, mockArticles);
      await MultiAnalysisHistory.clearMultiAnalysisHistory();

      const history = await MultiAnalysisHistory.getMultiAnalysisHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('updateMultiAnalysisWithQA()', () => {
    it('test_updateMultiAnalysisWithQA_addsQuestionToEntry', async () => {
      const id = await MultiAnalysisHistory.saveMultiAnalysis(mockAnalysis, mockArticles);
      await MultiAnalysisHistory.updateMultiAnalysisWithQA(id, 'What?', 'This.');

      const entry = await MultiAnalysisHistory.getMultiAnalysisById(id);
      expect(entry.analysis.qa.questions).toHaveLength(1);
      expect(entry.analysis.qa.questions[0].question).toBe('What?');
      expect(entry.analysis.qa.questions[0].answer).toBe('This.');
    });
  });
});
