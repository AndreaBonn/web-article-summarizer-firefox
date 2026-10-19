import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadApiKeys, bindKeyInputs, focusProviderFromHash } from '@pages/options/options-keys.js';
import { eventCleanup } from '@utils/core/event-cleanup.js';
import { I18n } from '@utils/i18n/i18n.js';

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
  let previousLanguage;

  beforeEach(() => {
    previousLanguage = I18n.currentLanguage;
    document.body.innerHTML = ['groq', 'openai', 'anthropic', 'gemini']
      .map(renderKeyField)
      .join('');
    store = installStorage({ groq: OLD_KEY });
  });

  afterEach(() => {
    eventCleanup.cleanupAll();
    I18n.currentLanguage = previousLanguage;
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  it.each([
    ['it', 'wrong_' + 'a'.repeat(40), 'La chiave deve iniziare con «gsk_».'],
    ['en', 'wrong_' + 'a'.repeat(40), 'The key must start with “gsk_”.'],
    ['it', 'gsk_short', 'La chiave sembra incompleta: servono almeno 40 caratteri.'],
  ])(
    'test_change_invalidKey_keeps_saved_key_and_shows_%s_error (%s)',
    async (language, key, error) => {
      I18n.currentLanguage = language;
      await loadApiKeys();
      bindKeyInputs();
      const input = document.getElementById('groqKey');
      const status = document.getElementById('groqStatus');
      input.dispatchEvent(new Event('focus'));
      input.value = key;
      input.dispatchEvent(new Event('change'));

      await vi.waitFor(() => expect(status.textContent).toBe(error));
      expect(status.className).toBe('status error');
      expect(getComputedStyle(status).display).not.toBe('none');
      expect(store.apiKeys.groq).toBe(OLD_KEY);

      input.value = NEW_KEY;
      input.dispatchEvent(new Event('change'));
      await vi.waitFor(() => expect(store.apiKeys.groq).toBe(NEW_KEY));
      await vi.waitFor(() => expect(status.className).toBe('status success'));
    },
  );

  it('test_paste_validKey_saves_complete_pasted_value', async () => {
    vi.useFakeTimers();
    await loadApiKeys();
    bindKeyInputs();
    const input = document.getElementById('groqKey');
    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new Event('paste'));
    // The browser inserts clipboard text after the paste event handler returns.
    input.value = NEW_KEY;
    await vi.runAllTimersAsync();

    expect(store.apiKeys.groq).toBe(NEW_KEY);
    expect(document.getElementById('groqStatus').className).toBe('status success');
  });

  it('test_testButton_maskedKey_sends_real_saved_key_and_displays_success', async () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button class="btn-test" data-provider="groq">Test</button>',
    );
    const sendMessage = vi.fn(async () => ({ success: true }));
    globalThis.browser.runtime.sendMessage = sendMessage;
    I18n.currentLanguage = 'en';
    await loadApiKeys();
    bindKeyInputs();

    document.querySelector('.btn-test').click();

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledExactlyOnceWith({
        action: 'testApiKey',
        provider: 'groq',
        apiKey: OLD_KEY,
      }),
    );
    await vi.waitFor(() =>
      expect(document.getElementById('groqStatus').textContent).toBe('✅ Connection verified'),
    );
    expect(document.getElementById('groqStatus').className).toBe('status success');
  });

  it('test_focusProviderFromHash_focuses_known_provider_and_rejects_unknown', () => {
    const group = document.getElementById('groqGroup');
    group.scrollIntoView = vi.fn();

    expect(focusProviderFromHash('#groq')).toBe(true);
    expect(group.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'center' });
    expect(group.classList.contains('highlight')).toBe(true);
    expect(document.activeElement).toBe(document.getElementById('groqKey'));
    expect(focusProviderFromHash('#unknown')).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('groqKey'));
  });
});
