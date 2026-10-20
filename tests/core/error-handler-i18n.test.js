import { afterEach, describe, expect, it } from 'vitest';
import { I18n } from '@utils/i18n/i18n.js';
import { ErrorHandler } from '@utils/core/error-handler.js';

describe('error messages follow the interface language', () => {
  afterEach(() => {
    I18n.currentLanguage = 'it';
  });

  it.each([
    ['[RATE_LIMIT:Groq]', 'Rate limit reached for Groq.'],
    ['HTTP 401 Unauthorized', 'Invalid API key. Check your settings.'],
    ['fetch failed', 'Connection error. Check your internet connection.'],
    ['something odd', 'An unexpected error occurred. Try again.'],
  ])('maps %s in English', (raw, expected) => {
    I18n.currentLanguage = 'en';
    expect(ErrorHandler.getErrorMessage(new Error(raw))).toContain(expected);
  });

  it('keeps the Italian text for Italian users', () => {
    expect(ErrorHandler.getErrorMessage(new Error('[RATE_LIMIT:Groq]'))).toContain(
      'Rate limit raggiunto per Groq.',
    );
  });
});
