import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome APIs
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

// Mock Logger
vi.mock('@utils/core/logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock PDFCacheManager
const mockCacheManager = {
  checkCache: vi.fn(),
  saveAnalysis: vi.fn(),
  getHistory: vi.fn(),
};
vi.mock('@utils/pdf/pdf-cache-manager.js', () => ({
  PDFCacheManager: class {
    constructor() {
      Object.assign(this, mockCacheManager);
    }
  },
}));

// Mock StorageManager
vi.mock('@utils/storage/storage-manager.js', () => ({
  StorageManager: {
    getApiKey: vi.fn(),
  },
}));

// Mock language names
vi.mock('@utils/i18n/language-names.js', () => ({
  getLanguageNameForPrompt: vi.fn((lang) => {
    const map = { it: 'italiano', en: 'inglese', fr: 'francese' };
    return map[lang] || lang;
  }),
}));

// Mock json-repair
vi.mock('@utils/ai/json-repair.js', () => ({
  parseLLMJson: vi.fn((text) => JSON.parse(text)),
}));

// Mock API Orchestrator
vi.mock('@utils/ai/api-orchestrator.js', () => ({
  APIOrchestrator: {
    generateCompletion: vi.fn(),
  },
}));

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
}));

import { PDFAnalyzer } from '@utils/pdf/pdf-analyzer.js';
import { StorageManager } from '@utils/storage/storage-manager.js';
import { APIOrchestrator as APIClient } from '@utils/ai/api-orchestrator.js';
import { parseLLMJson } from '@utils/ai/json-repair.js';
import * as pdfjsLib from 'pdfjs-dist';

describe('PDFAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
    analyzer = new PDFAnalyzer();
    // Replace cacheManager with mock
    analyzer.cacheManager = mockCacheManager;
  });

  // ─── Constructor ──────────────────────────────────

  describe('constructor', () => {
    it('definisce messaggi di errore', () => {
      expect(analyzer.ERROR_MESSAGES.FILE_TOO_LARGE).toContain('20MB');
      expect(analyzer.ERROR_MESSAGES.INVALID_FILE_TYPE).toContain('PDF');
    });
  });

  // ─── validateFile ─────────────────────────────────

  describe('validateFile', () => {
    it('accetta file PDF valido sotto 20MB', () => {
      const file = { type: 'application/pdf', size: 1024 };
      expect(() => analyzer.validateFile(file)).not.toThrow();
    });

    it('rifiuta file non PDF', () => {
      const file = { type: 'text/plain', size: 1024 };
      expect(() => analyzer.validateFile(file)).toThrow('File non valido');
    });

    it('rifiuta file sopra 20MB', () => {
      const file = { type: 'application/pdf', size: 21 * 1024 * 1024 };
      expect(() => analyzer.validateFile(file)).toThrow('troppo grande');
    });

    it('accetta file esattamente 20MB', () => {
      const file = { type: 'application/pdf', size: 20 * 1024 * 1024 };
      expect(() => analyzer.validateFile(file)).not.toThrow();
    });
  });

  // ─── buildSystemPrompt ────────────────────────────

  describe('buildSystemPrompt', () => {
    it('include lingua output nel prompt', () => {
      const prompt = analyzer.buildSystemPrompt({ outputLanguage: 'it' });
      expect(prompt).toContain('italiano');
    });

    it('usa italiano come default', () => {
      const prompt = analyzer.buildSystemPrompt({});
      expect(prompt).toContain('italiano');
    });

    it('contiene istruzioni per formato JSON', () => {
      const prompt = analyzer.buildSystemPrompt({});
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('summary');
      expect(prompt).toContain('keyPoints');
    });
  });

  // ─── buildUserPrompt ──────────────────────────────

  describe('buildUserPrompt', () => {
    it('include testo del documento', () => {
      const prompt = analyzer.buildUserPrompt('Contenuto del PDF', {});
      expect(prompt).toContain('Contenuto del PDF');
    });

    it('usa istruzione detailed come default', () => {
      const prompt = analyzer.buildUserPrompt('test', {});
      expect(prompt).toContain('dettagliato');
    });

    it('usa istruzione short se richiesto', () => {
      const prompt = analyzer.buildUserPrompt('test', { summaryLength: 'short' });
      expect(prompt).toContain('breve');
    });

    it('usa istruzione medium se richiesto', () => {
      const prompt = analyzer.buildUserPrompt('test', { summaryLength: 'medium' });
      expect(prompt).toContain('medio');
    });
  });

  // ─── parseAnalysisResponse ────────────────────────

  describe('parseAnalysisResponse', () => {
    it('parsa risposta JSON valida', () => {
      const json = JSON.stringify({
        summary: 'Riassunto test',
        keyPoints: [{ title: 'P1', description: 'D1' }],
        quotes: ['Citazione 1'],
      });
      parseLLMJson.mockReturnValue(JSON.parse(json));

      const result = analyzer.parseAnalysisResponse(json);
      expect(result.summary).toBe('Riassunto test');
      expect(result.keyPoints).toHaveLength(1);
      expect(result.quotes).toHaveLength(1);
    });

    it('ritorna risposta grezza se parsing fallisce', () => {
      parseLLMJson.mockImplementation(() => {
        throw new Error('Invalid JSON');
      });
      const result = analyzer.parseAnalysisResponse('testo libero');
      expect(result.summary).toBe('testo libero');
      expect(result.keyPoints).toEqual([]);
      expect(result.quotes).toEqual([]);
    });

    it('gestisce campi mancanti nel JSON', () => {
      parseLLMJson.mockReturnValue({});
      const result = analyzer.parseAnalysisResponse('{}');
      expect(result.summary).toBe('');
      expect(result.keyPoints).toEqual([]);
      expect(result.quotes).toEqual([]);
    });
  });

  // ─── extractTextFromPDF ───────────────────────────

  describe('extractTextFromPDF', () => {
    it('estrae testo da tutte le pagine', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Hello' }, { str: 'World' }],
        }),
      };
      const mockPdf = {
        numPages: 2,
        getPage: vi.fn().mockResolvedValue(mockPage),
      };
      pdfjsLib.getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) });

      const file = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      };

      const result = await analyzer.extractTextFromPDF(file);
      expect(result.pageCount).toBe(2);
      expect(result.text).toContain('Hello World');
      expect(result.text).toContain('Pagina 1');
      expect(result.text).toContain('Pagina 2');
    });

    it('lancia errore per PDF protetto da password', async () => {
      const err = new Error('Password required');
      err.name = 'PasswordException';
      pdfjsLib.getDocument.mockReturnValue({ promise: Promise.reject(err) });

      const file = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      };

      await expect(analyzer.extractTextFromPDF(file)).rejects.toThrow('protetto da password');
    });

    it('lancia errore generico per altri fallimenti', async () => {
      pdfjsLib.getDocument.mockReturnValue({
        promise: Promise.reject(new Error('corrupt')),
      });

      const file = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      };

      await expect(analyzer.extractTextFromPDF(file)).rejects.toThrow('Impossibile estrarre');
    });
  });

  // ─── callAnalysisAPI ──────────────────────────────

  describe('callAnalysisAPI', () => {
    it('chiama API con prompt corretto e ritorna analisi', async () => {
      StorageManager.getApiKey.mockResolvedValue('test-key');
      APIClient.generateCompletion.mockResolvedValue(
        JSON.stringify({
          summary: 'Test summary',
          keyPoints: [],
          quotes: [],
        }),
      );
      parseLLMJson.mockReturnValue({
        summary: 'Test summary',
        keyPoints: [],
        quotes: [],
      });

      const result = await analyzer.callAnalysisAPI('testo pdf', 'claude', {});
      expect(result.summary).toBe('Test summary');
      expect(StorageManager.getApiKey).toHaveBeenCalledWith('claude');
    });

    it('lancia errore se API key non configurata', async () => {
      StorageManager.getApiKey.mockResolvedValue(null);
      await expect(analyzer.callAnalysisAPI('text', 'claude')).rejects.toThrow(
        'API key non configurata',
      );
    });

    it('lancia errore se API fallisce', async () => {
      StorageManager.getApiKey.mockResolvedValue('key');
      APIClient.generateCompletion.mockRejectedValue(new Error('network error'));

      await expect(analyzer.callAnalysisAPI('text', 'claude')).rejects.toThrow(
        "Errore durante l'analisi",
      );
    });

    it('invoca progressCallback durante analisi', async () => {
      StorageManager.getApiKey.mockResolvedValue('key');
      APIClient.generateCompletion.mockResolvedValue('{}');
      parseLLMJson.mockReturnValue({});

      const progress = vi.fn();
      await analyzer.callAnalysisAPI('text', 'claude', {}, progress);
      expect(progress).toHaveBeenCalledWith(expect.stringContaining('riassunto'), 50);
    });
  });

  // ─── analyzePDF (integrazione) ────────────────────

  describe('analyzePDF', () => {
    const createMockFile = (size = 1024) => ({
      type: 'application/pdf',
      size,
      name: 'test.pdf',
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
    });

    it('ritorna da cache se disponibile', async () => {
      mockCacheManager.checkCache.mockResolvedValue({
        found: true,
        fileHash: 'abc123',
        data: {
          filename: 'cached.pdf',
          pageCount: 5,
          extractedText: 'cached text',
          analysis: { summary: 'from cache', keyPoints: [], quotes: [] },
        },
      });

      const result = await analyzer.analyzePDF(createMockFile());
      expect(result.isFromCache).toBe(true);
      expect(result.summary).toBe('from cache');
      expect(result.filename).toBe('cached.pdf');
    });

    it('rifiuta file non PDF', async () => {
      const file = { type: 'text/plain', size: 100, name: 'test.txt' };
      await expect(analyzer.analyzePDF(file)).rejects.toThrow('File non valido');
    });

    it('rifiuta file troppo grande', async () => {
      const file = { type: 'application/pdf', size: 25 * 1024 * 1024, name: 'big.pdf' };
      await expect(analyzer.analyzePDF(file)).rejects.toThrow('troppo grande');
    });

    it('lancia errore se testo estratto insufficiente', async () => {
      mockCacheManager.checkCache.mockResolvedValue({ found: false, fileHash: 'h' });

      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'ab' }] }),
      };
      pdfjsLib.getDocument.mockReturnValue({
        promise: Promise.resolve({ numPages: 1, getPage: vi.fn().mockResolvedValue(mockPage) }),
      });

      await expect(analyzer.analyzePDF(createMockFile())).rejects.toThrow('insufficiente');
    });
  });

  // ─── loadFromHistory ──────────────────────────────

  describe('loadFromHistory', () => {
    it('ritorna entry dalla cronologia', async () => {
      mockCacheManager.getHistory.mockResolvedValue([
        {
          id: 'pdf_123',
          filename: 'doc.pdf',
          pageCount: 3,
          extractedText: 'text',
          analysis: { summary: 'test', keyPoints: [], quotes: [] },
          timestamp: 1000,
          apiProvider: 'claude',
        },
      ]);

      const result = await analyzer.loadFromHistory('pdf_123');
      expect(result.filename).toBe('doc.pdf');
      expect(result.summary).toBe('test');
      expect(result.isFromCache).toBe(true);
    });

    it('lancia errore se entry non trovata', async () => {
      mockCacheManager.getHistory.mockResolvedValue([]);
      await expect(analyzer.loadFromHistory('nonexistent')).rejects.toThrow('non trovata');
    });
  });
});
