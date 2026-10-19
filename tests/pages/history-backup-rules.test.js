import { describe, it, expect } from 'vitest';
import {
  sanitizeMetadata,
  sanitizeTextField,
  sanitizeArticleEntry,
  sanitizeMultiAnalysisEntry,
  validateImportFile,
  parseBackup,
  selectNewEntries,
  buildBackupPayload,
  buildImportConfirmMessage,
} from '../../src/pages/history/backup-rules.js';

describe('backup sanitization contract', () => {
  it('replaces untrusted metadata values while retaining unrelated metadata', () => {
    expect(
      sanitizeMetadata({
        provider: 'evil',
        contentType: 'unknown',
        language: 'xx-yy',
        model: 'test',
      }),
    ).toEqual({ provider: 'groq', contentType: undefined, language: 'it', model: 'test' });
  });
  it.each(['groq', 'openai', 'anthropic', 'gemini'])(
    'preserves allowed provider %s',
    (provider) => {
      expect(sanitizeMetadata({ provider, language: 'en-US', contentType: 'news' })).toEqual({
        provider,
        language: 'en-US',
        contentType: 'news',
      });
    },
  );
  it.each(['general', 'scientific', 'technical', 'opinion'])(
    'preserves content type %s',
    (contentType) => {
      expect(sanitizeMetadata({ provider: 'groq', language: 'it', contentType }).contentType).toBe(
        contentType,
      );
    },
  );
  it.each([null, undefined, 'invalid', 3])(
    'defaults missing or non-object metadata %s',
    (metadata) => {
      expect(sanitizeMetadata(metadata)).toEqual({ provider: 'groq', language: 'it' });
    },
  );
  it.each(['EN', 42, undefined])('defaults invalid language %s', (language) => {
    expect(sanitizeMetadata({ language }).language).toBe('it');
  });
  it('truncates text at explicit and default limits', () => {
    expect(sanitizeTextField('abcdef', 3)).toBe('abc');
    expect(sanitizeTextField('a'.repeat(50001))).toBe('a'.repeat(50000));
    expect(sanitizeTextField('')).toBe('');
    expect(sanitizeTextField('abc', 0)).toBe('');
  });
  it.each([null, 5, {}, []])('turns non-text %s into empty text', (value) => {
    expect(sanitizeTextField(value)).toBe('');
    expect(sanitizeTextField('valid')).toBe('valid');
  });
  it('retains an absent text field', () => {
    expect(sanitizeTextField(undefined)).toBeUndefined();
    expect(sanitizeTextField('valid')).toBe('valid');
  });
  it('sanitizes article and translation object fields in place at their documented limits', () => {
    const entry = {
      article: { title: 't'.repeat(501), content: 'c'.repeat(100001), excerpt: 'e'.repeat(1001) },
      summary: 's'.repeat(50001),
      translation: { text: 'x'.repeat(100001), targetLanguage: 'en' },
      notes: 'n'.repeat(10001),
    };
    sanitizeArticleEntry(entry);
    expect(entry).toEqual({
      article: { title: 't'.repeat(500), content: 'c'.repeat(100000), excerpt: 'e'.repeat(1000) },
      summary: 's'.repeat(50000),
      translation: { text: 'x'.repeat(100000), targetLanguage: 'en' },
      notes: 'n'.repeat(10000),
    });
  });
  it('sanitizes string translations without requiring an article', () => {
    const entry = { summary: 'Summary', translation: 'x'.repeat(100001) };
    sanitizeArticleEntry(entry);
    expect(entry).toEqual({
      summary: 'Summary',
      translation: 'x'.repeat(100000),
      notes: undefined,
    });
  });
  it('handles missing optional article and translation data', () => {
    const entry = {};
    sanitizeArticleEntry(entry);
    expect(entry).toEqual({ summary: undefined, notes: undefined });
  });
  it('sanitizes multi-analysis text in place', () => {
    const entry = { analysis: { globalSummary: 'g'.repeat(100001), comparison: 42 } };
    sanitizeMultiAnalysisEntry(entry);
    expect(entry).toEqual({ analysis: { globalSummary: 'g'.repeat(100000), comparison: '' } });
  });
  it('retains an entry with no multi-analysis', () => {
    const entry = { id: 'empty' };
    sanitizeMultiAnalysisEntry(entry);
    expect(entry).toEqual({ id: 'empty' });
  });
});

describe('backup import contract', () => {
  it('rejects non-JSON files with the specified message', () => {
    expect(() => validateImportFile({ name: 'backup.txt', type: 'text/plain', size: 10 })).toThrow(
      'Formato file non valido. Seleziona un file .json',
    );
    expect(
      validateImportFile({ name: 'backup.json', type: 'text/plain', size: 10 }),
    ).toBeUndefined();
  });
  it.each(['application/json', 'text/json', ''])(
    'accepts MIME type %s at the size limit',
    (type) => {
      expect(
        validateImportFile({ name: 'backup.json', type, size: 10 * 1024 * 1024 }),
      ).toBeUndefined();
      expect(() =>
        validateImportFile({ name: 'backup.json', type, size: 10 * 1024 * 1024 + 1 }),
      ).toThrow('File troppo grande (max 10 MB)');
    },
  );
  it.each([
    {},
    { version: 1, data: {} },
    { version: '1' },
    { version: '1', data: 'invalid' },
    { version: '1', data: [] },
  ])('rejects invalid backup structure %j', (backup) => {
    expect(() => parseBackup(JSON.stringify(backup))).toThrow('File di backup non valido');
  });
  it.each(['null', '5', '"text"', 'true'])(
    'rejects non-object JSON %s as invalid format',
    (text) => {
      expect(() => parseBackup(text)).toThrow('File di backup non valido');
    },
  );
  it('rejects malformed JSON', () => {
    expect(() => parseBackup('{')).toThrow(SyntaxError);
    expect(parseBackup('{"version":"1","data":{"singleArticles":[]}}')).toEqual({
      version: '1',
      data: { singleArticles: [] },
    });
  });
  it.each([{}, { singleArticles: {}, multiAnalysis: {} }])(
    'requires an importable collection %j',
    (data) => {
      expect(() => parseBackup(JSON.stringify({ version: '1', data }))).toThrow(
        'Il backup non contiene dati importabili',
      );
    },
  );
  it.each(['singleArticles', 'multiAnalysis'])('accepts an empty %s collection', (key) => {
    const backup = { version: '1', data: { [key]: [] } };
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });
  it('excludes known IDs while preserving new entries and order', () => {
    expect(selectNewEntries([{ id: 'b' }, { id: 'a' }, { id: 'c' }], new Set(['a']))).toEqual([
      { id: 'b' },
      { id: 'c' },
    ]);
    expect(selectNewEntries([], new Set())).toEqual([]);
  });
  it('builds a versioned payload with collections, settings, stats and date', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(
      buildBackupPayload({
        singleHistory: [{ id: 'a' }],
        multiHistory: [{ id: 'b' }],
        settings: { language: 'it' },
        stats: { totalSummaries: 3, totalWords: 50 },
        now,
      }),
    ).toEqual({
      version: '1.0.0',
      exportDate: '2026-01-01T00:00:00.000Z',
      exportTimestamp: 1767225600000,
      data: {
        singleArticles: [{ id: 'a' }],
        multiAnalysis: [{ id: 'b' }],
        settings: { language: 'it' },
        stats: { totalSummaries: 3, totalWords: 50 },
      },
      metadata: {
        totalSingleArticles: 1,
        totalMultiAnalysis: 1,
        totalSummaries: 3,
        totalWords: 50,
      },
    });
  });
  it('defaults missing statistics to zero', () => {
    expect(
      buildBackupPayload({
        singleHistory: [],
        multiHistory: [],
        settings: {},
        stats: {},
        now: new Date('2026-01-01'),
      }).metadata,
    ).toEqual({ totalSingleArticles: 0, totalMultiAnalysis: 0, totalSummaries: 0, totalWords: 0 });
  });
  it('asks for additive import confirmation with the backup date and counts', () => {
    const exportDate = '2026-01-01T12:00:00Z';
    expect(
      buildImportConfirmMessage({
        exportDate,
        metadata: { totalSingleArticles: 2, totalMultiAnalysis: 1 },
      }),
    ).toBe(
      `Vuoi importare questo backup?\n\n📅 Data backup:\n${new Date(exportDate).toLocaleString('it-IT')}\n\n📄 Articoli singoli: 2\n🔬 Analisi multiple: 1\n\n⚠️ ATTENZIONE:\nQuesto AGGIUNGERÀ i dati al tuo storico\nesistente (non li sostituirà).`,
    );
  });
  it('shows zero counts when metadata has no totals', () => {
    const message = buildImportConfirmMessage({ exportDate: '2026-01-01', metadata: {} });
    expect(message).toContain('📄 Articoli singoli: 0\n🔬 Analisi multiple: 0');
  });
  it('falls back to data collection sizes when the backup has no metadata', () => {
    const message = buildImportConfirmMessage({
      exportDate: '2026-01-01',
      data: { singleArticles: [{}, {}, {}], multiAnalysis: [{}] },
    });
    expect(message).toContain('📄 Articoli singoli: 3\n🔬 Analisi multiple: 1');
  });
  it('does not throw when metadata and data are both missing', () => {
    expect(buildImportConfirmMessage({ exportDate: '2026-01-01' })).toContain(
      '📄 Articoli singoli: 0\n🔬 Analisi multiple: 0',
    );
  });
});
