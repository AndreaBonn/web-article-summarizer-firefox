import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dipendenze
vi.mock('@utils/storage/storage-manager.js', () => ({
  StorageManager: {
    getSettings: vi.fn(),
    getApiKey: vi.fn(),
  },
}));

vi.mock('@utils/ai/api-orchestrator.js', () => ({
  APIOrchestrator: {
    generateCompletion: vi.fn(),
  },
}));

vi.mock('@utils/core/logger.js', () => ({
  Logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@utils/core/multi-analysis-generators.js', () => ({
  generateGlobalSummary: vi.fn(),
  generateComparison: vi.fn(),
  generateQA: vi.fn(),
}));

// Mock browser.storage.local
global.browser = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
};

import { MultiAnalysisManager } from '@utils/core/multi-analysis-manager.js';
import { StorageManager } from '@utils/storage/storage-manager.js';
import { APIOrchestrator as APIClient } from '@utils/ai/api-orchestrator.js';
import {
  generateGlobalSummary,
  generateComparison,
  generateQA,
} from '@utils/core/multi-analysis-generators.js';

// Fixtures
const makeArticle = (id, title, summary, url = 'https://example.com') => ({
  id,
  article: { title, url, content: summary, wordCount: 100 },
  summary,
  translation: null,
  keyPoints: [],
});

const articles = [
  makeArticle(1, 'Articolo Uno', 'Riassunto primo articolo sulla tecnologia AI.'),
  makeArticle(2, 'Articolo Due', 'Riassunto secondo articolo sulla tecnologia AI.'),
];

describe('MultiAnalysisManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.storage.local.get.mockResolvedValue({});
    browser.storage.local.set.mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // checkArticlesRelation
  // ---------------------------------------------------------------------------

  describe('checkArticlesRelation', () => {
    it('restituisce related=true con skipped=true se API key mancante', async () => {
      StorageManager.getSettings.mockResolvedValue({ selectedProvider: 'groq' });
      StorageManager.getApiKey.mockResolvedValue(null);

      const result = await MultiAnalysisManager.checkArticlesRelation(articles);

      expect(result.related).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('API key non configurata');
    });

    it('usa provider da settings per recuperare API key', async () => {
      StorageManager.getSettings.mockResolvedValue({ selectedProvider: 'openai' });
      StorageManager.getApiKey.mockResolvedValue(null);

      await MultiAnalysisManager.checkArticlesRelation(articles);

      expect(StorageManager.getApiKey).toHaveBeenCalledWith('openai');
    });

    it('fallback a "groq" se selectedProvider non impostato', async () => {
      StorageManager.getSettings.mockResolvedValue({});
      StorageManager.getApiKey.mockResolvedValue(null);

      await MultiAnalysisManager.checkArticlesRelation(articles);

      expect(StorageManager.getApiKey).toHaveBeenCalledWith('groq');
    });

    it('chiama checkCorrelationWithAI quando API key disponibile', async () => {
      StorageManager.getSettings.mockResolvedValue({ selectedProvider: 'groq' });
      StorageManager.getApiKey.mockResolvedValue('test-key');
      APIClient.generateCompletion.mockResolvedValue(
        '{"related": true, "confidence": 0.9, "reason": "Stesso tema"}',
      );

      const result = await MultiAnalysisManager.checkArticlesRelation(articles);

      expect(result.related).toBe(true);
      expect(result.confidence).toBe(0.9);
      expect(result.reason).toBe('Stesso tema');
    });

    it('restituisce related=true se generateCompletion fallisce (catch interno a checkCorrelationWithAI)', async () => {
      StorageManager.getSettings.mockResolvedValue({ selectedProvider: 'groq' });
      StorageManager.getApiKey.mockResolvedValue('test-key');
      APIClient.generateCompletion.mockRejectedValue(new Error('Network error'));

      const result = await MultiAnalysisManager.checkArticlesRelation(articles);

      expect(result.related).toBe(true);
      expect(result.reason).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // checkCorrelationWithAI
  // ---------------------------------------------------------------------------

  describe('checkCorrelationWithAI', () => {
    it('parsa risposta JSON valida con related=true', async () => {
      APIClient.generateCompletion.mockResolvedValue(
        '{"related": true, "confidence": 0.85, "reason": "Temi comuni"}',
      );

      const result = await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq', 'key');

      expect(result.related).toBe(true);
      expect(result.confidence).toBe(0.85);
      expect(result.reason).toBe('Temi comuni');
    });

    it('parsa risposta JSON con related=false', async () => {
      APIClient.generateCompletion.mockResolvedValue(
        '{"related": false, "confidence": 0.2, "reason": "Nessun tema comune"}',
      );

      const result = await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq', 'key');

      expect(result.related).toBe(false);
      expect(result.reason).toBe('Nessun tema comune');
    });

    it('gestisce risposta JSON avvolta in markdown code block', async () => {
      APIClient.generateCompletion.mockResolvedValue(
        '```json\n{"related": true, "confidence": 0.7, "reason": "Correlati"}\n```',
      );

      const result = await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq', 'key');

      expect(result.related).toBe(true);
      expect(result.confidence).toBe(0.7);
    });

    it('fallback related=true se reason mancante nella risposta', async () => {
      APIClient.generateCompletion.mockResolvedValue('{"related": true}');

      const result = await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq', 'key');

      expect(result.related).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.confidence).toBe(0.5);
    });

    it('restituisce related=true su errore di parsing JSON', async () => {
      APIClient.generateCompletion.mockResolvedValue('risposta non JSON invalida');

      const result = await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq', 'key');

      expect(result.related).toBe(true);
      expect(result.reason).toBeNull();
    });

    it('usa translation.text se disponibile anziché summary', async () => {
      const articlesWithTranslation = [
        {
          ...articles[0],
          translation: { text: 'Translated content of first article about technology.' },
        },
        articles[1],
      ];
      APIClient.generateCompletion.mockResolvedValue(
        '{"related": true, "confidence": 0.9, "reason": "OK"}',
      );

      await MultiAnalysisManager.checkCorrelationWithAI(articlesWithTranslation, 'groq', 'key');

      const userPrompt = APIClient.generateCompletion.mock.calls[0][3];
      expect(userPrompt).toContain('Translated content');
    });

    it('passa temperature 0.1 e maxTokens 500 nelle opzioni', async () => {
      APIClient.generateCompletion.mockResolvedValue('{"related": true}');

      await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq', 'key');

      const options = APIClient.generateCompletion.mock.calls[0][4];
      expect(options.temperature).toBe(0.1);
      expect(options.maxTokens).toBe(500);
      expect(options.responseFormat).toBe('json');
    });

    it('tronca contenuto articolo a 300 caratteri nel prompt', async () => {
      const longArticle = makeArticle(3, 'Lungo', 'A'.repeat(500));
      APIClient.generateCompletion.mockResolvedValue('{"related": true}');

      await MultiAnalysisManager.checkCorrelationWithAI([longArticle], 'groq', 'key');

      const userPrompt = APIClient.generateCompletion.mock.calls[0][3];
      // Il contenuto troncato dovrebbe essere 300 caratteri + "..."
      expect(userPrompt).not.toContain('A'.repeat(400));
    });
  });

  // ---------------------------------------------------------------------------
  // analyzeArticles
  // ---------------------------------------------------------------------------

  describe('analyzeArticles', () => {
    const progressCallback = vi.fn();

    beforeEach(() => {
      StorageManager.getSettings.mockResolvedValue({ selectedProvider: 'groq' });
      StorageManager.getApiKey.mockResolvedValue('test-key');
      generateGlobalSummary.mockResolvedValue('Riassunto globale generato');
      generateComparison.mockResolvedValue('Confronto generato');
      generateQA.mockResolvedValue([{ question: 'Q1?', answer: 'A1' }]);
    });

    it('lancia errore se API key non configurata', async () => {
      StorageManager.getApiKey.mockResolvedValue(null);

      await expect(
        MultiAnalysisManager.analyzeArticles(articles, {}, progressCallback),
      ).rejects.toThrow('API key non configurata');
    });

    it('genera solo globalSummary se richiesto', async () => {
      const result = await MultiAnalysisManager.analyzeArticles(
        articles,
        { globalSummary: true },
        progressCallback,
      );

      expect(result.globalSummary).toBe('Riassunto globale generato');
      expect(result.comparison).toBeNull();
      expect(result.qa).toBeNull();
      expect(generateGlobalSummary).toHaveBeenCalledWith(articles, 'groq', 'test-key');
    });

    it('genera solo comparison se richiesto', async () => {
      const result = await MultiAnalysisManager.analyzeArticles(
        articles,
        { comparison: true },
        progressCallback,
      );

      expect(result.comparison).toBe('Confronto generato');
      expect(result.globalSummary).toBeNull();
      expect(generateComparison).toHaveBeenCalledWith(articles, 'groq', 'test-key');
    });

    it('genera Q&A con struttura corretta', async () => {
      generateQA.mockResolvedValue([
        { question: 'Domanda 1?', answer: 'Risposta 1' },
        { question: 'Domanda 2?', answer: 'Risposta 2' },
      ]);

      const result = await MultiAnalysisManager.analyzeArticles(
        articles,
        { qa: true },
        progressCallback,
      );

      expect(result.qa.interactive).toBe(true);
      expect(result.qa.questions).toHaveLength(2);
      expect(result.qa.articles).toHaveLength(2);
      expect(result.qa.articles[0].title).toBe('Articolo Uno');
    });

    it('gestisce qaResult come oggetto con proprietà questions', async () => {
      generateQA.mockResolvedValue({ questions: [{ question: 'Q?', answer: 'A' }] });

      const result = await MultiAnalysisManager.analyzeArticles(
        articles,
        { qa: true },
        progressCallback,
      );

      expect(result.qa.questions).toHaveLength(1);
    });

    it('gestisce qaResult non-array e non-oggetto-con-questions', async () => {
      generateQA.mockResolvedValue('stringa inattesa');

      const result = await MultiAnalysisManager.analyzeArticles(
        articles,
        { qa: true },
        progressCallback,
      );

      expect(result.qa.questions).toEqual([]);
    });

    it('genera tutte le analisi se tutte le opzioni attive', async () => {
      const result = await MultiAnalysisManager.analyzeArticles(
        articles,
        { globalSummary: true, comparison: true, qa: true },
        progressCallback,
      );

      expect(result.globalSummary).toBe('Riassunto globale generato');
      expect(result.comparison).toBe('Confronto generato');
      expect(result.qa.interactive).toBe(true);
    });

    it('chiama progressCallback con messaggi e percentuali corretti', async () => {
      await MultiAnalysisManager.analyzeArticles(
        articles,
        { globalSummary: true, comparison: true, qa: true },
        progressCallback,
      );

      expect(progressCallback).toHaveBeenCalledWith('Generazione riassunto globale...', 30);
      expect(progressCallback).toHaveBeenCalledWith('Confronto idee tra articoli...', 55);
      expect(progressCallback).toHaveBeenCalledWith('Generazione Q&A...', 75);
      expect(progressCallback).toHaveBeenCalledWith('Completamento...', 95);
    });

    it('costruisce result.articles con id, title, url', async () => {
      const result = await MultiAnalysisManager.analyzeArticles(articles, {}, progressCallback);

      expect(result.articles).toEqual([
        { id: 1, title: 'Articolo Uno', url: 'https://example.com' },
        { id: 2, title: 'Articolo Due', url: 'https://example.com' },
      ]);
    });

    it('imposta timestamp e metadata.provider nel risultato', async () => {
      const before = Date.now();
      const result = await MultiAnalysisManager.analyzeArticles(articles, {}, progressCallback);
      const after = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
      expect(result.metadata.provider).toBe('groq');
    });

    it('usa article.content come fallback per qa.articles se disponibile', async () => {
      const articlesWithContent = [
        {
          ...articles[0],
          article: { ...articles[0].article, content: 'Contenuto completo articolo 1' },
        },
      ];
      generateQA.mockResolvedValue([]);

      const result = await MultiAnalysisManager.analyzeArticles(
        articlesWithContent,
        { qa: true },
        progressCallback,
      );

      expect(result.qa.articles[0].content).toBe('Contenuto completo articolo 1');
    });
  });

  // ---------------------------------------------------------------------------
  // saveAnalysis
  // ---------------------------------------------------------------------------

  describe('saveAnalysis', () => {
    it('salva analisi in browser.storage.local con id = Date.now()', async () => {
      const analysis = { articles: [], globalSummary: 'test' };
      const before = Date.now();

      await MultiAnalysisManager.saveAnalysis(analysis);

      expect(analysis.id).toBeGreaterThanOrEqual(before);
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        multiAnalysisHistory: [analysis],
      });
    });

    it('inserisce nuova analisi in testa alla history esistente', async () => {
      const existing = { id: 1, articles: [] };
      browser.storage.local.get.mockResolvedValue({
        multiAnalysisHistory: [existing],
      });

      const newAnalysis = { articles: [], globalSummary: 'nuova' };
      await MultiAnalysisManager.saveAnalysis(newAnalysis);

      const saved = browser.storage.local.set.mock.calls[0][0].multiAnalysisHistory;
      expect(saved[0]).toBe(newAnalysis);
      expect(saved[1]).toBe(existing);
    });

    it('limita history a 30 elementi', async () => {
      const existingHistory = Array.from({ length: 35 }, (_, i) => ({ id: i, articles: [] }));
      browser.storage.local.get.mockResolvedValue({
        multiAnalysisHistory: existingHistory,
      });

      await MultiAnalysisManager.saveAnalysis({ articles: [] });

      const saved = browser.storage.local.set.mock.calls[0][0].multiAnalysisHistory;
      expect(saved).toHaveLength(30);
    });

    it('gestisce history vuota (prima analisi)', async () => {
      browser.storage.local.get.mockResolvedValue({});

      await MultiAnalysisManager.saveAnalysis({ articles: [] });

      const saved = browser.storage.local.set.mock.calls[0][0].multiAnalysisHistory;
      expect(saved).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getAnalysisHistory
  // ---------------------------------------------------------------------------

  describe('getAnalysisHistory', () => {
    it('restituisce array vuoto se nessuna history salvata', async () => {
      browser.storage.local.get.mockResolvedValue({});

      const result = await MultiAnalysisManager.getAnalysisHistory();

      expect(result).toEqual([]);
    });

    it('restituisce history salvata', async () => {
      const history = [{ id: 1 }, { id: 2 }];
      browser.storage.local.get.mockResolvedValue({ multiAnalysisHistory: history });

      const result = await MultiAnalysisManager.getAnalysisHistory();

      expect(result).toEqual(history);
      expect(result).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getAnalysisById
  // ---------------------------------------------------------------------------

  describe('getAnalysisById', () => {
    it('trova analisi per id corrispondente', async () => {
      const history = [
        { id: 100, title: 'prima' },
        { id: 200, title: 'seconda' },
      ];
      browser.storage.local.get.mockResolvedValue({ multiAnalysisHistory: history });

      const result = await MultiAnalysisManager.getAnalysisById(200);

      expect(result.title).toBe('seconda');
    });

    it('restituisce undefined se id non trovato', async () => {
      browser.storage.local.get.mockResolvedValue({
        multiAnalysisHistory: [{ id: 1 }],
      });

      const result = await MultiAnalysisManager.getAnalysisById(999);

      expect(result).toBeUndefined();
    });

    it('restituisce undefined se history vuota', async () => {
      browser.storage.local.get.mockResolvedValue({});

      const result = await MultiAnalysisManager.getAnalysisById(1);

      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteAnalysis
  // ---------------------------------------------------------------------------

  describe('deleteAnalysis', () => {
    it('rimuove analisi con id specificato', async () => {
      browser.storage.local.get.mockResolvedValue({
        multiAnalysisHistory: [
          { id: 1, title: 'keep' },
          { id: 2, title: 'delete' },
          { id: 3, title: 'keep2' },
        ],
      });

      await MultiAnalysisManager.deleteAnalysis(2);

      const saved = browser.storage.local.set.mock.calls[0][0].multiAnalysisHistory;
      expect(saved).toHaveLength(2);
      expect(saved.find((a) => a.id === 2)).toBeUndefined();
    });

    it('non modifica history se id non presente', async () => {
      browser.storage.local.get.mockResolvedValue({
        multiAnalysisHistory: [{ id: 1 }, { id: 2 }],
      });

      await MultiAnalysisManager.deleteAnalysis(999);

      const saved = browser.storage.local.set.mock.calls[0][0].multiAnalysisHistory;
      expect(saved).toHaveLength(2);
    });

    it('gestisce history vuota senza errore', async () => {
      browser.storage.local.get.mockResolvedValue({});

      await MultiAnalysisManager.deleteAnalysis(1);

      const saved = browser.storage.local.set.mock.calls[0][0].multiAnalysisHistory;
      expect(saved).toEqual([]);
    });
  });
});
