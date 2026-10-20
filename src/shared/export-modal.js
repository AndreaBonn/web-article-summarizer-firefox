/**
 * export-modal.js — Componente condiviso per il modal di selezione opzioni export.
 *
 * Usato da: popup/export.js, history/detail.js
 * Non usato da: multi-analysis/export.js (struttura HTML e opzioni diverse)
 *
 * @param {object} config
 * @param {string} [config.title]           Testo del titolo (sovrascrive quello corrente nel DOM)
 * @param {string} [config.resetTitle]      Titolo da ripristinare dopo chiusura (opzionale)
 * @param {object} config.availability      Disponibilità delle sezioni opzionali
 * @param {boolean} config.availability.translation
 * @param {boolean} config.availability.qa
 * @param {boolean} config.availability.citations
 * @param {string}  [config.prefix='pdf']   Prefisso degli ID delle checkbox (es. 'pdf' o 'email')
 * @param {Function} config.onConfirm       Chiamato con { includeSummary, includeKeypoints,
 *                                          includeTranslation, includeQA, includeCitations }
 * @param {Function} [config.onCancel]      Chiamato alla chiusura senza conferma
 */
import { Modal } from '../utils/core/modal.js';
import { I18n } from '../utils/i18n/i18n.js';

export function showExportModal({
  title,
  resetTitle,
  availability,
  prefix = 'pdf',
  onConfirm,
  onCancel,
}) {
  const modal = document.getElementById('exportOptionsModal');
  const modalTitle = modal ? modal.querySelector('.custom-modal-title') : null;

  // Aggiorna titolo se fornito
  if (title && modalTitle) {
    modalTitle.textContent = title;
  }

  // Configura disponibilità checkbox
  _configureCheckboxes(prefix, availability);

  // Mostra modal
  modal.classList.remove('hidden');

  // Handler confirm
  const handleConfirm = async () => {
    const options = _collectOptions(prefix, availability);

    if (!_hasAnySelected(options)) {
      await Modal.warning(I18n.t('export.noSelection'), I18n.t('export.noSelectionTitle'));
      return;
    }

    _close(modal, modalTitle, resetTitle);
    cleanup();
    await onConfirm(options);
  };

  // Handler cancel
  const handleCancel = () => {
    _close(modal, modalTitle, resetTitle);
    cleanup();
    if (onCancel) onCancel();
  };

  // Handler overlay click
  const handleOverlay = (e) => {
    if (e.target.classList.contains('custom-modal-overlay')) {
      handleCancel();
    }
  };

  const cleanup = () => {
    document.getElementById('exportConfirmBtn').removeEventListener('click', handleConfirm);
    document.getElementById('exportCancelBtn').removeEventListener('click', handleCancel);
    modal.removeEventListener('click', handleOverlay);
  };

  document.getElementById('exportConfirmBtn').addEventListener('click', handleConfirm);
  document.getElementById('exportCancelBtn').addEventListener('click', handleCancel);
  modal.addEventListener('click', handleOverlay);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function _configureCheckboxes(prefix, availability) {
  const pairs = [
    {
      option: `${prefix}TranslationOption`,
      checkbox: `${prefix}IncludeTranslation`,
      available: !!availability.translation,
    },
    {
      option: `${prefix}QAOption`,
      checkbox: `${prefix}IncludeQA`,
      available: !!availability.qa,
    },
    {
      option: `${prefix}CitationsOption`,
      checkbox: `${prefix}IncludeCitations`,
      available: !!availability.citations,
    },
  ];

  for (const { option, checkbox, available } of pairs) {
    const optEl = document.getElementById(option);
    const cbEl = document.getElementById(checkbox);
    if (!optEl || !cbEl) continue;
    optEl.classList.toggle('disabled', !available);
    cbEl.disabled = !available;
    cbEl.checked = available;
  }
}

function _collectOptions(prefix, availability) {
  const summaryChecked = document.getElementById(`${prefix}IncludeSummary`);
  const keypointsChecked = document.getElementById(`${prefix}IncludeKeypoints`);
  const translationChecked = document.getElementById(`${prefix}IncludeTranslation`);
  const qaChecked = document.getElementById(`${prefix}IncludeQA`);
  const citationsChecked = document.getElementById(`${prefix}IncludeCitations`);

  return {
    includeSummary: summaryChecked ? summaryChecked.checked : false,
    includeKeypoints: keypointsChecked ? keypointsChecked.checked : false,
    includeTranslation: !!(
      translationChecked &&
      translationChecked.checked &&
      availability.translation
    ),
    includeQA: !!(qaChecked && qaChecked.checked && availability.qa),
    includeCitations: !!(citationsChecked && citationsChecked.checked && availability.citations),
  };
}

function _hasAnySelected(options) {
  return (
    options.includeSummary ||
    options.includeKeypoints ||
    options.includeTranslation ||
    options.includeQA ||
    options.includeCitations
  );
}

function _close(modal, modalTitle, resetTitle) {
  modal.classList.add('hidden');
  if (resetTitle && modalTitle) {
    modalTitle.textContent = resetTitle;
  }
}

export function computeExportAvailability({ translation, qa, citations }) {
  return {
    translation: !!translation,
    qa: !!(qa && qa.length > 0),
    citations: !!(citations && citations.citations && citations.citations.length > 0),
  };
}
