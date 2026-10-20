import { afterEach, describe, expect, it } from 'vitest';
import { I18n } from '@utils/i18n/i18n.js';
import { validatePdfFile } from '@pages/pdf-analysis/pdf-intake.js';
import { buildVoiceSelectorHTML } from '@shared/voice-page-helper.js';

// These modules used to hardcode Italian: the copy now follows the UI language
describe('PDF intake and voice selector copy follow the interface language', () => {
  afterEach(() => {
    I18n.currentLanguage = 'it';
  });

  it('PDF validation messages in English and Italian', () => {
    I18n.currentLanguage = 'en';
    expect(validatePdfFile({ type: 'text/plain', size: 1 })).toBe(
      'Invalid file. Please upload a PDF file.',
    );
    expect(validatePdfFile({ type: 'application/pdf', size: 21 * 1024 * 1024 })).toBe(
      'File too large. Maximum 20MB.',
    );
    I18n.currentLanguage = 'it';
    expect(validatePdfFile({ type: 'application/pdf', size: 21 * 1024 * 1024 })).toBe(
      'File troppo grande. Massimo 20MB.',
    );
  });

  it('voice badges in English', () => {
    I18n.currentLanguage = 'en';
    const html = buildVoiceSelectorHTML(
      [
        { voiceName: 'a', localService: true },
        { voiceName: 'b', localService: false },
      ],
      'a',
    );
    expect(html).toContain('Local');
    expect(html).toContain('Remote');
    expect(html).not.toContain('Locale<');
  });
});
