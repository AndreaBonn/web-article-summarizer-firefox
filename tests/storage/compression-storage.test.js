import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

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

import { CompressionStorage } from '@utils/storage/compression-storage.js';

describe('CompressionStorage', () => {
  let storage;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
    storage = new CompressionStorage();
  });

  describe('saveCompressed()', () => {
    it('test_saveCompressed_smallData_savesToChromeStorage', async () => {
      const result = await storage.saveCompressed('testKey', 'Hello world');

      expect(result.success).toBe(true);
      expect(result.savedTo).toBe('browser.storage');
      expect(store.testKey).toBeDefined();
      expect(store.testKey.key).toBe('testKey');
    });

    it('test_saveCompressed_tracksOriginalSize', async () => {
      const data = 'Test data for compression';
      const result = await storage.saveCompressed('testKey', data);

      expect(result.originalSize).toBe(data.length);
      expect(result.compressedSize).toBeGreaterThan(0);
    });

    it('test_saveCompressed_storageError_throws', async () => {
      browser.storage.local.set.mockRejectedValueOnce(new Error('Quota exceeded'));

      await expect(storage.saveCompressed('testKey', 'data')).rejects.toThrow(
        'Salvataggio compresso fallito',
      );
    });
  });

  describe('loadCompressed()', () => {
    it('test_loadCompressed_existingKey_returnsDecompressedData', async () => {
      await storage.saveCompressed('testKey', 'Original data');
      const loaded = await storage.loadCompressed('testKey');

      expect(loaded).not.toBeNull();
      expect(loaded.data).toBe('Original data');
      expect(loaded.metadata.timestamp).toBeDefined();
    });

    it('test_loadCompressed_nonExistingKey_returnsNull', async () => {
      const loaded = await storage.loadCompressed('nonexistent');
      expect(loaded).toBeNull();
    });

    it('test_loadCompressed_roundTrip_preservesData', async () => {
      const originalData =
        'This is a longer text that we want to compress and then decompress to verify the round-trip works correctly.';
      await storage.saveCompressed('roundTrip', originalData);
      const loaded = await storage.loadCompressed('roundTrip');

      expect(loaded.data).toBe(originalData);
    });

    it('test_loadCompressed_refInIndexedDB_delegatesToLoadFromIndexedDB', async () => {
      // Simula un ref che indica IndexedDB
      store['myKey_ref'] = { inIndexedDB: true, timestamp: Date.now(), size: 100 };

      // Mock loadFromIndexedDB per restituire dati compressi validi
      const fakeEntry = {
        compressed: true,
        data: 'compressed-data',
        originalSize: 500,
        compressedSize: 100,
        timestamp: Date.now(),
      };
      const spy = vi.spyOn(storage, 'loadFromIndexedDB').mockResolvedValue(fakeEntry);
      vi.spyOn(storage, 'decompress').mockReturnValue('decompressed-data');

      const loaded = await storage.loadCompressed('myKey');

      expect(spy).toHaveBeenCalledWith('myKey');
      expect(loaded.data).toBe('decompressed-data');

      spy.mockRestore();
    });

    it('test_loadCompressed_corruptedData_throwsWithMessage', async () => {
      // Salva entry che causerà errore in decompress
      store['badKey'] = { compressed: true, data: null, originalSize: 10, compressedSize: 5 };
      vi.spyOn(storage, 'decompress').mockImplementation(() => {
        throw new Error('Invalid data');
      });

      await expect(storage.loadCompressed('badKey')).rejects.toThrow(
        'Dati compressi corrotti o illeggibili',
      );
    });
  });

  describe('saveCompressed() — IndexedDB path', () => {
    it('test_saveCompressed_useIndexedDBTrueButSmallData_savesToChromeStorage', async () => {
      const result = await storage.saveCompressed('smallKey', 'small data', true);

      expect(result.success).toBe(true);
      expect(result.savedTo).toBe('browser.storage');
      expect(store.smallKey).toBeDefined();
    });

    it('test_saveCompressed_useIndexedDBTrueAndLargeData_delegatesToSaveToIndexedDB', async () => {
      // Crea dati grandi (originalSize > 50000)
      const largeData = 'x'.repeat(60000);
      const spy = vi.spyOn(storage, 'saveToIndexedDB').mockResolvedValue();

      const result = await storage.saveCompressed('largeKey', largeData, true);

      expect(spy).toHaveBeenCalledWith('largeKey', expect.objectContaining({ key: 'largeKey' }));
      expect(result.success).toBe(true);
      expect(result.savedTo).toBe('IndexedDB');
      // Verifica che il ref sia salvato in browser.storage
      expect(store['largeKey_ref']).toBeDefined();
      expect(store['largeKey_ref'].inIndexedDB).toBe(true);

      spy.mockRestore();
    });

    it('test_saveCompressed_indexedDBError_throwsWithMessage', async () => {
      const largeData = 'x'.repeat(60000);
      vi.spyOn(storage, 'saveToIndexedDB').mockRejectedValue(new Error('IndexedDB failed'));

      await expect(storage.saveCompressed('failKey', largeData, true)).rejects.toThrow(
        'Salvataggio compresso fallito',
      );
    });
  });

  describe('saveToIndexedDB()', () => {
    function mockIndexedDB(openHandler) {
      globalThis.indexedDB = {
        open: vi.fn((...args) => {
          const request = {};
          setTimeout(() => openHandler(request, args), 0);
          return request;
        }),
      };
    }

    afterEach(() => {
      delete globalThis.indexedDB;
    });

    it('test_saveToIndexedDB_success_resolves', async () => {
      const putRequest = {};
      const mockStore = {
        put: vi.fn(() => {
          setTimeout(() => putRequest.onsuccess(), 0);
          return putRequest;
        }),
      };
      const mockDb = {
        transaction: vi.fn(() => ({ objectStore: vi.fn(() => mockStore) })),
      };

      mockIndexedDB((req) => req.onsuccess({ target: { result: mockDb } }));

      await storage.saveToIndexedDB('testKey', { data: 'test' });
      expect(mockStore.put).toHaveBeenCalledWith(expect.objectContaining({ key: 'testKey' }));
    });

    it('test_saveToIndexedDB_openError_rejects', async () => {
      mockIndexedDB((req) => {
        req.error = new Error('DB open failed');
        req.onerror();
      });

      await expect(storage.saveToIndexedDB('key', {})).rejects.toThrow('DB open failed');
    });

    it('test_saveToIndexedDB_putError_rejects', async () => {
      const putRequest = { error: new Error('Put failed') };
      const mockStore = {
        put: vi.fn(() => {
          setTimeout(() => putRequest.onerror(), 0);
          return putRequest;
        }),
      };
      const mockDb = {
        transaction: vi.fn(() => ({ objectStore: vi.fn(() => mockStore) })),
      };

      mockIndexedDB((req) => req.onsuccess({ target: { result: mockDb } }));

      await expect(storage.saveToIndexedDB('key', {})).rejects.toThrow('Put failed');
    });

    it('test_saveToIndexedDB_upgradeNeeded_createsStore', async () => {
      const putRequest = {};
      const mockDb = {
        objectStoreNames: { contains: vi.fn(() => false) },
        createObjectStore: vi.fn(),
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            put: vi.fn(() => {
              setTimeout(() => putRequest.onsuccess(), 0);
              return putRequest;
            }),
          })),
        })),
      };

      mockIndexedDB((req) => {
        req.onupgradeneeded({ target: { result: mockDb } });
        req.onsuccess({ target: { result: mockDb } });
      });

      await storage.saveToIndexedDB('key', {});
      expect(mockDb.createObjectStore).toHaveBeenCalledWith('compressed_data', { keyPath: 'key' });
    });
  });

  describe('loadFromIndexedDB()', () => {
    function mockIndexedDB(openHandler) {
      globalThis.indexedDB = {
        open: vi.fn((...args) => {
          const request = {};
          setTimeout(() => openHandler(request, args), 0);
          return request;
        }),
      };
    }

    afterEach(() => {
      delete globalThis.indexedDB;
    });

    it('test_loadFromIndexedDB_success_returnsResult', async () => {
      const getRequest = { result: { key: 'testKey', data: 'stored' } };
      const mockStore = {
        get: vi.fn(() => {
          setTimeout(() => getRequest.onsuccess(), 0);
          return getRequest;
        }),
      };
      const mockDb = {
        transaction: vi.fn(() => ({ objectStore: vi.fn(() => mockStore) })),
      };

      mockIndexedDB((req) => req.onsuccess({ target: { result: mockDb } }));

      const result = await storage.loadFromIndexedDB('testKey');
      expect(result).toEqual({ key: 'testKey', data: 'stored' });
    });

    it('test_loadFromIndexedDB_openError_rejects', async () => {
      mockIndexedDB((req) => {
        req.error = new Error('DB open failed');
        req.onerror();
      });

      await expect(storage.loadFromIndexedDB('key')).rejects.toThrow('DB open failed');
    });

    it('test_loadFromIndexedDB_getError_rejects', async () => {
      const getRequest = { error: new Error('Get failed') };
      const mockStore = {
        get: vi.fn(() => {
          setTimeout(() => getRequest.onerror(), 0);
          return getRequest;
        }),
      };
      const mockDb = {
        transaction: vi.fn(() => ({ objectStore: vi.fn(() => mockStore) })),
      };

      mockIndexedDB((req) => req.onsuccess({ target: { result: mockDb } }));

      await expect(storage.loadFromIndexedDB('key')).rejects.toThrow('Get failed');
    });
  });
});
