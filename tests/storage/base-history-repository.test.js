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

// Mock crypto.randomUUID — use spy on existing jsdom crypto
vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `uuid-${Date.now()}-${Math.random()}`);

import { BaseHistoryRepository } from '@utils/storage/base-history-repository.js';

describe('BaseHistoryRepository', () => {
  let repo;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
    repo = new BaseHistoryRepository('testHistory', 5);
    // Reset UUID counter for predictability
    let uuidCounter = 0;
    crypto.randomUUID.mockImplementation(() => `uuid-${++uuidCounter}`);
  });

  describe('save', () => {
    it('saves an entry with auto-generated id and timestamp', async () => {
      const id = await repo.save({ title: 'Test Article' });

      expect(id).toBe('uuid-1');
      const items = await repo.getAll();
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Test Article');
      expect(items[0].id).toBe('uuid-1');
      expect(items[0].timestamp).toBeTypeOf('number');
    });

    it('prepends new entries (most recent first)', async () => {
      await repo.save({ title: 'First' });
      await repo.save({ title: 'Second' });

      const items = await repo.getAll();
      expect(items[0].title).toBe('Second');
      expect(items[1].title).toBe('First');
    });

    it('enforces maxEntries limit', async () => {
      for (let i = 0; i < 7; i++) {
        await repo.save({ title: `Article ${i}` });
      }

      const items = await repo.getAll();
      expect(items).toHaveLength(5);
      // Most recent 5 entries kept (Article 6 down to Article 2)
      expect(items[0].title).toBe('Article 6');
      expect(items[4].title).toBe('Article 2');
    });

    it('throws on QUOTA_BYTES error', async () => {
      browser.storage.local.set.mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));

      await expect(repo.save({ title: 'Big' })).rejects.toThrow('Spazio di archiviazione esaurito');
    });

    it('actually persists data (not just in-memory mutation)', async () => {
      await repo.save({ title: 'Persisted' });

      // Verify browser.storage.local.set was called with the data
      expect(browser.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          testHistory: expect.arrayContaining([
            expect.objectContaining({ title: 'Persisted', id: 'uuid-1' }),
          ]),
        }),
      );
    });
  });

  describe('getAll', () => {
    it('returns empty array when no data', async () => {
      const items = await repo.getAll();
      expect(items).toEqual([]);
    });

    it('returns all saved entries', async () => {
      await repo.save({ title: 'A' });
      await repo.save({ title: 'B' });

      const items = await repo.getAll();
      expect(items).toHaveLength(2);
    });

    it('returns a copy, not a reference to the store', async () => {
      await repo.save({ title: 'Original' });

      const items1 = await repo.getAll();
      items1[0].title = 'Mutated';

      const items2 = await repo.getAll();
      expect(items2[0].title).toBe('Original');
    });
  });

  describe('getById', () => {
    it('finds entry by id', async () => {
      const id = await repo.save({ title: 'Target' });
      await repo.save({ title: 'Other' });

      const found = await repo.getById(id);
      expect(found.title).toBe('Target');
    });

    it('returns undefined for non-existent id', async () => {
      await repo.save({ title: 'Something' });

      const found = await repo.getById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('removes entry by id', async () => {
      const id = await repo.save({ title: 'To Delete' });
      await repo.save({ title: 'To Keep' });

      await repo.delete(id);

      const items = await repo.getAll();
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('To Keep');
    });

    it('does nothing for non-existent id', async () => {
      await repo.save({ title: 'Stays' });

      await repo.delete('non-existent');

      const items = await repo.getAll();
      expect(items).toHaveLength(1);
    });
  });

  describe('toggleFavorite', () => {
    it('toggles favorite from undefined to true', async () => {
      const id = await repo.save({ title: 'Article' });

      const result = await repo.toggleFavorite(id);

      expect(result).toBe(true);
      const entry = await repo.getById(id);
      expect(entry.favorite).toBe(true);
    });

    it('toggles favorite from true to false', async () => {
      const id = await repo.save({ title: 'Article' });

      await repo.toggleFavorite(id); // false -> true
      const result = await repo.toggleFavorite(id); // true -> false

      expect(result).toBe(false);
      const entry = await repo.getById(id);
      expect(entry.favorite).toBe(false);
    });

    it('returns false for non-existent id', async () => {
      const result = await repo.toggleFavorite('non-existent');
      expect(result).toBe(false);
    });

    it('persists the toggle (survives re-read)', async () => {
      const id = await repo.save({ title: 'Article' });
      await repo.toggleFavorite(id);

      // Re-read from storage (simulates new session)
      const freshEntry = await repo.getById(id);
      expect(freshEntry.favorite).toBe(true);
    });
  });

  describe('clear', () => {
    it('removes all non-favorite entries', async () => {
      const id1 = await repo.save({ title: 'Keep' });
      await repo.save({ title: 'Remove' });

      await repo.toggleFavorite(id1);
      await repo.clear();

      const items = await repo.getAll();
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Keep');
      expect(items[0].favorite).toBe(true);
    });

    it('removes all entries when none are favorited', async () => {
      await repo.save({ title: 'A' });
      await repo.save({ title: 'B' });

      await repo.clear();

      const items = await repo.getAll();
      expect(items).toHaveLength(0);
    });
  });

  describe('updateField', () => {
    it('updates a field by entry id and persists it', async () => {
      const id = await repo.save({ title: 'Article', notes: null });

      await repo.updateField(id, 'notes', 'My notes');

      // Re-read from storage to verify persistence
      const entry = await repo.getById(id);
      expect(entry.notes).toBe('My notes');
    });

    it('does nothing for non-existent id', async () => {
      await repo.save({ title: 'Article' });

      await repo.updateField('non-existent', 'notes', 'Whatever');

      const items = await repo.getAll();
      expect(items[0].notes).toBeUndefined();
    });
  });

  describe('findByField', () => {
    it('finds entry by nested field path', async () => {
      await repo.save({ article: { url: 'https://example.com' }, title: 'Found' });
      await repo.save({ article: { url: 'https://other.com' }, title: 'Other' });

      const found = await repo.findByField('article.url', 'https://example.com');
      expect(found.title).toBe('Found');
    });

    it('returns undefined when no match', async () => {
      await repo.save({ article: { url: 'https://example.com' } });

      const found = await repo.findByField('article.url', 'https://missing.com');
      expect(found).toBeUndefined();
    });

    it('handles null in nested path gracefully', async () => {
      await repo.save({ article: null, title: 'Null article' });

      const found = await repo.findByField('article.url', 'https://any.com');
      expect(found).toBeUndefined();
    });
  });

  describe('updateByField', () => {
    it('updates entry found by nested field path and persists', async () => {
      await repo.save({ article: { url: 'https://example.com' }, translation: null });

      await repo.updateByField('article.url', 'https://example.com', 'translation', {
        text: 'Tradotto',
      });

      // Re-read from storage
      const items = await repo.getAll();
      expect(items[0].translation.text).toBe('Tradotto');
    });

    it('does nothing when field path does not match', async () => {
      await repo.save({ article: { url: 'https://example.com' }, translation: null });

      await repo.updateByField('article.url', 'https://wrong.com', 'translation', {
        text: 'Nope',
      });

      const items = await repo.getAll();
      expect(items[0].translation).toBeNull();
    });
  });

  describe('static utilities', () => {
    it('formatDate returns relative time for recent dates', () => {
      const now = Date.now();
      expect(BaseHistoryRepository.formatDate(now)).toBe('Ora');
      expect(BaseHistoryRepository.formatDate(now - 5 * 60000)).toBe('5 min fa');
      expect(BaseHistoryRepository.formatDate(now - 3 * 3600000)).toBe('3 ore fa');
      expect(BaseHistoryRepository.formatDate(now - 2 * 86400000)).toBe('2 giorni fa');
    });

    it('formatDate returns formatted date for older dates', () => {
      const oldDate = new Date('2024-01-15').getTime();
      const result = BaseHistoryRepository.formatDate(oldDate);
      expect(result).toMatch(/15\/01\/2024/);
    });

    it('formatFileSize formats bytes correctly', () => {
      expect(BaseHistoryRepository.formatFileSize(500)).toBe('500 B');
      expect(BaseHistoryRepository.formatFileSize(1536)).toBe('1.5 KB');
      expect(BaseHistoryRepository.formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
    });
  });
});
