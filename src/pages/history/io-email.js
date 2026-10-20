import { populateSavedEmails, bindEmailModal } from '../../shared/email-modal.js';
// io-email.js — Email sending from history

import { state } from './state.js';
import { EmailManager } from '@utils/export/email-manager.js';
import { Modal } from '@utils/core/modal.js';
import { getTranslationText } from '../../shared/translation-text.js';
import { computeExportAvailability } from '../../shared/export-modal.js';
import { mergeEmailOptions, hasAnySelected } from '../../shared/email-options.js';
import { I18n } from '../../utils/i18n/i18n.js';

function getEmailAvailability(entry) {
  return computeExportAvailability({
    translation: entry.translation,
    qa: entry.qa,
    citations: entry.citations,
  });
}

const OPTIONAL_SECTIONS = [
  { option: 'emailTranslationOption', checkbox: 'emailIncludeTranslation', key: 'translation' },
  { option: 'emailQAOption', checkbox: 'emailIncludeQA', key: 'qa' },
  { option: 'emailCitationsOption', checkbox: 'emailIncludeCitations', key: 'citations' },
];

// Optional sections the entry lacks are disabled and unchecked; the available ones start checked
function configureOptionalSections(availability) {
  for (const { option, checkbox, key } of OPTIONAL_SECTIONS) {
    const available = !!availability[key];
    document.getElementById(option).classList.toggle('disabled', !available);
    const box = document.getElementById(checkbox);
    box.disabled = !available;
    box.checked = available;
  }
}

export async function sendCurrentEmail() {
  if (!state.currentEntry) return;

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

  const availability = getEmailAvailability(state.currentEntry);
  configureOptionalSections(availability);

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
        await Modal.alert(I18n.t('email.missing'), I18n.t('email.missingTitle'), '⚠️');
        return;
      }

      if (!EmailManager.isValidEmail(email)) {
        await Modal.alert(I18n.t('email.invalid'), I18n.t('email.invalidTitle'), '⚠️');
        return;
      }

      // Raccogli opzioni selezionate
      const options = mergeEmailOptions(
        {
          includeSummary: document.getElementById('emailIncludeSummary').checked,
          includeKeypoints: document.getElementById('emailIncludeKeypoints').checked,
          includeTranslation: document.getElementById('emailIncludeTranslation').checked,
          includeQA: document.getElementById('emailIncludeQA').checked,
          includeCitations: document.getElementById('emailIncludeCitations').checked,
        },
        availability,
      );

      // Verifica che almeno una opzione sia selezionata
      if (!hasAnySelected(options)) {
        await Modal.alert(I18n.t('email.noSection'), I18n.t('export.noSelectionTitle'), '⚠️');
        return;
      }

      // Salva email se nuova
      await EmailManager.saveEmail(email);

      // Genera contenuto email con opzioni
      const { subject, body } = EmailManager.formatEmailContent(
        state.currentEntry.article,
        options.includeSummary ? state.currentEntry.summary : null,
        options.includeKeypoints ? state.currentEntry.keyPoints : null,
        options.includeTranslation && state.currentEntry.translation
          ? getTranslationText(state.currentEntry.translation)
          : null,
        options.includeQA ? state.currentEntry.qa : null,
        options.includeCitations ? state.currentEntry.citations : null,
      );

      // Apri client email
      EmailManager.openEmailClient(email, subject, body);

      // Chiudi modal
      modal.classList.add('hidden');

      // Feedback
      await Modal.alert(I18n.t('email.clientOpened'), I18n.t('email.preparedTitle'), '✅');

      // Cleanup
      cleanup();
    },
  });
}
