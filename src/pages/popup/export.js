import { populateSavedEmails, bindEmailModal } from '../../shared/email-modal.js';
// Popup Export Module - Estratto da popup.js
// Gestisce: exportToPDF, showExportOptionsModal, exportToMarkdown, showMarkdownExportModal, openEmailModal

import { buildExportMetadata, mergeEmailOptions, hasAnySelected } from './export-options.js';
import { state, elements, showError } from './state.js';
import { translationState, citationsState } from './features.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { PDFExporter } from '../../utils/export/pdf-exporter.js';
import { MarkdownExporter } from '../../utils/export/markdown-exporter.js';
import { EmailManager } from '../../utils/export/email-manager.js';
import { Toast } from '../../utils/core/toast.js';
import { Logger } from '../../utils/core/logger.js';
import { showExportModal, computeExportAvailability } from '../../shared/export-modal.js';

function _getAvailability() {
  return computeExportAvailability({
    translation: translationState.value,
    qa: state.currentQA,
    citations: citationsState.value,
  });
}

function _buildMetadata() {
  return buildExportMetadata({
    providerValue: elements.providerSelect.value,
    selectedLanguage: state.selectedLanguage,
    selectedContentType: state.selectedContentType,
  });
}

// Export to PDF
export async function exportToPDF() {
  if (!state.currentArticle || !state.currentResults) {
    showError('Nessun riassunto da esportare');
    return;
  }

  showExportOptionsModal();
}

export function showExportOptionsModal() {
  showExportModal({
    availability: _getAvailability(),
    prefix: 'pdf',
    onConfirm: async (options) => {
      try {
        await PDFExporter.exportToPDF(
          state.currentArticle,
          options.includeSummary ? state.currentResults.summary : null,
          options.includeKeypoints ? state.currentResults.keyPoints : null,
          _buildMetadata(),
          options.includeTranslation ? translationState.value : null,
          options.includeQA ? state.currentQA : null,
          options.includeCitations ? citationsState.value : null,
        );

        Toast.show(I18n.t('feedback.exported'), 'success');
      } catch (error) {
        Logger.error('Errore esportazione PDF:', error);
        showError("Errore durante l'esportazione PDF: " + error.message);
      }
    },
  });
}

// Export to Markdown
export async function exportToMarkdown() {
  if (!state.currentArticle || !state.currentResults) {
    showError('Nessun riassunto da esportare');
    return;
  }

  showMarkdownExportModal();
}

export function showMarkdownExportModal() {
  showExportModal({
    title: I18n.t('export.markdown'),
    resetTitle: I18n.t('export.pdf'),
    availability: _getAvailability(),
    prefix: 'pdf',
    onConfirm: async (options) => {
      try {
        MarkdownExporter.exportToMarkdown(
          state.currentArticle,
          options.includeSummary ? state.currentResults.summary : null,
          options.includeKeypoints ? state.currentResults.keyPoints : null,
          _buildMetadata(),
          options.includeTranslation ? translationState.value : null,
          options.includeQA ? state.currentQA : null,
          null, // notes
          options.includeCitations ? citationsState.value : null,
        );

        Toast.show(I18n.t('feedback.exported'), 'success');
      } catch (error) {
        Logger.error('Errore esportazione Markdown:', error);
        showError("Errore durante l'esportazione Markdown: " + error.message);
      }
    },
  });
}

// Helpers locali per openEmailModal (checkbox email* nel modal dedicato)
function _configureEmailCheckboxes() {
  const availability = _getAvailability();
  const pairs = [
    {
      option: 'emailTranslationOption',
      checkbox: 'emailIncludeTranslation',
      available: availability.translation,
    },
    { option: 'emailQAOption', checkbox: 'emailIncludeQA', available: availability.qa },
    {
      option: 'emailCitationsOption',
      checkbox: 'emailIncludeCitations',
      available: availability.citations,
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

function _collectEmailOptions() {
  const availability = _getAvailability();
  return mergeEmailOptions(
    {
      includeSummary: document.getElementById('emailIncludeSummary')?.checked,
      includeKeypoints: document.getElementById('emailIncludeKeypoints')?.checked,
      includeTranslation: document.getElementById('emailIncludeTranslation')?.checked,
      includeQA: document.getElementById('emailIncludeQA')?.checked,
      includeCitations: document.getElementById('emailIncludeCitations')?.checked,
    },
    availability,
  );
}

// Email System
export async function openEmailModal() {
  if (!state.currentArticle || !state.currentResults) {
    showError('Nessun riassunto da inviare');
    return;
  }

  const modal = document.getElementById('emailModal');
  const emailInput = document.getElementById('emailInput');
  const savedEmailsSection = document.getElementById('savedEmailsSection');
  const savedEmailsList = document.getElementById('savedEmailsList');
  const sendBtn = document.getElementById('emailSendBtn');
  const cancelBtn = document.getElementById('emailCancelBtn');

  // Carica email salvate
  const savedEmails = await EmailManager.getSavedEmails();
  populateSavedEmails({
    savedEmails,
    listEl: savedEmailsList,
    sectionEl: savedEmailsSection,
    inputEl: emailInput,
  });

  _configureEmailCheckboxes();

  // Reset input
  emailInput.value = '';
  emailInput.focus();

  // Mostra modal
  modal.classList.remove('hidden');

  // Handler per invio
  bindEmailModal({
    modal,
    sendBtn,
    cancelBtn,
    emailInput,
    onSend: async ({ cleanup }) => {
      const email = emailInput.value.trim();

      if (!email) {
        Toast.show(I18n.t('email.missing'), 'error');
        return;
      }

      if (!EmailManager.isValidEmail(email)) {
        Toast.show(I18n.t('email.invalid'), 'error');
        return;
      }

      // Raccogli opzioni selezionate
      const options = _collectEmailOptions();
      if (!hasAnySelected(options)) {
        Toast.show(I18n.t('email.noSection'), 'error');
        return;
      }

      // Salva email se nuova
      await EmailManager.saveEmail(email);

      // Genera contenuto email con opzioni
      const { subject, body } = EmailManager.formatEmailContent(
        state.currentArticle,
        options.includeSummary ? state.currentResults.summary : null,
        options.includeKeypoints ? state.currentResults.keyPoints : null,
        options.includeTranslation ? translationState.value : null,
        options.includeQA ? state.currentQA : null,
        options.includeCitations ? citationsState.value : null,
      );

      // Apri client email
      EmailManager.openEmailClient(email, subject, body);

      // Chiudi modal
      modal.classList.add('hidden');

      // Feedback
      Toast.show(I18n.t('email.clientOpened'), 'success');

      // Cleanup
      cleanup();
    },
  });
}
