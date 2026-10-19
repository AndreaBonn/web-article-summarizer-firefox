import { describe, it, expect } from 'vitest';
import { getSpeechTextForTab } from '../../src/pages/reading-mode/speech.js';
import { getModalSpeechText } from '../../src/pages/history/speech.js';

const keyPoints = [{ title: 'T', description: 'D' }];
const qa = [{ question: 'Q?', answer: 'A' }];

describe('getSpeechTextForTab (reading mode)', () => {
  it('returns the summary', () => {
    expect(getSpeechTextForTab('summary', { summary: 'Riassunto' })).toBe('Riassunto');
  });

  it('returns null for a missing summary', () => {
    expect(getSpeechTextForTab('summary', {})).toBeNull();
  });

  it('numbers key points', () => {
    expect(getSpeechTextForTab('keypoints', { keyPoints })).toBe('1. T. D');
  });

  it('returns null for missing key points', () => {
    expect(getSpeechTextForTab('keypoints', {})).toBeNull();
  });

  it('returns the translation string', () => {
    expect(getSpeechTextForTab('translation', { translation: 'Hello' })).toBe('Hello');
  });

  it('reads citations with author and quote_text', () => {
    const data = {
      citations: {
        citations: [{ author: 'Rossi', quote_text: 'Frase' }, { quote_text: 'Altra' }],
      },
    };
    expect(getSpeechTextForTab('citations', data)).toBe(
      'Citazione 1. Rossi. Frase. Citazione 2. Altra',
    );
  });

  it('formats Q&A', () => {
    expect(getSpeechTextForTab('qa', { qa })).toBe('Domanda: Q?. Risposta: A');
  });

  it('returns null for empty Q&A', () => {
    expect(getSpeechTextForTab('qa', { qa: [] })).toBeNull();
  });

  it('returns null for an unknown tab', () => {
    expect(getSpeechTextForTab('boh', { summary: 'x' })).toBeNull();
  });

  it('returns null when there is no data', () => {
    expect(getSpeechTextForTab('summary', undefined)).toBeNull();
  });
});

describe('getModalSpeechText (history)', () => {
  it('returns the summary', () => {
    expect(getModalSpeechText('summary', { summary: 'Riassunto' })).toBe('Riassunto');
  });

  it('numbers key points', () => {
    expect(getModalSpeechText('keypoints', { keyPoints })).toBe('1. T. D');
  });

  it('uses .text of a translation object', () => {
    const entry = { translation: { text: 'Hello', targetLanguage: 'en' } };
    expect(getModalSpeechText('translation', entry)).toBe('Hello');
  });

  it('returns a plain string translation as is', () => {
    expect(getModalSpeechText('translation', { translation: 'Hello' })).toBe('Hello');
  });

  it('returns null without translation', () => {
    expect(getModalSpeechText('translation', {})).toBeNull();
  });

  it('falls back to citation.text when quote_text is missing', () => {
    const entry = { citations: { citations: [{ author: 'Rossi', text: 'Testo' }] } };
    expect(getModalSpeechText('citations', entry)).toBe('Citazione 1. Rossi. Testo');
  });

  it('prefers quote_text over text', () => {
    const entry = { citations: { citations: [{ quote_text: 'Q', text: 'T' }] } };
    expect(getModalSpeechText('citations', entry)).toBe('Citazione 1. Q');
  });

  it('formats Q&A and returns null for empty Q&A', () => {
    expect(getModalSpeechText('qa', { qa })).toBe('Domanda: Q?. Risposta: A');
    expect(getModalSpeechText('qa', { qa: [] })).toBeNull();
  });

  it('reads notes', () => {
    expect(getModalSpeechText('notes', { notes: 'Nota' })).toBe('Nota');
    expect(getModalSpeechText('notes', {})).toBeNull();
  });

  it('returns null for an unknown tab', () => {
    expect(getModalSpeechText('boh', { summary: 'x' })).toBeNull();
  });
});
