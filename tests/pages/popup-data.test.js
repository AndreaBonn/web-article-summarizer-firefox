import { describe, expect, it } from 'vitest';
import {
  buildReadingModeData,
  describeReadingModeStorageError,
} from '../../src/pages/popup/popup-data.js';

const baseInput = {
  article: { title: 'T', url: 'https://a.test/1' },
  results: {
    summary: 'Riassunto',
    keyPoints: [{ title: 'P', paragraphs: '1', description: 'D' }],
  },
  translation: null,
  citations: null,
  qa: [],
  providerValue: 'groq',
  selectedLanguage: 'it',
  selectedContentType: 'auto',
};

describe('buildReadingModeData', () => {
  it('copies summary and key points and nulls the optional sections when empty', () => {
    const data = buildReadingModeData(baseInput);
    expect(data).toEqual({
      article: baseInput.article,
      summary: 'Riassunto',
      keyPoints: baseInput.results.keyPoints,
      translation: null,
      citations: null,
      qa: null,
      metadata: { provider: 'groq', language: 'it', contentType: 'auto' },
    });
  });

  it('keeps translation, citations and non-empty Q&A', () => {
    const qa = [{ question: 'Q', answer: 'A' }];
    const data = buildReadingModeData({
      ...baseInput,
      translation: { text: 'tr' },
      citations: { citations: [{ author: 'X' }] },
      qa,
    });
    expect(data.translation).toEqual({ text: 'tr' });
    expect(data.citations).toEqual({ citations: [{ author: 'X' }] });
    expect(data.qa).toBe(qa);
  });

  it('turns an undefined or null Q&A list into null', () => {
    expect(buildReadingModeData({ ...baseInput, qa: undefined }).qa).toBeNull();
    expect(buildReadingModeData({ ...baseInput, qa: null }).qa).toBeNull();
  });

  it('prefers the detected content type over the selected one', () => {
    const data = buildReadingModeData({
      ...baseInput,
      results: { ...baseInput.results, detectedContentType: 'scientific' },
      selectedContentType: 'auto',
    });
    expect(data.metadata.contentType).toBe('scientific');
  });

  it('does not mutate its input', () => {
    const input = structuredClone(baseInput);
    buildReadingModeData(input);
    expect(input).toEqual(baseInput);
  });
});

describe('describeReadingModeStorageError', () => {
  it('reports insufficient storage for an upper-case QUOTA error', () => {
    expect(describeReadingModeStorageError(new Error('QUOTA_BYTES quota exceeded'))).toBe(
      'Impossibile aprire la modalità lettura: spazio di archiviazione insufficiente.',
    );
  });

  it('reports insufficient storage for a lower-case quota error', () => {
    expect(describeReadingModeStorageError(new Error('storage quota reached'))).toBe(
      'Impossibile aprire la modalità lettura: spazio di archiviazione insufficiente.',
    );
  });

  it('includes the error message for any other failure', () => {
    expect(describeReadingModeStorageError(new Error('disk on fire'))).toBe(
      'Impossibile aprire la modalità lettura: disk on fire',
    );
  });
});
