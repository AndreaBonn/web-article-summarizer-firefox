import { afterEach, describe, expect, it } from 'vitest';
import { I18n } from '@utils/i18n/i18n.js';
import { ErrorHandler } from '@utils/core/error-handler.js';

// The service worker sends pages messages that getErrorMessage already mapped, and pages map
// them again: a mapped message has to survive that round, kind included
const RAW_ERRORS = [
  'API key non configurata. Vai nelle impostazioni.',
  'HTTP 401 Unauthorized',
  '[RATE_LIMIT:Groq]',
  'HTTP 429 Too Many Requests',
  'HTTP 403 Forbidden',
  'HTTP 500',
  'HTTP 503 Service Unavailable',
  'fetch failed',
  'Request timeout',
  '[UNSUPPORTED_PAGE] about:blank',
  'Could not establish connection',
  'QUOTA_BYTES exceeded',
  'No article found',
  'Article too short',
  'something odd',
];

describe('mapped error messages survive a second mapping', () => {
  afterEach(() => {
    I18n.currentLanguage = 'it';
  });

  it.each(['it', 'en'])('getErrorMessage is idempotent in %s', (language) => {
    I18n.currentLanguage = language;
    for (const raw of RAW_ERRORS) {
      const once = ErrorHandler.getErrorMessage(new Error(raw));
      expect(ErrorHandler.getErrorMessage(new Error(once)), raw).toBe(once);
    }
  });

  it('re-renders a message mapped in the other language', () => {
    I18n.currentLanguage = 'en';
    const english = ErrorHandler.getErrorMessage(new Error('[RATE_LIMIT:Groq]'));
    I18n.currentLanguage = 'it';
    expect(ErrorHandler.getErrorMessage(new Error(english))).toBe(
      ErrorHandler.getErrorMessage(new Error('[RATE_LIMIT:Groq]')),
    );
  });

  it.each([
    ['API key non configurata. Vai nelle impostazioni.', 'missing_key'],
    ['[UNSUPPORTED_PAGE] about:blank', 'unsupported_page'],
    ['Could not establish connection', 'page_unreachable'],
    ['HTTP 500', 'generic'],
  ])('classifyError keeps the kind of the mapped message for %s', (raw, kind) => {
    const mapped = new Error(ErrorHandler.getErrorMessage(new Error(raw)));
    expect(ErrorHandler.classifyError(mapped)).toBe(kind);
  });
});
