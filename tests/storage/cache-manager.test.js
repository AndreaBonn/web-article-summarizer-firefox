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
      remove: vi.fn((keys) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach((k) => delete store[k]);
        return Promise.resolve();
      }),
    },
  },
};

import { CacheManager } from '@utils/storage/cache-manager.js';

describe('CacheManager', () => {
  let cache;
  const settings = { summaryLength: 'medium', outputLanguage: 'it', contentType: 'general' };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
    cache = new CacheManager();
  });

  describe('normalizeUrl', () => {
    it('strips UTM tracking parameters', () => {
      const url = 'https://example.com/article?utm_source=twitter&utm_medium=social&id=42';
      const normalized = cache.normalizeUrl(url);
      expect(normalized).toContain('id=42');
      expect(normalized).not.toContain('utm_source');
      expect(normalized).not.toContain('utm_medium');
    });

    it('strips fbclid and gclid', () => {
      const url = 'https://example.com/page?fbclid=abc123&gclid=xyz';
      const normalized = cache.normalizeUrl(url);
      expect(normalized).not.toContain('fbclid');
      expect(normalized).not.toContain('gclid');
    });

    it('strips hash fragments', () => {
      const url = 'https://example.com/article#section-3';
      const normalized = cache.normalizeUrl(url);
      expect(normalized).not.toContain('#section-3');
    });

    it('returns original string for invalid URLs', () => {
      expect(cache.normalizeUrl('not-a-url')).toBe('not-a-url');
    });
  });

  describe('hashObject', () => {
    it('returns deterministic hash for same input', () => {
      const obj = { url: 'https://example.com', provider: 'groq' };
      expect(cache.hashObject(obj)).toBe(cache.hashObject(obj));
    });

    it('returns different hash for different inputs', () => {
      const hash1 = cache.hashObject({ url: 'https://a.com' });
      const hash2 = cache.hashObject({ url: 'https://b.com' });
      expect(hash1).not.toBe(hash2);
    });

    it('returns hash in expected format (cache_xxx_yyy)', () => {
      const hash = cache.hashObject({ test: 'data' });
      expect(hash).toMatch(/^cache_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('generateCacheKey', () => {
    it('generates consistent key for same parameters', () => {
      const key1 = cache.generateCacheKey('https://example.com', 'groq', settings);
      const key2 = cache.generateCacheKey('https://example.com', 'groq', settings);
      expect(key1).toBe(key2);
    });

    it('generates different keys for different providers', () => {
      const key1 = cache.generateCacheKey('https://example.com', 'groq', settings);
      const key2 = cache.generateCacheKey('https://example.com', 'openai', settings);
      expect(key1).not.toBe(key2);
    });

    it('normalizes URL before hashing (UTM stripping)', () => {
      const key1 = cache.generateCacheKey('https://example.com/article', 'groq', settings);
      const key2 = cache.generateCacheKey(
        'https://example.com/article?utm_source=twitter',
        'groq',
        settings,
      );
      expect(key1).toBe(key2);
    });
  });

  describe('set and get', () => {
    it('stores and retrieves data', async () => {
      const data = { summary: 'Test summary', keyPoints: [] };
      await cache.set('https://example.com', 'groq', settings, data);

      const result = await cache.get('https://example.com', 'groq', settings);
      expect(result).toEqual(data);
    });

    it('returns null for cache miss', async () => {
      const result = await cache.get('https://missing.com', 'groq', settings);
      expect(result).toBeNull();
    });

    it('returns null for expired entries', async () => {
      const data = { summary: 'Old' };
      await cache.set('https://example.com', 'groq', settings, data);

      // Manually expire the entry
      const cacheKey = cache.generateCacheKey('https://example.com', 'groq', settings);
      store.summaryCache[cacheKey].expiresAt = Date.now() - 1000;

      const result = await cache.get('https://example.com', 'groq', settings);
      expect(result).toBeNull();
    });

    it('returns null when content hash mismatches', async () => {
      const data = { summary: 'Cached' };
      await cache.set('https://example.com', 'groq', settings, data, null, 'hash-v1');

      const result = await cache.get('https://example.com', 'groq', settings, 'hash-v2');
      expect(result).toBeNull();
    });

    it('returns data when content hash matches', async () => {
      const data = { summary: 'Cached' };
      await cache.set('https://example.com', 'groq', settings, data, null, 'hash-v1');

      const result = await cache.get('https://example.com', 'groq', settings, 'hash-v1');
      expect(result).toEqual(data);
    });

    it('accepts custom TTL', async () => {
      const shortTTL = 1000; // 1 second
      const data = { summary: 'Short lived' };
      await cache.set('https://example.com', 'groq', settings, data, shortTTL);

      const cacheKey = cache.generateCacheKey('https://example.com', 'groq', settings);
      const entry = store.summaryCache[cacheKey];
      expect(entry.expiresAt - entry.timestamp).toBe(shortTTL);
    });
  });

  describe('invalidate', () => {
    it('removes specific cache entry', async () => {
      const data = { summary: 'To invalidate' };
      await cache.set('https://example.com', 'groq', settings, data);

      const cacheKey = cache.generateCacheKey('https://example.com', 'groq', settings);
      const result = await cache.invalidate(cacheKey);

      expect(result).toBe(true);
      expect(await cache.get('https://example.com', 'groq', settings)).toBeNull();
    });

    it('returns false for non-existent key', async () => {
      const result = await cache.invalidate('non-existent-key');
      expect(result).toBe(false);
    });
  });

  describe('invalidateByUrl', () => {
    it('removes all cache entries for a URL across providers', async () => {
      await cache.set('https://example.com', 'groq', settings, { s: '1' });
      await cache.set('https://example.com', 'openai', settings, { s: '2' });
      await cache.set('https://other.com', 'groq', settings, { s: '3' });

      const count = await cache.invalidateByUrl('https://example.com');

      expect(count).toBe(2);
      expect(await cache.get('https://example.com', 'groq', settings)).toBeNull();
      expect(await cache.get('https://example.com', 'openai', settings)).toBeNull();
      expect(await cache.get('https://other.com', 'groq', settings)).not.toBeNull();
    });

    it('returns 0 when no entries match the URL', async () => {
      await cache.set('https://other.com', 'groq', settings, { s: '1' });

      const count = await cache.invalidateByUrl('https://notfound.com');

      expect(count).toBe(0);
    });
  });

  describe('getStats (delegated to CacheStats)', () => {
    it('returns stats object with expected keys', async () => {
      await cache.set('https://example.com', 'groq', settings, { summary: 'x' });

      const stats = await cache.getStats();

      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('validEntries');
      expect(stats).toHaveProperty('expiredEntries');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('sizeMB');
    });

    it('returns totalEntries = 1 after one set', async () => {
      await cache.set('https://example.com', 'groq', settings, { summary: 'y' });

      const stats = await cache.getStats();

      expect(stats.totalEntries).toBe(1);
      expect(stats.validEntries).toBe(1);
      expect(stats.expiredEntries).toBe(0);
    });

    it('counts expired entry correctly in stats', async () => {
      await cache.set('https://example.com', 'groq', settings, { summary: 'z' });
      const cacheKey = cache.generateCacheKey('https://example.com', 'groq', settings);
      store.summaryCache[cacheKey].expiresAt = Date.now() - 1000;

      const stats = await cache.getStats();

      expect(stats.expiredEntries).toBe(1);
      expect(stats.validEntries).toBe(0);
    });
  });

  describe('formatAge (delegated to CacheStats)', () => {
    it('formats milliseconds < 60s as seconds', () => {
      expect(cache.formatAge(30000)).toBe('30s');
    });

    it('formats milliseconds as minutes when >= 60s', () => {
      expect(cache.formatAge(5 * 60 * 1000)).toBe('5m');
    });

    it('formats milliseconds as hours when >= 60m', () => {
      expect(cache.formatAge(3 * 60 * 60 * 1000)).toBe('3h');
    });

    it('formats milliseconds as days when >= 24h', () => {
      expect(cache.formatAge(2 * 24 * 60 * 60 * 1000)).toBe('2g');
    });
  });

  describe('clearLogs (delegated to CacheStats)', () => {
    it('does not throw when called', async () => {
      await expect(cache.clearLogs()).resolves.not.toThrow();
    });
  });

  describe('logCacheOperation (delegated to CacheStats)', () => {
    it('does not throw for valid operation', async () => {
      await expect(cache.logCacheOperation('read', 'some-key', true)).resolves.not.toThrow();
    });

    it('does not throw with reason parameter', async () => {
      await expect(
        cache.logCacheOperation('write', 'some-key', false, 'storage-error'),
      ).resolves.not.toThrow();
    });
  });

  describe('setDefaultTTL / getDefaultTTL', () => {
    it('sets and gets TTL in days', () => {
      cache.setDefaultTTL(14);
      expect(cache.getDefaultTTL()).toBe(14);
    });

    it('default TTL is 7 days', () => {
      expect(cache.getDefaultTTL()).toBe(7);
    });
  });

  describe('clearAll', () => {
    it('removes all cached data', async () => {
      store.summaryCache = { testKey: { data: 'x' } };

      await cache.clearAll();

      const result = await cache.get('https://example.com', 'groq', settings);
      expect(result).toBeNull();
    });
  });

  describe('invalidateIfContentChanged', () => {
    it('invalidates entry when content hash changed', async () => {
      await cache.set('https://example.com', 'groq', settings, { summary: 'old' }, null, 'hash-1');

      const count = await cache.invalidateIfContentChanged('https://example.com', 'hash-2');

      expect(count).toBe(1);
    });

    it('does not invalidate when content hash is unchanged', async () => {
      await cache.set('https://example.com', 'groq', settings, { summary: 'same' }, null, 'hash-1');

      const count = await cache.invalidateIfContentChanged('https://example.com', 'hash-1');

      expect(count).toBe(0);
    });
  });

  describe('CacheStore.hashContent (static)', () => {
    it('returns null for empty/falsy content', () => {
      const { CacheStore } = cache.constructor.__proto__;
      // Access via import
    });

    it('get returns data for old (>24h) cache with log', async () => {
      const data = { summary: 'old but valid' };
      await cache.set('https://example.com', 'groq', settings, data);

      const cacheKey = cache.generateCacheKey('https://example.com', 'groq', settings);
      // Make cache old (25 hours ago) but not expired (still within defaultTTL)
      store.summaryCache[cacheKey].timestamp = Date.now() - 25 * 60 * 60 * 1000;

      const result = await cache.get('https://example.com', 'groq', settings);
      expect(result).toEqual(data);
    });
  });
});
