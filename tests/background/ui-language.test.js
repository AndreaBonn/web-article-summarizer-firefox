import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18n } from '@utils/i18n/i18n.js';
import { applyStoredUiLanguage, watchUiLanguage } from '../../src/background/ui-language.js';

describe('service worker UI language', () => {
  afterEach(() => {
    I18n.currentLanguage = 'it';
  });

  it('adopts the language saved in the options page', async () => {
    const storage = { get: vi.fn().mockResolvedValue({ uiLanguage: 'en' }) };
    await applyStoredUiLanguage(storage);
    expect(I18n.currentLanguage).toBe('en');
    expect(I18n.t('errorMsg.unexpected')).toBe('An unexpected error occurred. Try again.');
  });

  it('keeps the default for a missing or unknown language', async () => {
    await applyStoredUiLanguage({ get: vi.fn().mockResolvedValue({}) });
    expect(I18n.currentLanguage).toBe('it');
    await applyStoredUiLanguage({ get: vi.fn().mockResolvedValue({ uiLanguage: 'xx' }) });
    expect(I18n.currentLanguage).toBe('it');
  });

  it('follows a language change made while the worker is alive', () => {
    let listener;
    const onChanged = { addListener: (fn) => (listener = fn) };
    watchUiLanguage(onChanged);

    listener({ uiLanguage: { newValue: 'en' } }, 'local');
    expect(I18n.currentLanguage).toBe('en');
    listener({ other: { newValue: 'x' } }, 'local');
    expect(I18n.currentLanguage).toBe('en');
    listener({ uiLanguage: { newValue: 'it' } }, 'sync');
    expect(I18n.currentLanguage).toBe('en');
    listener({ uiLanguage: { oldValue: 'en' } }, 'local');
    expect(I18n.currentLanguage).toBe('it');
  });
});
