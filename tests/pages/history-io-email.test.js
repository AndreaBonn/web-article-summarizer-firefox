import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  onSend: null,
  alert: vi.fn(),
  saveEmail: vi.fn(),
  formatEmailContent: vi.fn(() => ({ subject: 's', body: 'b' })),
  openEmailClient: vi.fn(),
  cleanup: vi.fn(),
}));

vi.mock('../../src/shared/email-modal.js', () => ({
  populateSavedEmails: vi.fn(),
  bindEmailModal: ({ onSend }) => {
    mocks.onSend = onSend;
  },
}));
vi.mock('@utils/export/email-manager.js', () => ({
  EmailManager: {
    getSavedEmails: async () => [],
    isValidEmail: () => true,
    saveEmail: mocks.saveEmail,
    formatEmailContent: mocks.formatEmailContent,
    openEmailClient: mocks.openEmailClient,
  },
}));
vi.mock('@utils/core/modal.js', () => ({ Modal: { alert: mocks.alert } }));

import { state } from '../../src/pages/history/state.js';
import { sendCurrentEmail } from '../../src/pages/history/io-email.js';

const ENTRY = {
  article: { title: 'T' },
  summary: 'SUM',
  keyPoints: ['k1'],
  translation: 'TRANS',
  qa: [{ question: 'q', answer: 'a' }],
  citations: { citations: [{ text: 'c' }] },
};

function buildDom() {
  document.body.innerHTML = `
    <div id="emailModal" class="hidden"></div>
    <input id="emailInput" />
    <div id="savedEmailsSection"></div><div id="savedEmailsList"></div>
    <button id="emailSendBtn"></button><button id="emailCancelBtn"></button>
    <label id="emailTranslationOption"><input type="checkbox" id="emailIncludeTranslation" /></label>
    <label id="emailQAOption"><input type="checkbox" id="emailIncludeQA" /></label>
    <label id="emailCitationsOption"><input type="checkbox" id="emailIncludeCitations" /></label>
    <input type="checkbox" id="emailIncludeSummary" />
    <input type="checkbox" id="emailIncludeKeypoints" />`;
}

const el = (id) => document.getElementById(id);

async function open(entry) {
  state.currentEntry = entry;
  await sendCurrentEmail();
  el('emailInput').value = 'a@b.it';
}

async function send() {
  await mocks.onSend({ cleanup: mocks.cleanup });
}

describe('history email sending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildDom();
  });

  it('enables and pre-checks translation, Q&A and citations when the entry has them', async () => {
    await open(ENTRY);
    for (const id of ['emailIncludeTranslation', 'emailIncludeQA', 'emailIncludeCitations']) {
      expect(el(id).disabled).toBe(false);
      expect(el(id).checked).toBe(true);
    }
    for (const id of ['emailTranslationOption', 'emailQAOption', 'emailCitationsOption']) {
      expect(el(id).classList.contains('disabled')).toBe(false);
    }
  });

  it('disables the optional sections the entry lacks (empty arrays included)', async () => {
    await open({ ...ENTRY, translation: null, qa: [], citations: { citations: [] } });
    for (const id of ['emailIncludeTranslation', 'emailIncludeQA', 'emailIncludeCitations']) {
      expect(el(id).disabled).toBe(true);
      expect(el(id).checked).toBe(false);
    }
    for (const id of ['emailTranslationOption', 'emailQAOption', 'emailCitationsOption']) {
      expect(el(id).classList.contains('disabled')).toBe(true);
    }
  });

  it('alerts and sends nothing when no section is selected', async () => {
    await open(ENTRY);
    el('emailIncludeTranslation').checked = false;
    el('emailIncludeQA').checked = false;
    el('emailIncludeCitations').checked = false;
    await send();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Seleziona almeno una sezione da includere',
      'Nessuna Selezione',
      '⚠️',
    );
    expect(mocks.openEmailClient).not.toHaveBeenCalled();
    expect(mocks.saveEmail).not.toHaveBeenCalled();
  });

  it('includes only the checked sections', async () => {
    await open(ENTRY);
    el('emailIncludeSummary').checked = true;
    el('emailIncludeKeypoints').checked = false;
    el('emailIncludeCitations').checked = false;
    await send();
    expect(mocks.formatEmailContent).toHaveBeenCalledWith(
      ENTRY.article,
      'SUM',
      null,
      'TRANS',
      ENTRY.qa,
      null,
    );
    expect(mocks.openEmailClient).toHaveBeenCalledWith('a@b.it', 's', 'b');
  });

  it('passes every section, citations included, when all are checked', async () => {
    await open(ENTRY);
    el('emailIncludeSummary').checked = true;
    el('emailIncludeKeypoints').checked = true;
    await send();
    expect(mocks.formatEmailContent).toHaveBeenCalledWith(
      ENTRY.article,
      'SUM',
      ENTRY.keyPoints,
      'TRANS',
      ENTRY.qa,
      ENTRY.citations,
    );
  });

  it('a section unavailable on the entry is not sent even if its box is force-checked', async () => {
    await open({ ...ENTRY, translation: null, qa: [], citations: null });
    el('emailIncludeTranslation').checked = true;
    el('emailIncludeQA').checked = true;
    el('emailIncludeCitations').checked = true;
    await send();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Seleziona almeno una sezione da includere',
      'Nessuna Selezione',
      '⚠️',
    );
    expect(mocks.formatEmailContent).not.toHaveBeenCalled();
  });
});
