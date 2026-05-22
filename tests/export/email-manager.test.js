import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Chrome APIs
global.browser = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  tabs: {
    create: vi.fn(),
  },
};

const { EmailManager } = await import('@utils/export/email-manager.js');

// ---------------------------------------------------------------------------
// saveEmail()
// ---------------------------------------------------------------------------
describe('EmailManager.saveEmail()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.storage.local.set.mockResolvedValue(undefined);
  });

  it('salva nuova email in lista vuota', async () => {
    browser.storage.local.get.mockResolvedValue({ savedEmails: [] });
    await EmailManager.saveEmail('test@example.com');

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      savedEmails: ['test@example.com'],
    });
  });

  it('aggiunge email all inizio della lista', async () => {
    browser.storage.local.get.mockResolvedValue({
      savedEmails: ['old@example.com'],
    });
    await EmailManager.saveEmail('new@example.com');

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      savedEmails: ['new@example.com', 'old@example.com'],
    });
  });

  it('non aggiunge email duplicata', async () => {
    browser.storage.local.get.mockResolvedValue({
      savedEmails: ['dup@example.com'],
    });
    await EmailManager.saveEmail('dup@example.com');

    expect(browser.storage.local.set).not.toHaveBeenCalled();
  });

  it('mantiene massimo 10 email', async () => {
    const existing = Array.from({ length: 10 }, (_, i) => `e${i}@test.com`);
    browser.storage.local.get.mockResolvedValue({ savedEmails: existing });
    await EmailManager.saveEmail('new@test.com');

    const saved = browser.storage.local.set.mock.calls[0][0].savedEmails;
    expect(saved).toHaveLength(10);
    expect(saved[0]).toBe('new@test.com');
    expect(saved[9]).toBe('e8@test.com');
  });

  it('gestisce storage vuoto (savedEmails undefined)', async () => {
    browser.storage.local.get.mockResolvedValue({});
    await EmailManager.saveEmail('first@test.com');

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      savedEmails: ['first@test.com'],
    });
  });
});

// ---------------------------------------------------------------------------
// getSavedEmails()
// ---------------------------------------------------------------------------
describe('EmailManager.getSavedEmails()', () => {
  it('ritorna lista email salvate', async () => {
    browser.storage.local.get.mockResolvedValue({
      savedEmails: ['a@b.com', 'c@d.com'],
    });
    const result = await EmailManager.getSavedEmails();
    expect(result).toEqual(['a@b.com', 'c@d.com']);
  });

  it('ritorna array vuoto se nessuna email salvata', async () => {
    browser.storage.local.get.mockResolvedValue({});
    const result = await EmailManager.getSavedEmails();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// removeEmail()
// ---------------------------------------------------------------------------
describe('EmailManager.removeEmail()', () => {
  beforeEach(() => {
    browser.storage.local.set.mockResolvedValue(undefined);
  });

  it('rimuove email specifica dalla lista', async () => {
    browser.storage.local.get.mockResolvedValue({
      savedEmails: ['a@b.com', 'c@d.com', 'e@f.com'],
    });
    await EmailManager.removeEmail('c@d.com');

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      savedEmails: ['a@b.com', 'e@f.com'],
    });
  });

  it('non modifica lista se email non presente', async () => {
    browser.storage.local.get.mockResolvedValue({
      savedEmails: ['a@b.com'],
    });
    await EmailManager.removeEmail('nonexist@b.com');

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      savedEmails: ['a@b.com'],
    });
  });

  it('gestisce lista vuota', async () => {
    browser.storage.local.get.mockResolvedValue({});
    await EmailManager.removeEmail('a@b.com');

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      savedEmails: [],
    });
  });
});

// ---------------------------------------------------------------------------
// isValidEmail()
// ---------------------------------------------------------------------------
describe('EmailManager.isValidEmail()', () => {
  it('accetta email valida standard', () => {
    expect(EmailManager.isValidEmail('user@example.com')).toBe(true);
  });

  it('accetta email con sottodominio', () => {
    expect(EmailManager.isValidEmail('user@sub.domain.com')).toBe(true);
  });

  it('rifiuta stringa senza @', () => {
    expect(EmailManager.isValidEmail('invalidemail')).toBe(false);
  });

  it('rifiuta stringa con spazi', () => {
    expect(EmailManager.isValidEmail('user @test.com')).toBe(false);
  });

  it('rifiuta stringa vuota', () => {
    expect(EmailManager.isValidEmail('')).toBe(false);
  });

  it('rifiuta email senza dominio dopo @', () => {
    expect(EmailManager.isValidEmail('user@')).toBe(false);
  });

  it('rifiuta email senza TLD', () => {
    expect(EmailManager.isValidEmail('user@domain')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatEmailContent()
// ---------------------------------------------------------------------------
describe('EmailManager.formatEmailContent()', () => {
  const article = {
    title: 'Test Article',
    url: 'https://example.com',
    wordCount: 500,
    readingTimeMinutes: 3,
  };

  it('genera subject con titolo articolo', () => {
    const { subject } = EmailManager.formatEmailContent(article, 'summary text', []);
    expect(subject).toBe('Riassunto: Test Article');
  });

  it('rimuove newline dal subject', () => {
    const articleWithNewline = { ...article, title: 'Title\nWith\rBreaks' };
    const { subject } = EmailManager.formatEmailContent(articleWithNewline, 'text', []);
    expect(subject).not.toContain('\n');
    expect(subject).not.toContain('\r');
  });

  it('include titolo, url e wordcount nel body', () => {
    const { body } = EmailManager.formatEmailContent(article, 'summary text', []);
    expect(body).toContain('Test Article');
    expect(body).toContain('https://example.com');
    expect(body).toContain('500 parole');
  });

  it('include riassunto quando fornito', () => {
    const { body } = EmailManager.formatEmailContent(article, 'Il riassunto qui.', []);
    expect(body).toContain('RIASSUNTO');
    expect(body).toContain('Il riassunto qui.');
  });

  it('include punti chiave quando forniti', () => {
    const keyPoints = [
      { title: 'Punto 1', paragraphs: '1-3', description: 'Desc uno' },
      { title: 'Punto 2', paragraphs: '4-5', description: 'Desc due' },
    ];
    const { body } = EmailManager.formatEmailContent(article, null, keyPoints);
    expect(body).toContain('PUNTI CHIAVE');
    expect(body).toContain('1. Punto 1');
    expect(body).toContain('2. Punto 2');
    expect(body).toContain('Desc uno');
  });

  it('include traduzione se fornita', () => {
    const { body } = EmailManager.formatEmailContent(article, 'sum', [], 'The translation here.');
    expect(body).toContain('TRADUZIONE');
    expect(body).toContain('The translation here.');
  });

  it('include Q&A se fornite', () => {
    const qaList = [
      { question: 'Cosa?', answer: 'Questo.' },
      { question: 'Perche?', answer: 'Perche si.' },
    ];
    const { body } = EmailManager.formatEmailContent(article, 'sum', [], null, qaList);
    expect(body).toContain('DOMANDE E RISPOSTE');
    expect(body).toContain('Q1: Cosa?');
    expect(body).toContain('R1: Questo.');
    expect(body).toContain('Q2: Perche?');
  });

  it('omette sezioni non fornite', () => {
    const { body } = EmailManager.formatEmailContent(article, null, [], null, null);
    // "RIASSUNTO ARTICOLO" è l'header fisso, "RIASSUNTO\n" è la sezione opzionale
    expect(body).not.toContain('📝 RIASSUNTO');
    expect(body).not.toContain('PUNTI CHIAVE');
    expect(body).not.toContain('TRADUZIONE');
    expect(body).not.toContain('DOMANDE E RISPOSTE');
  });

  it('termina con footer applicazione', () => {
    const { body } = EmailManager.formatEmailContent(article, 'sum', []);
    expect(body).toContain('Generato con AI Article Summarizer');
  });
});

// ---------------------------------------------------------------------------
// openEmailClient()
// ---------------------------------------------------------------------------
describe('EmailManager.openEmailClient()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea tab con link mailto corretto', () => {
    EmailManager.openEmailClient('user@test.com', 'Subject', 'Body');

    expect(browser.tabs.create).toHaveBeenCalledTimes(1);
    const { url, active } = browser.tabs.create.mock.calls[0][0];
    expect(url).toContain('mailto:');
    expect(url).toContain('user%40test.com');
    expect(active).toBe(false);
  });

  it('codifica subject e body nel mailto', () => {
    EmailManager.openEmailClient('u@t.com', 'Spazi & simboli', 'Body con\nnewline');

    const { url } = browser.tabs.create.mock.calls[0][0];
    expect(url).toContain('subject=');
    expect(url).toContain('body=');
  });

  it('lancia errore per email non valida', () => {
    expect(() => {
      EmailManager.openEmailClient('invalid', 'Sub', 'Body');
    }).toThrow('Indirizzo email non valido');
  });

  it('sanitizza caratteri pericolosi dall indirizzo email', () => {
    // \r\n\t e % vengono rimossi dal metodo
    // 'user\t@\nevil.com' diventa 'user@evil.com' che è valida, quindi non lancia
    // Testiamo che l'email risultante sia effettivamente pulita
    EmailManager.openEmailClient('user\t@\nevil.com', 'Sub', 'Body');
    const { url } = browser.tabs.create.mock.calls[0][0];
    // L'email sanitizzata non contiene tab/newline
    expect(url).not.toContain('%09'); // tab encoded
    expect(url).not.toContain('%0A'); // newline encoded
  });
});
