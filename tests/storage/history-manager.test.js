import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser.storage.local — simula serializzazione reale (JSON round-trip)
const store = {};
global.browser = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        const result = {};
        for (const key of keys) {
          if (store[key] !== undefined) result[key] = JSON.parse(JSON.stringify(store[key]));
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((data) => {
        for (const [key, value] of Object.entries(data)) {
          store[key] = JSON.parse(JSON.stringify(value));
        }
        return Promise.resolve();
      }),
    },
  },
};

vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `uuid-${Date.now()}`);

import { HistoryManager } from '@utils/storage/history-manager.js';

const mockArticle = {
  title: 'Test Article',
  url: 'https://example.com/article',
  content: 'Full text content',
  excerpt: 'Short excerpt',
  wordCount: 500,
  readingTimeMinutes: 3,
  paragraphs: [{ id: 1, text: 'Paragraph 1' }],
};

const mockMetadata = {
  provider: 'groq',
  language: 'it',
  contentType: 'general',
  fromCache: false,
};

describe('HistoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
    let counter = 0;
    crypto.randomUUID.mockImplementation(() => `uuid-${++counter}`);
  });

  // ===== SUMMARY =====

  describe('Summary CRUD', () => {
    it('saves and retrieves a summary', async () => {
      const id = await HistoryManager.saveSummary(
        mockArticle,
        'Summary text',
        [{ title: 'KP1', description: 'Desc' }],
        mockMetadata,
      );

      expect(id).toBe('uuid-1');
      const entry = await HistoryManager.getSummaryById(id);
      expect(entry.article.title).toBe('Test Article');
      expect(entry.summary).toBe('Summary text');
      expect(entry.metadata.provider).toBe('groq');
      expect(entry.translation).toBeNull();
    });

    it('getHistory returns all entries', async () => {
      await HistoryManager.saveSummary(mockArticle, 'S1', [], mockMetadata);
      await HistoryManager.saveSummary(mockArticle, 'S2', [], mockMetadata);

      const history = await HistoryManager.getHistory();
      expect(history).toHaveLength(2);
    });

    it('deleteSummary removes entry', async () => {
      const id = await HistoryManager.saveSummary(mockArticle, 'S1', [], mockMetadata);
      await HistoryManager.deleteSummary(id);

      const history = await HistoryManager.getHistory();
      expect(history).toHaveLength(0);
    });

    it('toggleFavorite works', async () => {
      const id = await HistoryManager.saveSummary(mockArticle, 'S1', [], mockMetadata);

      const isFav = await HistoryManager.toggleFavorite(id);
      expect(isFav).toBe(true);

      const isNotFav = await HistoryManager.toggleFavorite(id);
      expect(isNotFav).toBe(false);
    });

    it('clearHistory keeps only favorites', async () => {
      const id1 = await HistoryManager.saveSummary(mockArticle, 'Fav', [], mockMetadata);
      await HistoryManager.saveSummary(mockArticle, 'NotFav', [], mockMetadata);

      await HistoryManager.toggleFavorite(id1);
      await HistoryManager.clearHistory();

      const history = await HistoryManager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].summary).toBe('Fav');
    });
  });

  describe('Summary updates', () => {
    it('updateSummaryWithTranslation adds translation by URL', async () => {
      await HistoryManager.saveSummary(mockArticle, 'S1', [], mockMetadata);

      await HistoryManager.updateSummaryWithTranslation(
        'https://example.com/article',
        'Translated text',
        'en',
        'it',
      );

      const history = await HistoryManager.getHistory();
      expect(history[0].translation.text).toBe('Translated text');
      expect(history[0].translation.targetLanguage).toBe('en');
    });

    it('updateSummaryWithQA adds Q&A by URL', async () => {
      await HistoryManager.saveSummary(mockArticle, 'S1', [], mockMetadata);

      await HistoryManager.updateSummaryWithQA('https://example.com/article', [
        { question: 'Q1?', answer: 'A1' },
      ]);

      const history = await HistoryManager.getHistory();
      expect(history[0].qa).toHaveLength(1);
      expect(history[0].qa[0].question).toBe('Q1?');
    });

    it('updateSummaryNotes adds notes by ID', async () => {
      const id = await HistoryManager.saveSummary(mockArticle, 'S1', [], mockMetadata);

      await HistoryManager.updateSummaryNotes(id, 'My personal notes');

      const entry = await HistoryManager.getSummaryById(id);
      expect(entry.notes).toBe('My personal notes');
    });

    it('updateSummaryWithCitations adds citations by URL', async () => {
      await HistoryManager.saveSummary(mockArticle, 'S1', [], mockMetadata);

      await HistoryManager.updateSummaryWithCitations('https://example.com/article', [
        { type: 'direct_quote', text: 'Quote' },
      ]);

      const history = await HistoryManager.getHistory();
      expect(history[0].citations).toHaveLength(1);
    });
  });

  describe('Summary search and filter', () => {
    it('searchHistory finds by title', async () => {
      await HistoryManager.saveSummary(
        { ...mockArticle, title: 'React Hooks Guide' },
        'S1',
        [],
        mockMetadata,
      );
      await HistoryManager.saveSummary(
        { ...mockArticle, title: 'Vue Composition API' },
        'S2',
        [],
        mockMetadata,
      );

      const results = await HistoryManager.searchHistory('react');
      expect(results).toHaveLength(1);
      expect(results[0].article.title).toBe('React Hooks Guide');
    });

    it('filterHistory filters by provider', async () => {
      await HistoryManager.saveSummary(mockArticle, 'S1', [], mockMetadata);
      await HistoryManager.saveSummary(mockArticle, 'S2', [], {
        ...mockMetadata,
        provider: 'openai',
      });

      const results = await HistoryManager.filterHistory({ provider: 'openai' });
      expect(results).toHaveLength(1);
      expect(results[0].metadata.provider).toBe('openai');
    });
  });

  // ===== MULTI-ANALYSIS =====

  describe('Multi-Analysis CRUD', () => {
    const mockAnalysis = {
      globalSummary: 'Global summary',
      comparison: 'Comparison',
      qa: { interactive: true, articles: [], questions: [] },
      metadata: { provider: 'groq' },
    };
    const mockArticles = [
      { id: '1', article: { title: 'Art 1', url: 'url1', wordCount: 100 } },
      { id: '2', article: { title: 'Art 2', url: 'url2', wordCount: 200 } },
    ];

    it('saves and retrieves multi-analysis', async () => {
      const id = await HistoryManager.saveMultiAnalysis(mockAnalysis, mockArticles);

      const entry = await HistoryManager.getMultiAnalysisById(id);
      expect(entry.analysis.globalSummary).toBe('Global summary');
      expect(entry.articles).toHaveLength(2);
    });

    it('deleteMultiAnalysis removes entry', async () => {
      const id = await HistoryManager.saveMultiAnalysis(mockAnalysis, mockArticles);
      await HistoryManager.deleteMultiAnalysis(id);

      const history = await HistoryManager.getMultiAnalysisHistory();
      expect(history).toHaveLength(0);
    });

    it('updateMultiAnalysisWithQA appends Q&A', async () => {
      const id = await HistoryManager.saveMultiAnalysis(mockAnalysis, mockArticles);

      await HistoryManager.updateMultiAnalysisWithQA(id, 'Question?', 'Answer!');

      const entry = await HistoryManager.getMultiAnalysisById(id);
      expect(entry.analysis.qa.questions).toHaveLength(1);
      expect(entry.analysis.qa.questions[0].question).toBe('Question?');
    });
  });

  // ===== PDF =====

  describe('PDF CRUD', () => {
    const mockPdf = { name: 'test.pdf', size: 1024, pages: 5, text: 'PDF text' };
    const pdfMeta = { provider: 'groq', language: 'it', summaryLength: 'medium' };

    it('saves and retrieves PDF analysis', async () => {
      const id = await HistoryManager.savePDFAnalysis(mockPdf, 'PDF summary', [], pdfMeta);

      const entry = await HistoryManager.getPDFById(id);
      expect(entry.pdf.name).toBe('test.pdf');
      expect(entry.summary).toBe('PDF summary');
    });

    it('deletePDF removes entry', async () => {
      const id = await HistoryManager.savePDFAnalysis(mockPdf, 'S', [], pdfMeta);
      await HistoryManager.deletePDF(id);

      expect(await HistoryManager.getPDFHistory()).toHaveLength(0);
    });

    it('updatePDFWithTranslation adds translation', async () => {
      const id = await HistoryManager.savePDFAnalysis(mockPdf, 'S', [], pdfMeta);

      await HistoryManager.updatePDFWithTranslation(id, 'Translated', 'en', 'it');

      const entry = await HistoryManager.getPDFById(id);
      expect(entry.translation.text).toBe('Translated');
    });

    it('updatePDFNotes adds notes', async () => {
      const id = await HistoryManager.savePDFAnalysis(mockPdf, 'S', [], pdfMeta);

      await HistoryManager.updatePDFNotes(id, 'PDF notes');

      const entry = await HistoryManager.getPDFById(id);
      expect(entry.notes).toBe('PDF notes');
    });

    it('searchPDFHistory finds by filename', async () => {
      await HistoryManager.savePDFAnalysis({ ...mockPdf, name: 'research.pdf' }, 'S1', [], pdfMeta);
      await HistoryManager.savePDFAnalysis({ ...mockPdf, name: 'recipe.pdf' }, 'S2', [], pdfMeta);

      const results = await HistoryManager.searchPDFHistory('research');
      expect(results).toHaveLength(1);
      expect(results[0].pdf.name).toBe('research.pdf');
    });
  });

  // ===== UTILITY =====

  describe('Utility methods', () => {
    it('formatDate delegates to BaseHistoryRepository', () => {
      const result = HistoryManager.formatDate(Date.now());
      expect(result).toBe('Ora');
    });

    it('formatFileSize delegates to BaseHistoryRepository', () => {
      expect(HistoryManager.formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  // ===== PDF — metodi aggiuntivi =====

  describe('PDF updates', () => {
    const mockPdf = { name: 'test.pdf', size: 1024, pages: 5, text: 'PDF text' };
    const pdfMeta = { provider: 'groq', language: 'it', summaryLength: 'medium' };

    it('togglePDFFavorite works', async () => {
      const id = await HistoryManager.savePDFAnalysis(mockPdf, 'Summary', [], pdfMeta);

      const isFav = await HistoryManager.togglePDFFavorite(id);
      expect(isFav).toBe(true);

      const isNotFav = await HistoryManager.togglePDFFavorite(id);
      expect(isNotFav).toBe(false);
    });

    it('clearPDFHistory keeps only favorites', async () => {
      const id1 = await HistoryManager.savePDFAnalysis(mockPdf, 'Fav PDF', [], pdfMeta);
      await HistoryManager.savePDFAnalysis(mockPdf, 'NotFav PDF', [], pdfMeta);

      await HistoryManager.togglePDFFavorite(id1);
      await HistoryManager.clearPDFHistory();

      const history = await HistoryManager.getPDFHistory();
      expect(history).toHaveLength(1);
      expect(history[0].summary).toBe('Fav PDF');
    });

    it('updatePDFWithQA adds Q&A by ID', async () => {
      const id = await HistoryManager.savePDFAnalysis(mockPdf, 'S', [], pdfMeta);

      await HistoryManager.updatePDFWithQA(id, [{ question: 'Q?', answer: 'A' }]);

      const entry = await HistoryManager.getPDFById(id);
      expect(entry.qa).toHaveLength(1);
      expect(entry.qa[0].question).toBe('Q?');
    });

    it('updatePDFWithCitations adds citations by ID', async () => {
      const id = await HistoryManager.savePDFAnalysis(mockPdf, 'S', [], pdfMeta);

      await HistoryManager.updatePDFWithCitations(id, [
        { type: 'direct_quote', text: 'PDF Quote' },
      ]);

      const entry = await HistoryManager.getPDFById(id);
      expect(entry.citations).toHaveLength(1);
    });
  });

  // ===== MULTI-ANALYSIS — metodi aggiuntivi =====

  describe('Multi-Analysis updates', () => {
    const mockAnalysis = {
      globalSummary: 'Global summary',
      comparison: 'Comparison',
      qa: { interactive: true, articles: [], questions: [] },
      metadata: { provider: 'groq' },
    };
    const mockArticles = [{ id: '1', article: { title: 'Art 1', url: 'url1', wordCount: 100 } }];

    it('toggleMultiAnalysisFavorite works', async () => {
      const id = await HistoryManager.saveMultiAnalysis(mockAnalysis, mockArticles);

      const isFav = await HistoryManager.toggleMultiAnalysisFavorite(id);
      expect(isFav).toBe(true);

      const isNotFav = await HistoryManager.toggleMultiAnalysisFavorite(id);
      expect(isNotFav).toBe(false);
    });

    it('clearMultiAnalysisHistory keeps only favorites', async () => {
      const id1 = await HistoryManager.saveMultiAnalysis(mockAnalysis, mockArticles);
      await HistoryManager.saveMultiAnalysis(
        { ...mockAnalysis, globalSummary: 'Not fav' },
        mockArticles,
      );

      await HistoryManager.toggleMultiAnalysisFavorite(id1);
      await HistoryManager.clearMultiAnalysisHistory();

      const history = await HistoryManager.getMultiAnalysisHistory();
      expect(history).toHaveLength(1);
      expect(history[0].analysis.globalSummary).toBe('Global summary');
    });
  });
});
