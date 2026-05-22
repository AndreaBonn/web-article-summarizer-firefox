// Compression Storage - Salvataggio/caricamento dati compressi in browser.storage e IndexedDB
import { Logger } from '../core/logger.js';
import { CompressionCore } from './compression-core.js';

export class CompressionStorage extends CompressionCore {
  /**
   * Salva dati compressi in storage
   */
  async saveCompressed(key, data, useIndexedDB = false) {
    const compressed = this.compress(data);

    const entry = {
      ...compressed,
      timestamp: Date.now(),
      key,
    };

    try {
      if (useIndexedDB && compressed.originalSize > 50000) {
        // Usa IndexedDB per dati grandi
        await this.saveToIndexedDB(key, entry);

        // Salva riferimento in browser.storage
        await browser.storage.local.set({
          [`${key}_ref`]: {
            inIndexedDB: true,
            timestamp: Date.now(),
            size: compressed.compressedSize,
          },
        });
      } else {
        // Usa browser.storage per dati piccoli
        await browser.storage.local.set({ [key]: entry });
      }

      return {
        success: true,
        compressed: compressed.compressed,
        originalSize: compressed.originalSize,
        compressedSize: compressed.compressedSize,
        savedTo: useIndexedDB && compressed.originalSize > 50000 ? 'IndexedDB' : 'browser.storage',
      };
    } catch (error) {
      Logger.error('Errore nel salvare dati compressi:', error);
      throw new Error(`Salvataggio compresso fallito: ${error.message}`, { cause: error });
    }
  }

  /**
   * Carica dati compressi da storage
   */
  async loadCompressed(key) {
    try {
      // Controlla se è in IndexedDB
      const refResult = await browser.storage.local.get([`${key}_ref`]);
      const ref = refResult[`${key}_ref`];

      let entry;

      if (ref && ref.inIndexedDB) {
        // Carica da IndexedDB
        entry = await this.loadFromIndexedDB(key);
      } else {
        // Carica da browser.storage
        const result = await browser.storage.local.get([key]);
        entry = result[key];
      }

      if (!entry) {
        return null;
      }

      const decompressed = this.decompress(entry);

      return {
        data: decompressed,
        metadata: {
          compressed: entry.compressed,
          originalSize: entry.originalSize,
          compressedSize: entry.compressedSize,
          timestamp: entry.timestamp,
        },
      };
    } catch (error) {
      Logger.error('Errore nel caricare dati compressi (possibile corruzione):', error);
      throw new Error(`Dati compressi corrotti o illeggibili: ${error.message}`, { cause: error });
    }
  }

  /**
   * Salva in IndexedDB
   */
  async saveToIndexedDB(key, data) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AIArticleSummarizer', 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['compressed_data'], 'readwrite');
        const store = transaction.objectStore('compressed_data');

        const putRequest = store.put({ key, ...data });

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('compressed_data')) {
          db.createObjectStore('compressed_data', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Carica da IndexedDB
   */
  async loadFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AIArticleSummarizer', 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['compressed_data'], 'readonly');
        const store = transaction.objectStore('compressed_data');

        const getRequest = store.get(key);

        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }
}
