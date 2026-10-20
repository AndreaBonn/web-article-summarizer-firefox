import { describe, it, expect } from 'vitest';
import {
  LANGUAGE_NAMES,
  LANGUAGE_NAMES_IT,
  getLanguageName,
  getLanguageNameForPrompt,
} from '@utils/i18n/language-names.js';

// ---------------------------------------------------------------------------
// LANGUAGE_NAMES — dizionario nomi nativi
// ---------------------------------------------------------------------------

describe('LANGUAGE_NAMES', () => {
  const REQUIRED_CODES = ['it', 'en', 'es', 'fr', 'de'];

  it('test_LANGUAGE_NAMES_containsAllFiveRequiredLanguages', () => {
    for (const code of REQUIRED_CODES) {
      expect(LANGUAGE_NAMES).toHaveProperty(code);
    }
  });

  it('test_LANGUAGE_NAMES_italian_isNativeName', () => {
    expect(LANGUAGE_NAMES.it).toBe('Italiano');
  });

  it('test_LANGUAGE_NAMES_english_isNativeName', () => {
    expect(LANGUAGE_NAMES.en).toBe('English');
  });

  it('test_LANGUAGE_NAMES_spanish_isNativeName', () => {
    expect(LANGUAGE_NAMES.es).toBe('Español');
  });

  it('test_LANGUAGE_NAMES_french_isNativeName', () => {
    expect(LANGUAGE_NAMES.fr).toBe('Français');
  });

  it('test_LANGUAGE_NAMES_german_isNativeName', () => {
    expect(LANGUAGE_NAMES.de).toBe('Deutsch');
  });
});

// ---------------------------------------------------------------------------
// LANGUAGE_NAMES_IT — dizionario nomi italiani
// ---------------------------------------------------------------------------

describe('LANGUAGE_NAMES_IT', () => {
  const REQUIRED_CODES = ['it', 'en', 'es', 'fr', 'de'];

  it('test_LANGUAGE_NAMES_IT_containsAllFiveRequiredLanguages', () => {
    for (const code of REQUIRED_CODES) {
      expect(LANGUAGE_NAMES_IT).toHaveProperty(code);
    }
  });

  it('test_LANGUAGE_NAMES_IT_english_isItalianName', () => {
    expect(LANGUAGE_NAMES_IT.en).toBe('Inglese');
  });

  it('test_LANGUAGE_NAMES_IT_spanish_isItalianName', () => {
    expect(LANGUAGE_NAMES_IT.es).toBe('Spagnolo');
  });

  it('test_LANGUAGE_NAMES_IT_french_isItalianName', () => {
    expect(LANGUAGE_NAMES_IT.fr).toBe('Francese');
  });

  it('test_LANGUAGE_NAMES_IT_german_isItalianName', () => {
    expect(LANGUAGE_NAMES_IT.de).toBe('Tedesco');
  });
});

// ---------------------------------------------------------------------------
// getLanguageName
// ---------------------------------------------------------------------------

describe('getLanguageName()', () => {
  it('test_getLanguageName_withItCode_returnsItaliano', () => {
    expect(getLanguageName('it')).toBe('Italiano');
  });

  it('test_getLanguageName_withEnCode_returnsEnglish', () => {
    expect(getLanguageName('en')).toBe('English');
  });

  it('test_getLanguageName_withEsCode_returnsEspanol', () => {
    expect(getLanguageName('es')).toBe('Español');
  });

  it('test_getLanguageName_withFrCode_returnsFrancais', () => {
    expect(getLanguageName('fr')).toBe('Français');
  });

  it('test_getLanguageName_withDeCode_returnsDeutsch', () => {
    expect(getLanguageName('de')).toBe('Deutsch');
  });

  it('test_getLanguageName_withUnknownCode_returnsFallbackCode', () => {
    expect(getLanguageName('zh')).toBe('zh');
  });

  it('test_getLanguageName_withEmptyString_returnsFallbackEmptyString', () => {
    // Stringa vuota non corrisponde a nessuna chiave → fallback alla stringa stessa
    expect(getLanguageName('')).toBe('');
  });

  it('test_getLanguageName_withUppercaseCode_returnsFallbackCode', () => {
    // Le chiavi sono minuscole: IT non è presente → fallback
    expect(getLanguageName('IT')).toBe('IT');
  });
});

// ---------------------------------------------------------------------------
// getLanguageNameForPrompt
// ---------------------------------------------------------------------------

describe('getLanguageNameForPrompt()', () => {
  it('test_getLanguageNameForPrompt_withItCode_returnsLowercase', () => {
    expect(getLanguageNameForPrompt('it')).toBe('italiano');
  });

  it('test_getLanguageNameForPrompt_withEnCode_returnsInglese_lowercase', () => {
    expect(getLanguageNameForPrompt('en')).toBe('inglese');
  });

  it('test_getLanguageNameForPrompt_withEsCode_returnsSpagnolo_lowercase', () => {
    expect(getLanguageNameForPrompt('es')).toBe('spagnolo');
  });

  it('test_getLanguageNameForPrompt_withFrCode_returnsFrancese_lowercase', () => {
    expect(getLanguageNameForPrompt('fr')).toBe('francese');
  });

  it('test_getLanguageNameForPrompt_withDeCode_returnsTedesco_lowercase', () => {
    expect(getLanguageNameForPrompt('de')).toBe('tedesco');
  });

  it('test_getLanguageNameForPrompt_withUnknownCode_returnsFallbackCodeLowercase', () => {
    // Fallback è il code stesso, poi lowercased
    expect(getLanguageNameForPrompt('PT')).toBe('pt');
  });

  it('test_getLanguageNameForPrompt_neverReturnsUppercase', () => {
    const result = getLanguageNameForPrompt('fr');
    expect(result).toBe(result.toLowerCase());
  });
});
