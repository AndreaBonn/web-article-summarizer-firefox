import { describe, it, expect, vi } from 'vitest';

// Mock Chrome APIs
global.browser = {
  storage: { local: { get: vi.fn(), set: vi.fn() } },
  runtime: { id: 'test-id' },
};

// Mock StorageManager
vi.mock('../../src/utils/storage/storage-manager.js', () => ({
  StorageManager: {
    getUILanguage: vi.fn().mockResolvedValue(null),
    saveUILanguage: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock locale JSON files
vi.mock('../../src/utils/i18n/locales/it.json', () => ({
  default: { 'app.title': 'Web Site Summarizer', 'initial.welcome': 'Benvenuto' },
}));
vi.mock('../../src/utils/i18n/locales/en.json', () => ({
  default: { 'app.title': 'Web Site Summarizer', 'initial.welcome': 'Welcome' },
}));
vi.mock('../../src/utils/i18n/locales/es.json', () => ({ default: {} }));
vi.mock('../../src/utils/i18n/locales/fr.json', () => ({ default: {} }));
vi.mock('../../src/utils/i18n/locales/de.json', () => ({ default: {} }));

const { I18n } = await import('@utils/i18n/i18n-extended.js');

// ---------------------------------------------------------------------------
// i18n-extended.js è un re-export di i18n.js — verifica che export funzioni
// ---------------------------------------------------------------------------
describe('i18n-extended re-export', () => {
  it('esporta oggetto I18n con metodo t()', () => {
    expect(I18n).toBeDefined();
    expect(typeof I18n.t).toBe('function');
  });

  it('esporta oggetto I18n con metodo tf()', () => {
    expect(typeof I18n.tf).toBe('function');
  });

  it('esporta oggetto I18n con metodo init()', () => {
    expect(typeof I18n.init).toBe('function');
  });

  it('esporta oggetto I18n con metodo setLanguage()', () => {
    expect(typeof I18n.setLanguage).toBe('function');
  });

  it('esporta oggetto I18n con metodo updateUI()', () => {
    expect(typeof I18n.updateUI).toBe('function');
  });

  it('esporta oggetto I18n con metodo getAvailableLanguages()', () => {
    expect(typeof I18n.getAvailableLanguages).toBe('function');
  });

  it('I18n.t() funziona correttamente dal re-export', () => {
    I18n.currentLanguage = 'it';
    expect(I18n.t('initial.welcome')).toBe('Benvenuto');
  });

  it('I18n è lo stesso oggetto di i18n.js (non una copia)', async () => {
    const { I18n: I18nOriginal } = await import('@utils/i18n/i18n.js');
    expect(I18n).toBe(I18nOriginal);
  });
});
