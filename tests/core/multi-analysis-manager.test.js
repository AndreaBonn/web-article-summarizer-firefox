import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dipendenze
vi.mock('@utils/storage/storage-manager.js', () => ({
  StorageManager: {
    getSettings: vi.fn(),
  },
}));

vi.mock('@utils/ai/completion-client.js', () => ({
  requestCompletion: vi.fn(),
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
import { requestCompletion } from '@utils/ai/completion-client.js';
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
    it('chiede la correlazione al provider scelto nelle impostazioni', async () => {
      StorageManager.getSettings.mockResolvedValue({ selectedProvider: 'openai' });
      requestCompletion.mockResolvedValue('{"related": true}');

      await MultiAnalysisManager.checkArticlesRelation(articles);

      expect(requestCompletion.mock.calls[0][0]).toBe('openai');
    });

    it('fallback a "groq" se selectedProvider non impostato', async () => {
      StorageManager.getSettings.mockResolvedValue({});
      requestCompletion.mockResolvedValue('{"related": true}');

      await MultiAnalysisManager.checkArticlesRelation(articles);

      expect(requestCompletion.mock.calls[0][0]).toBe('groq');
    });

    it('restituisce la correlazione calcolata dal provider', async () => {
      StorageManager.getSettings.mockResolvedValue({ selectedProvider: 'groq' });
      requestCompletion.mockResolvedValue(
        '{"related": true, "confidence": 0.9, "reason": "Stesso tema"}',
      );

      const result = await MultiAnalysisManager.checkArticlesRelation(articles);

      expect(result.related).toBe(true);
      expect(result.confidence).toBe(0.9);
      expect(result.reason).toBe('Stesso tema');
    });

    it('restituisce related=true se generateCompletion fallisce (catch interno a checkCorrelationWithAI)', async () => {
      StorageManager.getSettings.mockResolvedValue({ selectedProvider: 'groq' });
      requestCompletion.mockRejectedValue(new Error('Network error'));

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
      requestCompletion.mockResolvedValue(
        '{"related": true, "confidence": 0.85, "reason": "Temi comuni"}',
      );

      const result = await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq');

      expect(result.related).toBe(true);
      expect(result.confidence).toBe(0.85);
      expect(result.reason).toBe('Temi comuni');
    });

    it('parsa risposta JSON con related=false', async () => {
      requestCompletion.mockResolvedValue(
        '{"related": false, "confidence": 0.2, "reason": "Nessun tema comune"}',
      );

      const result = await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq');

      expect(result.related).toBe(false);
      expect(result.reason).toBe('Nessun tema comune');
    });

    it('gestisce risposta JSON avvolta in markdown code block', async () => {
      requestCompletion.mockResolvedValue(
        '```json\n{"related": true, "confidence": 0.7, "reason": "Correlati"}\n```',
      );

      const result = await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq');

      expect(result.related).toBe(true);
      expect(result.confidence).toBe(0.7);
    });

    it('mantiene confidence 0 senza rimpiazzarla col default', async () => {
      requestCompletion.mockResolvedValue(
        '{"related": false, "confidence": 0, "reason": "Nessuna relazione"}',
      );

      const result = await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq');

      expect(result.confidence).toBe(0);
    });

    it('fallback related=true se reason mancante nella risposta', async () => {
      requestCompletion.mockResolvedValue('{"related": true}');

      const result = await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq');

      expect(result.related).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.confidence).toBe(0.5);
    });

    it('restituisce related=true su errore di parsing JSON', async () => {
      requestCompletion.mockResolvedValue('risposta non JSON invalida');

      const result = await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq');

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
      requestCompletion.mockResolvedValue('{"related": true, "confidence": 0.9, "reason": "OK"}');

      await MultiAnalysisManager.checkCorrelationWithAI(articlesWithTranslation, 'groq');

      const userPrompt = requestCompletion.mock.calls[0][2];
      expect(userPrompt).toContain('Translated content');
    });

    it('usa una translation salvata come stringa (reading mode) senza errori', async () => {
      const articlesWithStringTranslation = [
        { ...articles[0], translation: 'Traduzione come stringa del primo articolo.' },
        articles[1],
      ];
      requestCompletion.mockResolvedValue('{"related": true}');

      await MultiAnalysisManager.checkCorrelationWithAI(
        articlesWithStringTranslation,
        'groq',
        'key',
      );

      const userPrompt = requestCompletion.mock.calls[0][2];
      expect(userPrompt).toContain('Traduzione come stringa');
    });

    it('passa temperature 0.1 e maxTokens 500 nelle opzioni', async () => {
      requestCompletion.mockResolvedValue('{"related": true}');

      await MultiAnalysisManager.checkCorrelationWithAI(articles, 'groq');

      const options = requestCompletion.mock.calls[0][3];
      expect(options.temperature).toBe(0.1);
      expect(options.maxTokens).toBe(500);
      expect(options.responseFormat).toBe('json');
    });

    it('tronca contenuto articolo a 300 caratteri nel prompt', async () => {
      const longArticle = makeArticle(3, 'Lungo', 'A'.repeat(500));
      requestCompletion.mockResolvedValue('{"related": true}');

      await MultiAnalysisManager.checkCorrelationWithAI([longArticle], 'groq', 'key');

      const userPrompt = requestCompletion.mock.calls[0][2];
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
      generateGlobalSummary.mockResolvedValue('Riassunto globale generato');
      generateComparison.mockResolvedValue('Confronto generato');
      generateQA.mockResolvedValue([{ question: 'Q1?', answer: 'A1' }]);
    });

    it("propaga l'errore del service worker, ad esempio la chiave mancante", async () => {
      generateGlobalSummary.mockRejectedValue(new Error('Manca la chiave API'));

      await expect(
        MultiAnalysisManager.analyzeArticles(articles, { globalSummary: true }, progressCallback),
      ).rejects.toThrow('Manca la chiave API');
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
      expect(generateGlobalSummary).toHaveBeenCalledWith(articles, 'groq');
    });

    it('genera solo comparison se richiesto', async () => {
      const result = await MultiAnalysisManager.analyzeArticles(
        articles,
        { comparison: true },
        progressCallback,
      );

      expect(result.comparison).toBe('Confronto generato');
      expect(result.globalSummary).toBeNull();
      expect(generateComparison).toHaveBeenCalledWith(articles, 'groq');
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

  // ---------------------------------------------------------------------------
  // getAnalysisHistory
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // getAnalysisById
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // deleteAnalysis
  // ---------------------------------------------------------------------------
});
