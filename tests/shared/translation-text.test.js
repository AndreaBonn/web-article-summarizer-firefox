import { describe, it, expect } from 'vitest';
import { getTranslationText } from '../../src/shared/translation-text.js';

describe('getTranslationText', () => {
  it('test_getTranslationText_plainString_returnsIt', () => {
    expect(getTranslationText('Ciao mondo')).toBe('Ciao mondo');
  });
  it('test_getTranslationText_historyObject_returnsText', () => {
    expect(getTranslationText({ text: 'Ciao', targetLanguage: 'it', originalLanguage: 'en' })).toBe(
      'Ciao',
    );
  });
  it.each([[null], [undefined], [''], [{}], [{ text: null }], [{ text: 42 }], [42], [[]]])(
    'test_getTranslationText_noUsableText_returnsEmptyString (%j)',
    (value) => {
      expect(getTranslationText(value)).toBe('');
    },
  );
});
