import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import itMessages from '../../src/utils/i18n/locales/it.json';

const mocks = vi.hoisted(() => ({
  storage: {
    saveApiKey: vi.fn(),
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    getConfiguredProviders: vi.fn(),
  },
  toast: vi.fn(),
  sendMessage: vi.fn(),
}));
vi.mock('../../src/utils/storage/storage-manager.js', () => ({ StorageManager: mocks.storage }));
vi.mock('../../src/utils/core/toast.js', () => ({ Toast: { show: mocks.toast } }));
vi.mock('../../src/utils/core/modal.js', () => ({ Modal: {} }));
vi.mock('../../src/utils/core/logger.js', () => ({ Logger: { error: vi.fn() } }));

import { I18n } from '../../src/utils/i18n/i18n.js';
import { state, elements, initElements } from '../../src/pages/popup/state.js';
import { setupProviderSelect, saveSetupKey } from '../../src/pages/popup/setup.js';

const validKey = 'gsk_' + 'a'.repeat(40);

beforeEach(() => {
  vi.resetAllMocks();
  I18n.currentLanguage = 'it';
  document.body.innerHTML = `
    <div id="setupState"><input id="setupKeyInput" type="password">
      <button id="setupSaveBtn">Prova e salva</button>
      <p id="setupStatus" role="status"></p></div>
    <div id="initialState" class="hidden"></div>
    <div id="loadingState" class="hidden"></div>
    <div id="errorState" class="hidden"></div>
    <div id="resultsState" class="hidden"></div>
    <div id="articleInfo" class="hidden"></div>
    <select id="providerSelect"></select>`;
  initElements();
  state.configuredProviders = [];
  elements.setupKeyInput.value = validKey;
  mocks.storage.getSettings.mockResolvedValue({ selectedProvider: 'openai', outputLanguage: 'it' });
  mocks.storage.getConfiguredProviders.mockResolvedValue(['groq']);
  mocks.sendMessage.mockResolvedValue({ success: true });
  vi.stubGlobal('browser', { runtime: { sendMessage: mocks.sendMessage } });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('setupProviderSelect', () => {
  it('test_setupProviderSelect_partialConfiguration_disablesUnconfiguredProviders', () => {
    state.configuredProviders = ['groq', 'anthropic'];
    setupProviderSelect('anthropic');
    expect(
      [...elements.providerSelect.options].map((option) => ({
        value: option.value,
        disabled: option.disabled,
        text: option.textContent,
      })),
    ).toEqual([
      { value: 'groq', disabled: false, text: 'Groq' },
      { value: 'openai', disabled: true, text: `OpenAI (${itMessages['start.notConfigured']})` },
      { value: 'anthropic', disabled: false, text: 'Claude' },
      { value: 'gemini', disabled: true, text: `Gemini (${itMessages['start.notConfigured']})` },
    ]);
    expect(elements.providerSelect.value).toBe('anthropic');
  });

  it('test_setupProviderSelect_unavailablePreferred_selectsFirstConfigured', () => {
    state.configuredProviders = ['openai'];
    setupProviderSelect('groq');
    expect(elements.providerSelect.value).toBe('openai');
  });

  it('test_setupProviderSelect_noConfiguration_marksEveryProviderUnavailable', () => {
    setupProviderSelect('groq');
    expect([...elements.providerSelect.options].map((option) => option.disabled)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(elements.providerSelect.options).toHaveLength(4);
  });
});

describe('saveSetupKey', () => {
  it.each([
    ['   ', itMessages['setup.error.empty']],
    ['sk-' + 'a'.repeat(40), itMessages['setup.error.prefix'].replace('{expected}', 'gsk_')],
    ['gsk_short', itMessages['setup.error.length'].replace('{min}', '40')],
  ])('test_saveSetupKey_invalidFormat_%s_showsReason', async (key, message) => {
    elements.setupKeyInput.value = key;
    await saveSetupKey();
    expect(elements.setupStatus.textContent).toBe(message);
    expect(elements.setupStatus.dataset.type).toBe('error');
    expect(document.activeElement).toBe(elements.setupKeyInput);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(mocks.storage.saveApiKey).not.toHaveBeenCalled();
  });

  it.each([
    [{ success: false, error: 'Chiave rifiutata' }, 'Chiave rifiutata'],
    [undefined, itMessages['error.noResponse']],
  ])('test_saveSetupKey_failedTest_%j_showsFailureWithoutSaving', async (response, reason) => {
    mocks.sendMessage.mockResolvedValue(response);
    await saveSetupKey();
    expect(elements.setupStatus.textContent).toBe(
      itMessages['setup.error.failed'].replace('{error}', reason),
    );
    expect(elements.setupStatus.dataset.type).toBe('error');
    expect(elements.setupSaveBtn.disabled).toBe(false);
    expect(mocks.storage.saveApiKey).not.toHaveBeenCalled();
  });

  it('test_saveSetupKey_success_savesGroqAndShowsInitialView', async () => {
    elements.setupKeyInput.value = `  ${validKey}  `;
    const pending = saveSetupKey();
    expect(elements.setupStatus.textContent).toBe(itMessages['setup.status.testing']);
    expect(elements.setupStatus.dataset.type).toBe('loading');
    expect(elements.setupSaveBtn.disabled).toBe(true);
    await pending;
    expect(mocks.sendMessage).toHaveBeenCalledWith({
      action: 'testApiKey',
      provider: 'groq',
      apiKey: validKey,
    });
    expect(mocks.storage.saveApiKey).toHaveBeenCalledWith('groq', validKey);
    expect(mocks.storage.saveSettings).toHaveBeenCalledWith({
      selectedProvider: 'groq',
      outputLanguage: 'it',
    });
    expect(state.configuredProviders).toEqual(['groq']);
    expect(elements.providerSelect.value).toBe('groq');
    expect(elements.setupKeyInput.value).toBe('');
    expect(elements.setupStatus.textContent).toBe('');
    expect(elements.setupStatus.dataset.type).toBe('idle');
    expect(elements.initialState.classList.contains('hidden')).toBe(false);
    expect(elements.setupState.classList.contains('hidden')).toBe(true);
    expect(elements.setupSaveBtn.disabled).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith(itMessages['setup.status.ok'], 'success');
  });

  it('test_saveSetupKey_pendingTest_ignoresRepeatedSubmission', async () => {
    let finish;
    mocks.sendMessage.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = saveSetupKey();
    await saveSetupKey();
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    expect(elements.setupStatus.dataset.type).toBe('loading');
    finish({ success: true });
    await pending;
    expect(mocks.storage.saveApiKey).toHaveBeenCalledTimes(1);
    expect(elements.initialState.classList.contains('hidden')).toBe(false);
  });

  it.each(['request', 'storage'])(
    'test_saveSetupKey_%sRejects_showsFailureAndReenablesButton',
    async (boundary) => {
      if (boundary === 'request')
        mocks.sendMessage.mockRejectedValue(new Error('Operazione fallita'));
      else mocks.storage.saveApiKey.mockRejectedValue(new Error('Operazione fallita'));
      await saveSetupKey();
      expect(elements.setupStatus.textContent).toBe(
        itMessages['setup.error.failed'].replace('{error}', 'Operazione fallita'),
      );
      expect(elements.setupStatus.dataset.type).toBe('error');
      expect(elements.setupSaveBtn.disabled).toBe(false);
      expect(elements.setupState.classList.contains('hidden')).toBe(false);
    },
  );
});
