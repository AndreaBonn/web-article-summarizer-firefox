import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadApiKeys, bindKeyInputs } from '@pages/options/options-keys.js';
import { eventCleanup } from '@utils/core/event-cleanup.js';

const OLD_KEY = 'gsk_' + 'a'.repeat(40) + 'OLD1';
const NEW_KEY = 'gsk_' + 'b'.repeat(40) + 'NEW2';

function renderKeyField(provider) {
  return `<input id="${provider}Key" /><div id="${provider}Status"></div>
    <div id="${provider}Group"></div>`;
}

function installStorage(apiKeys) {
  const store = { apiKeys: { ...apiKeys } };
  globalThis.browser = {
    storage: {
      local: {
        get: async () => ({ apiKeys: store.apiKeys }),
        set: async (value) => Object.assign(store, value),
      },
    },
    runtime: { sendMessage: async () => ({ success: true }) },
  };
  return store;
}

describe('options API key fields', () => {
  let store;

  beforeEach(() => {
    document.body.innerHTML = ['groq', 'openai', 'anthropic', 'gemini']
      .map(renderKeyField)
      .join('');
    store = installStorage({ groq: OLD_KEY });
  });

  afterEach(() => {
    eventCleanup.cleanupAll();
    delete globalThis.browser;
  });

  it('test_loadApiKeys_savedKey_showsOnlyLastFourCharacters', async () => {
    await loadApiKeys();
    const input = document.getElementById('groqKey');
    expect(input.value.endsWith('OLD1')).toBe(true);
    expect(input.value).not.toContain('aaaa');
    expect(input.dataset.masked).toBe('true');
  });

  it('test_blur_emptyAfterSavingNewKey_restoresMaskOfNewKey', async () => {
    await loadApiKeys();
    bindKeyInputs();
    const input = document.getElementById('groqKey');

    input.dispatchEvent(new Event('focus'));
    input.value = NEW_KEY;
    input.dispatchEvent(new Event('change'));
    // saveKey is async: wait until the save has gone through, not a fixed number of ticks
    await vi.waitFor(() => expect(store.apiKeys.groq).toBe(NEW_KEY));
    await vi.waitFor(() => expect(input.dataset.maskedValue.endsWith('NEW2')).toBe(true));

    input.value = '';
    input.dispatchEvent(new Event('blur'));

    expect(input.value.endsWith('NEW2')).toBe(true);
    expect(input.dataset.masked).toBe('true');
  });
});
