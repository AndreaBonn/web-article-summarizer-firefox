// API key rules — format checks and the pages where each provider issues keys.

export const KEY_PREFIXES = {
  groq: 'gsk_',
  openai: 'sk-',
  anthropic: 'sk-ant-',
  gemini: 'AIza',
};

export const KEY_MIN_LENGTHS = {
  groq: 40,
  openai: 40,
  anthropic: 50,
  gemini: 35,
};

// Same destinations as the help section of the options page.
export const KEY_PAGES = {
  groq: 'https://console.groq.com',
  openai: 'https://platform.openai.com',
  anthropic: 'https://console.anthropic.com',
  gemini: 'https://aistudio.google.com/app/apikey',
};

/**
 * @returns {null | {code: 'empty'} | {code: 'prefix', expected: string} | {code: 'length', min: number}}
 */
export function validateApiKeyFormat(provider, rawKey) {
  const key = (rawKey || '').trim();
  if (!key) return { code: 'empty' };
  const expected = KEY_PREFIXES[provider];
  if (expected && !key.startsWith(expected)) return { code: 'prefix', expected };
  const min = KEY_MIN_LENGTHS[provider];
  if (min && key.length < min) return { code: 'length', min };
  return null;
}
