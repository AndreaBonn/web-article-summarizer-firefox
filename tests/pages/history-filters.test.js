import { describe, expect, it } from 'vitest';
import {
  buildFilterCriteria,
  applyFlagFilter,
  buildClearConfirmMessage,
} from '../../src/pages/history/history-filters.js';

describe('buildFilterCriteria', () => {
  it('omits empty criteria', () => {
    expect(buildFilterCriteria({ provider: '', language: '', contentType: '' })).toEqual({});
  });

  it('keeps the selected provider, language and content type', () => {
    expect(buildFilterCriteria({ provider: 'groq', language: 'it', contentType: 'news' })).toEqual({
      provider: 'groq',
      language: 'it',
      contentType: 'news',
    });
    expect(buildFilterCriteria({ language: 'en' })).toEqual({ language: 'en' });
  });
});

describe('applyFlagFilter', () => {
  const entries = [
    { id: 'a', favorite: true, notes: '  Useful note  ' },
    { id: 'b', favorite: 'true', notes: '   ' },
    { id: 'c', favorite: false, notes: '' },
    { id: 'd' },
    { id: 'e', favorite: true, notes: null },
  ];

  it('selects only explicit boolean favorites in their original order', () => {
    expect(applyFlagFilter(entries, 'favorites')).toEqual([entries[0], entries[4]]);
    expect(entries).toHaveLength(5);
  });

  it('selects entries with nonblank notes', () => {
    expect(applyFlagFilter(entries, 'withNotes')).toEqual([entries[0]]);
  });

  it('keeps entries when no flag filter is selected', () => {
    expect(applyFlagFilter(entries, '')).toEqual(entries);
    expect(applyFlagFilter([], 'favorites')).toEqual([]);
    expect(applyFlagFilter([], 'withNotes')).toEqual([]);
  });
});

describe('buildClearConfirmMessage', () => {
  it.each([
    [
      'single',
      'Sei sicuro di voler cancellare tutta la cronologia degli articoli singoli?',
      'articoli preferiti NON verranno eliminati.',
      'Cancella Articoli Singoli',
    ],
    [
      'pdf',
      'Sei sicuro di voler cancellare tutta la cronologia dei PDF analizzati?',
      'PDF preferiti NON verranno eliminati.',
      'Elimina Cronologia PDF',
    ],
    [
      'multi',
      'Sei sicuro di voler cancellare tutta la cronologia delle analisi Multi Articolo?',
      'analisi preferite NON verranno eliminate.',
      'Cancella Analisi Multiple',
    ],
  ])(
    'preserves the %s confirmation with zero or two favorites',
    (kind, prompt, favorites, title) => {
      expect(buildClearConfirmMessage(kind, 0)).toEqual({
        message: `${prompt}\n\nQuesta azione non può essere annullata.`,
        title,
      });
      expect(buildClearConfirmMessage(kind, 2)).toEqual({
        message: `${prompt}\n\n⭐ 2 ${favorites}\n\nQuesta azione non può essere annullata.`,
        title,
      });
    },
  );
});
