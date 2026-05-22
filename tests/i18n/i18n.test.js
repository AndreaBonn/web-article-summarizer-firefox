import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  default: {
    'app.title': 'Web Site Summarizer',
    'initial.welcome': 'Benvenuto',
    'initial.language': 'Lingua Output:',
    greeting: 'Ciao {name}, hai {count} messaggi',
  },
}));

vi.mock('../../src/utils/i18n/locales/en.json', () => ({
  default: {
    'app.title': 'Web Site Summarizer',
    'initial.welcome': 'Welcome',
    'initial.language': 'Output Language:',
    greeting: 'Hello {name}, you have {count} messages',
  },
}));

vi.mock('../../src/utils/i18n/locales/es.json', () => ({
  default: { 'app.title': 'Resumidor Web' },
}));

vi.mock('../../src/utils/i18n/locales/fr.json', () => ({
  default: { 'app.title': 'Résumeur Web' },
}));

vi.mock('../../src/utils/i18n/locales/de.json', () => ({
  default: { 'app.title': 'Web-Zusammenfasser' },
}));

const { I18n } = await import('@utils/i18n/i18n.js');
const { StorageManager } = await import('../../src/utils/storage/storage-manager.js');

// ---------------------------------------------------------------------------
// t() — traduzione semplice
// ---------------------------------------------------------------------------
describe('I18n.t()', () => {
  beforeEach(() => {
    I18n.currentLanguage = 'it';
  });

  it('ritorna traduzione per chiave esistente', () => {
    expect(I18n.t('initial.welcome')).toBe('Benvenuto');
  });

  it('ritorna chiave come fallback se traduzione mancante', () => {
    expect(I18n.t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('ritorna traduzione nella lingua corrente', () => {
    I18n.currentLanguage = 'en';
    expect(I18n.t('initial.welcome')).toBe('Welcome');
  });
});

// ---------------------------------------------------------------------------
// tf() — traduzione con placeholder
// ---------------------------------------------------------------------------
describe('I18n.tf()', () => {
  beforeEach(() => {
    I18n.currentLanguage = 'it';
  });

  it('sostituisce placeholder singolo', () => {
    const result = I18n.tf('greeting', { name: 'Mario', count: '5' });
    expect(result).toBe('Ciao Mario, hai 5 messaggi');
  });

  it('ritorna stringa con placeholder non sostituiti se mancano', () => {
    const result = I18n.tf('greeting', { name: 'Mario' });
    expect(result).toBe('Ciao Mario, hai {count} messaggi');
  });

  it('ritorna chiave se traduzione non trovata', () => {
    const result = I18n.tf('missing.key', { x: '1' });
    expect(result).toBe('missing.key');
  });
});

// ---------------------------------------------------------------------------
// init()
// ---------------------------------------------------------------------------
describe('I18n.init()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    I18n.currentLanguage = 'it';
    document.body.innerHTML = '';
  });

  it('carica lingua salvata da StorageManager', async () => {
    StorageManager.getUILanguage.mockResolvedValue('en');
    await I18n.init();
    expect(I18n.currentLanguage).toBe('en');
  });

  it('mantiene lingua default se nessuna salvata', async () => {
    StorageManager.getUILanguage.mockResolvedValue(null);
    await I18n.init();
    expect(I18n.currentLanguage).toBe('it');
  });
});

// ---------------------------------------------------------------------------
// setLanguage()
// ---------------------------------------------------------------------------
describe('I18n.setLanguage()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    I18n.currentLanguage = 'it';
    document.body.innerHTML = '';
  });

  it('cambia lingua e salva in storage', async () => {
    await I18n.setLanguage('en');
    expect(I18n.currentLanguage).toBe('en');
    expect(StorageManager.saveUILanguage).toHaveBeenCalledWith('en');
  });

  it('ignora lingua non supportata', async () => {
    await I18n.setLanguage('zz');
    expect(I18n.currentLanguage).toBe('it');
    expect(StorageManager.saveUILanguage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateUI()
// ---------------------------------------------------------------------------
describe('I18n.updateUI()', () => {
  beforeEach(() => {
    I18n.currentLanguage = 'it';
  });

  it('aggiorna textContent di elementi con data-i18n', () => {
    document.body.innerHTML = '<span data-i18n="initial.welcome">old</span>';
    I18n.updateUI();
    expect(document.querySelector('[data-i18n]').textContent).toBe('Benvenuto');
  });

  it('aggiorna placeholder di input con data-i18n', () => {
    document.body.innerHTML = '<input data-i18n="initial.welcome" placeholder="old" />';
    I18n.updateUI();
    expect(document.querySelector('input').getAttribute('placeholder')).toBe('Benvenuto');
  });

  it('aggiorna textContent di option con data-i18n', () => {
    document.body.innerHTML = '<select><option data-i18n="initial.welcome">old</option></select>';
    I18n.updateUI();
    expect(document.querySelector('option').textContent).toBe('Benvenuto');
  });

  it('aggiorna attributo title di elementi con data-i18n-title', () => {
    document.body.innerHTML = '<button data-i18n-title="initial.welcome" title="old">btn</button>';
    I18n.updateUI();
    expect(document.querySelector('button').getAttribute('title')).toBe('Benvenuto');
  });

  it('aggiorna document.title se title ha data-i18n', () => {
    document.head.innerHTML = '<title data-i18n="app.title">old</title>';
    I18n.updateUI();
    expect(document.title).toBe('Web Site Summarizer');
  });

  it('non crasha con pagina senza elementi data-i18n', () => {
    document.body.innerHTML = '<div>No i18n here</div>';
    expect(() => I18n.updateUI()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// initPage()
// ---------------------------------------------------------------------------
describe('I18n.initPage()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    I18n.currentLanguage = 'it';
  });

  it('imposta valore del select lingua se presente', async () => {
    document.body.innerHTML = `
      <select id="uiLanguageSelect">
        <option value="it">IT</option>
        <option value="en">EN</option>
      </select>
    `;
    StorageManager.getUILanguage.mockResolvedValue('en');

    await I18n.initPage();

    const select = document.getElementById('uiLanguageSelect');
    expect(select.value).toBe('en');
  });

  it('registra listener change sul select lingua', async () => {
    document.body.innerHTML = `
      <select id="uiLanguageSelect">
        <option value="it">IT</option>
        <option value="en">EN</option>
      </select>
    `;
    StorageManager.getUILanguage.mockResolvedValue(null);

    await I18n.initPage();

    // Simula cambio lingua
    const select = document.getElementById('uiLanguageSelect');
    select.value = 'en';
    select.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      expect(StorageManager.saveUILanguage).toHaveBeenCalledWith('en');
    });
  });

  it('non crasha se select lingua non presente nel DOM', async () => {
    document.body.innerHTML = '<div>no select</div>';
    StorageManager.getUILanguage.mockResolvedValue('it');

    await expect(I18n.initPage()).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getAvailableLanguages()
// ---------------------------------------------------------------------------
describe('I18n.getAvailableLanguages()', () => {
  it('ritorna almeno italiano e inglese', () => {
    const langs = I18n.getAvailableLanguages();
    const codes = langs.map((l) => l.code);
    expect(codes).toContain('it');
    expect(codes).toContain('en');
  });

  it('ogni lingua ha code, name e flag', () => {
    const langs = I18n.getAvailableLanguages();
    for (const lang of langs) {
      expect(lang).toHaveProperty('code');
      expect(lang).toHaveProperty('name');
      expect(lang).toHaveProperty('flag');
    }
  });
});
