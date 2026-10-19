import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Modal
vi.mock('../../src/utils/core/modal.js', () => ({
  Modal: {
    warning: vi.fn().mockResolvedValue(undefined),
  },
}));

const { showExportModal, computeExportAvailability } = await import('@shared/export-modal.js');
const { Modal } = await import('../../src/utils/core/modal.js');

// ---------------------------------------------------------------------------
// DOM setup helper
// ---------------------------------------------------------------------------
function setupDOM({ prefix = 'pdf', availability = {} } = {}) {
  document.body.innerHTML = `
    <div id="exportOptionsModal" class="hidden">
      <div class="custom-modal-overlay">
        <span class="custom-modal-title">Export</span>
      </div>
      <input type="checkbox" id="${prefix}IncludeSummary" checked />
      <input type="checkbox" id="${prefix}IncludeKeypoints" checked />
      <div id="${prefix}TranslationOption">
        <input type="checkbox" id="${prefix}IncludeTranslation" />
      </div>
      <div id="${prefix}QAOption">
        <input type="checkbox" id="${prefix}IncludeQA" />
      </div>
      <div id="${prefix}CitationsOption">
        <input type="checkbox" id="${prefix}IncludeCitations" />
      </div>
      <button id="exportConfirmBtn"></button>
      <button id="exportCancelBtn"></button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// showExportModal() — apertura e UI
// ---------------------------------------------------------------------------
describe('showExportModal() apertura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDOM();
  });

  it('rimuove classe hidden dal modal', () => {
    showExportModal({
      availability: {},
      onConfirm: vi.fn(),
    });

    const modal = document.getElementById('exportOptionsModal');
    expect(modal.classList.contains('hidden')).toBe(false);
  });

  it('aggiorna titolo modal se fornito', () => {
    showExportModal({
      title: 'Export PDF',
      availability: {},
      onConfirm: vi.fn(),
    });

    const title = document.querySelector('.custom-modal-title');
    expect(title.textContent).toBe('Export PDF');
  });

  it('non modifica titolo se non fornito', () => {
    showExportModal({
      availability: {},
      onConfirm: vi.fn(),
    });

    const title = document.querySelector('.custom-modal-title');
    expect(title.textContent).toBe('Export');
  });
});

// ---------------------------------------------------------------------------
// Checkbox configuration
// ---------------------------------------------------------------------------
describe('showExportModal() configurazione checkbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDOM();
  });

  it('abilita checkbox traduzione quando disponibile', () => {
    showExportModal({
      availability: { translation: true, qa: false, citations: false },
      onConfirm: vi.fn(),
    });

    const cb = document.getElementById('pdfIncludeTranslation');
    expect(cb.disabled).toBe(false);
    expect(cb.checked).toBe(true);
  });

  it('disabilita checkbox traduzione quando non disponibile', () => {
    showExportModal({
      availability: { translation: false },
      onConfirm: vi.fn(),
    });

    const cb = document.getElementById('pdfIncludeTranslation');
    expect(cb.disabled).toBe(true);
    expect(cb.checked).toBe(false);
  });

  it('aggiunge classe disabled all opzione quando non disponibile', () => {
    showExportModal({
      availability: { qa: false },
      onConfirm: vi.fn(),
    });

    const opt = document.getElementById('pdfQAOption');
    expect(opt.classList.contains('disabled')).toBe(true);
  });

  it('usa prefix custom per ID checkbox', () => {
    setupDOM({ prefix: 'email' });
    showExportModal({
      prefix: 'email',
      availability: { translation: true },
      onConfirm: vi.fn(),
    });

    const cb = document.getElementById('emailIncludeTranslation');
    expect(cb.disabled).toBe(false);
    expect(cb.checked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Confirm handler
// ---------------------------------------------------------------------------
describe('showExportModal() conferma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDOM();
  });

  it('chiama onConfirm con opzioni selezionate', async () => {
    const onConfirm = vi.fn();
    showExportModal({
      availability: { translation: true, qa: true, citations: false },
      onConfirm,
    });

    // Summary e Keypoints checked di default, translation/qa abilitati e checked
    const btn = document.getElementById('exportConfirmBtn');
    btn.click();

    // onConfirm è async, attendiamo
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));

    const options = onConfirm.mock.calls[0][0];
    expect(options.includeSummary).toBe(true);
    expect(options.includeKeypoints).toBe(true);
    expect(options.includeTranslation).toBe(true);
    expect(options.includeQA).toBe(true);
    expect(options.includeCitations).toBe(false);
  });

  it('mostra warning se nessuna sezione selezionata', async () => {
    const onConfirm = vi.fn();
    showExportModal({
      availability: {},
      onConfirm,
    });

    // Deseleziona summary e keypoints
    document.getElementById('pdfIncludeSummary').checked = false;
    document.getElementById('pdfIncludeKeypoints').checked = false;

    const btn = document.getElementById('exportConfirmBtn');
    btn.click();

    await vi.waitFor(() => expect(Modal.warning).toHaveBeenCalledTimes(1));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('chiude modal dopo conferma', async () => {
    const onConfirm = vi.fn();
    showExportModal({
      availability: {},
      onConfirm,
    });

    const btn = document.getElementById('exportConfirmBtn');
    btn.click();

    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalled());

    const modal = document.getElementById('exportOptionsModal');
    expect(modal.classList.contains('hidden')).toBe(true);
  });

  it('ripristina titolo dopo chiusura se resetTitle fornito', async () => {
    const onConfirm = vi.fn();
    showExportModal({
      title: 'New Title',
      resetTitle: 'Original Title',
      availability: {},
      onConfirm,
    });

    document.getElementById('exportConfirmBtn').click();
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalled());

    const title = document.querySelector('.custom-modal-title');
    expect(title.textContent).toBe('Original Title');
  });
});

// ---------------------------------------------------------------------------
// Cancel handler
// ---------------------------------------------------------------------------
describe('showExportModal() annullamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDOM();
  });

  it('chiude modal al click su cancel', () => {
    const onCancel = vi.fn();
    showExportModal({
      availability: {},
      onConfirm: vi.fn(),
      onCancel,
    });

    document.getElementById('exportCancelBtn').click();

    const modal = document.getElementById('exportOptionsModal');
    expect(modal.classList.contains('hidden')).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('chiude modal al click su overlay', () => {
    const onCancel = vi.fn();
    showExportModal({
      availability: {},
      onConfirm: vi.fn(),
      onCancel,
    });

    // Simula click sull'overlay — l'evento bubbles dal overlay al modal
    const overlay = document.querySelector('.custom-modal-overlay');
    overlay.click();

    const modal = document.getElementById('exportOptionsModal');
    expect(modal.classList.contains('hidden')).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('non lancia errore se onCancel non fornito', () => {
    showExportModal({
      availability: {},
      onConfirm: vi.fn(),
    });

    expect(() => {
      document.getElementById('exportCancelBtn').click();
    }).not.toThrow();
  });
});

function modal_is_hidden() {
  return document.getElementById('exportOptionsModal').classList.contains('hidden');
}

// ---------------------------------------------------------------------------
// Cleanup listeners
// ---------------------------------------------------------------------------
describe('showExportModal() cleanup listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDOM();
  });

  it('rimuove event listener dopo conferma (non chiama 2 volte)', async () => {
    const onConfirm = vi.fn();
    showExportModal({
      availability: {},
      onConfirm,
    });

    const btn = document.getElementById('exportConfirmBtn');
    btn.click();
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));

    // Secondo click non dovrebbe chiamare onConfirm di nuovo
    btn.click();
    // Potrebbe non avere listener, o avere nuovo listener — verifichiamo max 1 call
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('computeExportAvailability()', () => {
  it('marks empty and missing optional sections unavailable', () => {
    expect(computeExportAvailability({ translation: null, qa: [], citations: { citations: [] } }))
      .toEqual({ translation: false, qa: false, citations: false });
    expect(computeExportAvailability({})).toEqual({ translation: false, qa: false, citations: false });
    expect(computeExportAvailability({ citations: {} })).toEqual({ translation: false, qa: false, citations: false });
  });

  it('marks populated optional sections available', () => {
    expect(computeExportAvailability({ translation: { text: 'Ciao' }, qa: [{ question: 'Why?', answer: 'Because' }], citations: { citations: [{ id: 1 }] } }))
      .toEqual({ translation: true, qa: true, citations: true });
  });
});
