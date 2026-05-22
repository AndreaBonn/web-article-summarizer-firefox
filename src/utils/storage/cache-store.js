// Cache Store - Operazioni core get/set/invalidate con TTL e hashing
import { Logger } from '../core/logger.js';
import { CacheInvalidation } from './cache-invalidation.js';

export class CacheStore extends CacheInvalidation {
  constructor() {
    super();
    this.defaultTTL = 7 * 24 * 60 * 60 * 1000; // 7 giorni in millisecondi
  }

  /**
   * Genera chiave cache univoca basata su URL e parametri
   */
  generateCacheKey(url, provider, settings) {
    const params = {
      url: this.normalizeUrl(url),
      provider,
      summaryLength: settings.summaryLength,
      outputLanguage: settings.outputLanguage,
      contentType: settings.contentType,
    };

    return this.hashObject(params);
  }

  /**
   * Normalizza URL per cache consistency
   */
  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      // Rimuovi parametri di tracking comuni
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
      paramsToRemove.forEach((param) => urlObj.searchParams.delete(param));

      // Rimuovi hash
      urlObj.hash = '';

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Hash FNV-1a a 52-bit di un oggetto per generare chiave cache.
   * Usa due hash indipendenti (FNV-1a con seed diversi) combinati in una chiave
   * a 52 bit per ridurre drasticamente le collisioni rispetto a djb2 a 32 bit.
   */
  hashObject(obj) {
    const str = JSON.stringify(obj);
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= c;
      h2 = Math.imul(h2, 0x811c9dc5);
    }
    const hi = (Math.abs(h1) >>> 0).toString(36);
    const lo = (Math.abs(h2) >>> 0).toString(36);
    return `cache_${hi}_${lo}`;
  }

  /**
   * Genera hash semplice del contenuto per validazione
   */
  static hashContent(content) {
    if (!content) return null;

    // Sample from start, middle, and end for better collision resistance
    const len = content.length;
    const chunkSize = 700;
    let sample = content.substring(0, chunkSize);
    if (len > chunkSize * 2) {
      const mid = Math.floor(len / 2) - Math.floor(chunkSize / 2);
      sample += content.substring(mid, mid + chunkSize);
    }
    if (len > chunkSize * 3) {
      sample += content.substring(len - chunkSize);
    }

    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
      const char = sample.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Configura TTL personalizzato
   */
  setDefaultTTL(days) {
    this.defaultTTL = days * 24 * 60 * 60 * 1000;
  }

  /**
   * Ottieni TTL configurato
   */
  getDefaultTTL() {
    return Math.floor(this.defaultTTL / (24 * 60 * 60 * 1000));
  }

  /**
   * Salva risultato in cache con TTL e hash contenuto
   */
  async set(url, provider, settings, data, customTTL = null, contentHash = null) {
    const cacheKey = this.generateCacheKey(url, provider, settings);
    const ttl = customTTL || this.defaultTTL;

    const cacheEntry = {
      key: cacheKey,
      url,
      provider,
      settings,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      hits: 0,
      lastAccessed: Date.now(),
      contentHash: contentHash || null,
    };

    try {
      const result = await browser.storage.local.get(['summaryCache']);
      const cache = result.summaryCache || {};

      cache[cacheKey] = cacheEntry;

      await browser.storage.local.set({ summaryCache: cache });

      this.logCacheOperation('write', cacheKey, true);

      return true;
    } catch (error) {
      Logger.error('Errore nel salvare cache:', error);
      this.logCacheOperation('write', cacheKey, false, error.message);
      return false;
    }
  }

  /**
   * Recupera risultato dalla cache con validazione contenuto
   */
  async get(url, provider, settings, contentHash = null) {
    const cacheKey = this.generateCacheKey(url, provider, settings);

    try {
      const result = await browser.storage.local.get(['summaryCache']);
      const cache = result.summaryCache || {};

      const entry = cache[cacheKey];

      // Cache miss
      if (!entry) {
        this.logCacheOperation('read', cacheKey, false, 'miss');
        return null;
      }

      // Cache expired
      if (Date.now() > entry.expiresAt) {
        await this.invalidate(cacheKey);
        this.logCacheOperation('read', cacheKey, false, 'expired');
        return null;
      }

      // Validazione contenuto: se fornito un hash, verifica che corrisponda
      if (contentHash && entry.contentHash && entry.contentHash !== contentHash) {
        await this.invalidate(cacheKey);
        this.logCacheOperation('read', cacheKey, false, 'content_changed');
        return null;
      }

      // Validazione età: se la cache è troppo vecchia (>24h), potrebbe essere obsoleta
      const cacheAge = Date.now() - entry.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 ore

      if (cacheAge > maxAge) {
        this.logCacheOperation('read', cacheKey, true, 'old_cache');
      }

      // Cache hit — NON scrivere su disco per una lettura (performance)
      return entry.data;
    } catch (error) {
      Logger.error('Errore nel leggere cache:', error);
      this.logCacheOperation('read', cacheKey, false, error.message);
      return null;
    }
  }

  /**
   * Invalida una entry specifica
   */
  async invalidate(cacheKey) {
    try {
      const result = await browser.storage.local.get(['summaryCache']);
      const cache = result.summaryCache || {};

      if (cache[cacheKey]) {
        delete cache[cacheKey];
        await browser.storage.local.set({ summaryCache: cache });
        this.logCacheOperation('invalidate', cacheKey, true);
        return true;
      }

      return false;
    } catch (error) {
      Logger.error("Errore nell'invalidare cache:", error);
      this.logCacheOperation('invalidate', cacheKey, false, error.message);
      return false;
    }
  }

  /**
   * Invalida tutte le entry per un URL specifico
   */
  async invalidateByUrl(url) {
    return super.invalidateByUrl(this.normalizeUrl(url), this.normalizeUrl.bind(this));
  }

  /**
   * Invalida cache per URL se il contenuto è cambiato
   */
  async invalidateIfContentChanged(url, newContentHash) {
    return super.invalidateIfContentChanged(
      this.normalizeUrl(url),
      newContentHash,
      this.normalizeUrl.bind(this),
    );
  }

  /**
   * Pulisci tutta la cache
   */
  async clearAll() {
    await browser.storage.local.remove(['summaryCache']);
  }

  /**
   * Log operazione cache per telemetria.
   * Sovrascritto da CacheManager (che eredita CacheStats.logCacheOperation).
   */
  async logCacheOperation(_operation, _key, _success, _reason = null) {
    // Implementazione fornita dalla catena: CacheStore → CacheStats (via CacheManager)
  }
}
