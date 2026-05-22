import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Logger
vi.mock('@utils/core/logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock browser.storage.local
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
      getBytesInUse: vi.fn(() => Promise.resolve(4096)),
    },
  },
};

// Mock crypto.subtle — use vi.stubGlobal to avoid read-only property error
const mockDigest = vi.fn();
vi.stubGlobal('crypto', {
  subtle: {
    digest: mockDigest,
  },
  randomUUID: () => 'test-uuid-1234',
});

import { PDFCacheManager } from '@utils/pdf/pdf-cache-manager.js';

describe('PDFCacheManager', () => {
  let cache;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];

    // Default mock per crypto.subtle.digest
    mockDigest.mockResolvedValue(new Uint8Array([0xab, 0xcd, 0xef, 0x12]).buffer);

    cache = new PDFCacheManager();
  });

  // ─── Constructor ──────────────────────────────────

  describe('constructor', () => {
    it('configura costanti', () => {
      expect(cache.STORAGE_KEY).toBe('pdf_analysis_history');
      expect(cache.MAX_ENTRIES).toBe(50);
      expect(cache.DAYS_TO_KEEP).toBe(30);
    });
  });

  // ─── calculateFileHash ────────────────────────────

  describe('calculateFileHash', () => {
    it('calcola hash SHA-256 come stringa hex', async () => {
      const file = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)) };
      const hash = await cache.calculateFileHash(file);
      expect(hash).toBe('abcdef12');
      expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
    });

    it('lancia errore se crypto fallisce', async () => {
      mockDigest.mockRejectedValue(new Error('crypto error'));
      const file = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)) };
      await expect(cache.calculateFileHash(file)).rejects.toThrow('Impossibile calcolare hash');
    });
  });

  // ─── checkCache ───────────────────────────────────

  describe('checkCache', () => {
    it('ritorna found:true se file presente in cronologia', async () => {
      store.pdf_analysis_history = [
        { fileHash: 'abcdef12', filename: 'doc.pdf', analysis: { summary: 'cached' } },
      ];

      const file = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)) };
      const result = await cache.checkCache(file);

      expect(result.found).toBe(true);
      expect(result.data.filename).toBe('doc.pdf');
      expect(result.fileHash).toBe('abcdef12');
    });

    it('ritorna found:false se file non in cronologia', async () => {
      store.pdf_analysis_history = [];
      const file = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)) };
      const result = await cache.checkCache(file);
      expect(result.found).toBe(false);
      expect(result.fileHash).toBe('abcdef12');
    });

    it('ritorna found:false su errore', async () => {
      mockDigest.mockRejectedValue(new Error('fail'));
      const file = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)) };
      const result = await cache.checkCache(file);
      expect(result.found).toBe(false);
    });
  });

  // ─── saveAnalysis ─────────────────────────────────

  describe('saveAnalysis', () => {
    it('salva entry in testa alla cronologia', async () => {
      store.pdf_analysis_history = [];

      const file = {
        name: 'test.pdf',
        size: 2048,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      };
      const analysis = {
        summary: 'Summary',
        keyPoints: [{ title: 'P1' }],
        quotes: ['Q1'],
        pageCount: 3,
      };

      const entry = await cache.saveAnalysis(file, 'extracted text', analysis, 'claude', 'hash123');

      expect(entry.id).toMatch(/^pdf_/);
      expect(entry.filename).toBe('test.pdf');
      expect(entry.fileSize).toBe(2048);
      expect(entry.fileHash).toBe('hash123');
      expect(entry.analysis.summary).toBe('Summary');
      expect(entry.apiProvider).toBe('claude');

      // Verifica che sia salvato in storage
      expect(browser.storage.local.set).toHaveBeenCalled();
    });

    it('calcola hash se non fornito', async () => {
      store.pdf_analysis_history = [];

      const file = {
        name: 'test.pdf',
        size: 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      };

      const entry = await cache.saveAnalysis(
        file,
        'text',
        { summary: 's', keyPoints: [] },
        'openai',
      );
      expect(entry.fileHash).toBe('abcdef12');
    });

    it('limita cronologia a MAX_ENTRIES', async () => {
      // Pre-popola con 50 entry
      store.pdf_analysis_history = Array.from({ length: 50 }, (_, i) => ({
        id: `pdf_${i}`,
        fileHash: `h${i}`,
        timestamp: i,
      }));

      const file = {
        name: 'new.pdf',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      };

      await cache.saveAnalysis(
        file,
        'text',
        { summary: 'new', keyPoints: [] },
        'claude',
        'new_hash',
      );

      // Verifica che il set sia stato chiamato con max 50 entry
      const savedData = browser.storage.local.set.mock.calls[0][0];
      expect(savedData.pdf_analysis_history).toHaveLength(50);
      expect(savedData.pdf_analysis_history[0].filename).toBe('new.pdf');
    });
  });

  // ─── getHistory ───────────────────────────────────

  describe('getHistory', () => {
    it('ritorna cronologia da storage', async () => {
      store.pdf_analysis_history = [{ id: 'pdf_1' }, { id: 'pdf_2' }];
      const history = await cache.getHistory();
      expect(history).toHaveLength(2);
    });

    it('ritorna array vuoto se non presente', async () => {
      const history = await cache.getHistory();
      expect(history).toEqual([]);
    });

    it('ritorna array vuoto su errore', async () => {
      browser.storage.local.get.mockRejectedValueOnce(new Error('fail'));
      const history = await cache.getHistory();
      expect(history).toEqual([]);
    });
  });

  // ─── saveHistory ──────────────────────────────────

  describe('saveHistory', () => {
    it('salva array in browser.storage', async () => {
      await cache.saveHistory([{ id: 'pdf_1' }]);
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        pdf_analysis_history: [{ id: 'pdf_1' }],
      });
    });

    it('propaga errore se storage fallisce', async () => {
      browser.storage.local.set.mockRejectedValueOnce(new Error('quota exceeded'));
      await expect(cache.saveHistory([])).rejects.toThrow('quota exceeded');
    });
  });

  // ─── deleteEntry ──────────────────────────────────

  describe('deleteEntry', () => {
    it('rimuove entry per id', async () => {
      store.pdf_analysis_history = [
        { id: 'pdf_1', filename: 'a.pdf' },
        { id: 'pdf_2', filename: 'b.pdf' },
      ];

      await cache.deleteEntry('pdf_1');

      const savedData = browser.storage.local.set.mock.calls[0][0];
      expect(savedData.pdf_analysis_history).toHaveLength(1);
      expect(savedData.pdf_analysis_history[0].id).toBe('pdf_2');
    });

    it('non modifica nulla se id non trovato', async () => {
      store.pdf_analysis_history = [{ id: 'pdf_1' }];
      await cache.deleteEntry('nonexistent');
      const savedData = browser.storage.local.set.mock.calls[0][0];
      expect(savedData.pdf_analysis_history).toHaveLength(1);
    });
  });

  // ─── cleanOldEntries ──────────────────────────────

  describe('cleanOldEntries', () => {
    it('rimuove entry più vecchie di daysToKeep', async () => {
      const now = Date.now();
      const old = now - 31 * 24 * 60 * 60 * 1000; // 31 giorni fa
      const recent = now - 1 * 24 * 60 * 60 * 1000; // 1 giorno fa

      store.pdf_analysis_history = [
        { id: 'pdf_old', timestamp: old },
        { id: 'pdf_new', timestamp: recent },
      ];

      await cache.cleanOldEntries(30);

      const savedData = browser.storage.local.set.mock.calls[0][0];
      expect(savedData.pdf_analysis_history).toHaveLength(1);
      expect(savedData.pdf_analysis_history[0].id).toBe('pdf_new');
    });

    it('non salva se niente da rimuovere', async () => {
      const now = Date.now();
      store.pdf_analysis_history = [{ id: 'pdf_1', timestamp: now }];

      await cache.cleanOldEntries(30);
      expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    it('accetta daysToKeep personalizzato', async () => {
      const now = Date.now();
      const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000;

      store.pdf_analysis_history = [{ id: 'pdf_1', timestamp: fiveDaysAgo }];

      await cache.cleanOldEntries(3);

      const savedData = browser.storage.local.set.mock.calls[0][0];
      expect(savedData.pdf_analysis_history).toHaveLength(0);
    });

    it('non crasha su errore', async () => {
      browser.storage.local.get.mockRejectedValueOnce(new Error('fail'));
      await expect(cache.cleanOldEntries()).resolves.toBeUndefined();
    });
  });

  // ─── getStorageStats ──────────────────────────────

  describe('getStorageStats', () => {
    it('ritorna statistiche corrette', async () => {
      store.pdf_analysis_history = [{ id: 'pdf_1' }, { id: 'pdf_2' }];

      const stats = await cache.getStorageStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.bytesInUse).toBe(4096);
      expect(stats.maxEntries).toBe(50);
      expect(stats.daysToKeep).toBe(30);
    });

    it('ritorna null su errore di getBytesInUse', async () => {
      store.pdf_analysis_history = [{ id: 'pdf_1' }];
      browser.storage.local.getBytesInUse.mockRejectedValueOnce(new Error('fail'));
      const stats = await cache.getStorageStats();
      expect(stats).toBeNull();
    });
  });
});
