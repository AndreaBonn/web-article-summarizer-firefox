import { describe, it, expect } from 'vitest';
import { formatKeyPointsForSpeech, formatQAForSpeech } from '../../src/shared/speech-text.js';

describe('formatKeyPointsForSpeech', () => {
  it('numbers each point and joins them with ". "', () => {
    const text = formatKeyPointsForSpeech([
      { title: 'Alpha', description: 'First' },
      { title: 'Beta', description: 'Second' },
    ]);
    expect(text).toBe('1. Alpha. First. 2. Beta. Second');
  });

  it('returns an empty string for an empty list', () => {
    expect(formatKeyPointsForSpeech([])).toBe('');
  });
});

describe('formatQAForSpeech', () => {
  it('prefixes question and answer and joins items with ". "', () => {
    const text = formatQAForSpeech([
      { question: 'Q1?', answer: 'A1' },
      { question: 'Q2?', answer: 'A2' },
    ]);
    expect(text).toBe('Domanda: Q1?. Risposta: A1. Domanda: Q2?. Risposta: A2');
  });

  it('returns an empty string for an empty list', () => {
    expect(formatQAForSpeech([])).toBe('');
  });
});
