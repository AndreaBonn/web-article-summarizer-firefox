// Popup Export Module - Estratto da popup.js
// Gestisce: exportToPDF, showExportOptionsModal, exportToMarkdown, showMarkdownExportModal, openEmailModal

import { state, elements, showError } from './state.js';
import { translationState, citationsState } from './features.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { PDFExporter } from '../../utils/export/pdf-exporter.js';
import { MarkdownExporter } from '../../utils/export/markdown-exporter.js';
import { EmailManager } from '../../utils/export/email-manager.js';
import { Modal } from '../../utils/core/modal.js';
import { Toast } from '../../utils/core/toast.js';
import { Logger } from '../../utils/core/logger.js';
import { showExportModal } from '../../shared/export-modal.js';

function _getAvailability() {
  return {
    translation: !!translationState.value,
    qa: !!(state.currentQA && state.currentQA.length > 0),
    citations: !!(
      citationsState.value &&
      citationsState.value.citations &&
      citationsState.value.citations.length > 0
    ),
  };
}

function _buildMetadata() {
  return {
    provider: elements.providerSelect.value,
    language: state.selectedLanguage,
    contentType: state.selectedContentType !== 'auto' ? state.selectedContentType : 'auto',
  };
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
  return {
    includeSummary: !!document.getElementById('emailIncludeSummary')?.checked,
    includeKeypoints: !!document.getElementById('emailIncludeKeypoints')?.checked,
    includeTranslation: !!(
      document.getElementById('emailIncludeTranslation')?.checked && availability.translation
    ),
    includeQA: !!(document.getElementById('emailIncludeQA')?.checked && availability.qa),
    includeCitations: !!(
      document.getElementById('emailIncludeCitations')?.checked && availability.citations
    ),
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
  let selectedEmail = null;

  // Mostra/nascondi sezione email salvate
  if (savedEmails.length > 0) {
    savedEmailsSection.classList.remove('hidden');

    // Popola lista
    savedEmailsList.innerHTML = '';
    savedEmails.forEach((email) => {
      const item = document.createElement('div');
      item.className = 'saved-email-item';

      const text = document.createElement('span');
      text.className = 'saved-email-text';
      text.textContent = email;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'saved-email-delete';
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Rimuovi';

      // Click per selezionare
      item.addEventListener('click', (e) => {
        if (e.target === deleteBtn) return;

        // Deseleziona tutti
        document.querySelectorAll('.saved-email-item').forEach((i) => {
          i.classList.remove('selected');
        });

        // Seleziona questo
        item.classList.add('selected');
        selectedEmail = email;
        emailInput.value = email;
      });

      // Click per eliminare
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        const confirmed = await Modal.confirm(
          `Vuoi rimuovere "${email}" dalla lista?`,
          'Rimuovi Email',
          '🗑️',
        );

        if (confirmed) {
          await EmailManager.removeEmail(email);
          item.remove();

          // Nascondi sezione se non ci sono più email
          if (savedEmailsList.children.length === 0) {
            savedEmailsSection.classList.add('hidden');
          }

          // Pulisci input se era selezionata
          if (selectedEmail === email) {
            selectedEmail = null;
            emailInput.value = '';
          }
        }
      });

      item.appendChild(text);
      item.appendChild(deleteBtn);
      savedEmailsList.appendChild(item);
    });
  } else {
    savedEmailsSection.classList.add('hidden');
  }

  _configureEmailCheckboxes();

  // Reset input
  emailInput.value = '';
  emailInput.focus();

  // Mostra modal
  modal.classList.remove('hidden');

  // Handler per invio
  const handleSend = async () => {
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
    if (!_hasAnySelected(options)) {
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
  };

  // Handler per annulla
  const handleCancel = () => {
    modal.classList.add('hidden');
    cleanup();
  };

  // Handler per overlay
  const handleOverlay = (e) => {
    if (e.target.classList.contains('custom-modal-overlay')) {
      handleCancel();
    }
  };

  // Handler per Enter
  const handleEnter = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // Cleanup function
  const cleanup = () => {
    sendBtn.removeEventListener('click', handleSend);
    cancelBtn.removeEventListener('click', handleCancel);
    modal.removeEventListener('click', handleOverlay);
    emailInput.removeEventListener('keypress', handleEnter);
  };

  // Aggiungi event listeners
  sendBtn.addEventListener('click', handleSend);
  cancelBtn.addEventListener('click', handleCancel);
  modal.addEventListener('click', handleOverlay);
  emailInput.addEventListener('keypress', handleEnter);
}
