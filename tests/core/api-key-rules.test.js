import { describe, it, expect } from 'vitest';
import { validateApiKeyFormat, KEY_PAGES } from '@utils/core/api-key-rules.js';

const longGroq = 'gsk_' + 'a'.repeat(50);

describe('validateApiKeyFormat', () => {
  it('test_validateApiKeyFormat_validGroqKey_returnsNull', () => {
    expect(validateApiKeyFormat('groq', longGroq)).toBeNull();
  });

  it('test_validateApiKeyFormat_wrongPrefix_returnsPrefixError', () => {
    expect(validateApiKeyFormat('groq', 'sk-' + 'a'.repeat(50))).toEqual({
      code: 'prefix',
      expected: 'gsk_',
    });
  });

  it('test_validateApiKeyFormat_tooShort_returnsLengthError', () => {
    expect(validateApiKeyFormat('anthropic', 'sk-ant-abc')).toEqual({ code: 'length', min: 50 });
  });

  it('test_validateApiKeyFormat_empty_returnsEmptyError', () => {
    expect(validateApiKeyFormat('openai', '   ')).toEqual({ code: 'empty' });
  });

  it('test_validateApiKeyFormat_surroundingSpaces_areIgnored', () => {
    expect(validateApiKeyFormat('groq', `  ${longGroq}  `)).toBeNull();
  });
});

describe('KEY_PAGES', () => {
  it('test_KEY_PAGES_everyProviderHasHttpsSignupPage', () => {
    for (const provider of ['groq', 'openai', 'anthropic', 'gemini']) {
      expect(KEY_PAGES[provider]).toMatch(/^https:\/\//);
    }
  });
});
