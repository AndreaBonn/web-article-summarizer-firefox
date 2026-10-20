import { populateSavedEmails, bindEmailModal } from '../../shared/email-modal.js';
// io-email.js — Email sending from history

import { state } from './state.js';
import { EmailManager } from '@utils/export/email-manager.js';
import { Modal } from '@utils/core/modal.js';
import { getTranslationText } from '../../shared/translation-text.js';
import { computeExportAvailability } from '../../shared/export-modal.js';
import { mergeEmailOptions, hasAnySelected } from '../../shared/email-options.js';

// History emails never carry citations, so they are always reported as unavailable.
function getEmailAvailability(entry) {
  return computeExportAvailability({
    translation: entry.translation,
    qa: entry.qa,
    citations: null,
  });
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

  // Gestisci disponibilità opzioni
  const translationOption = document.getElementById('emailTranslationOption');
  const qaOption = document.getElementById('emailQAOption');
  const translationCheckbox = document.getElementById('emailIncludeTranslation');
  const qaCheckbox = document.getElementById('emailIncludeQA');

  const availability = getEmailAvailability(state.currentEntry);

  // Gestisci disponibilità traduzione
  if (availability.translation) {
    translationOption.classList.remove('disabled');
    translationCheckbox.disabled = false;
    translationCheckbox.checked = true;
  } else {
    translationOption.classList.add('disabled');
    translationCheckbox.disabled = true;
    translationCheckbox.checked = false;
  }

  // Gestisci disponibilità Q&A
  if (availability.qa) {
    qaOption.classList.remove('disabled');
    qaCheckbox.disabled = false;
    qaCheckbox.checked = true;
  } else {
    qaOption.classList.add('disabled');
    qaCheckbox.disabled = true;
    qaCheckbox.checked = false;
  }

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
        await Modal.alert('Inserisci un indirizzo email', 'Email Mancante', '⚠️');
        return;
      }

      if (!EmailManager.isValidEmail(email)) {
        await Modal.alert('Inserisci un indirizzo email valido', 'Email Non Valida', '⚠️');
        return;
      }

      // Raccogli opzioni selezionate
      const options = mergeEmailOptions(
        {
          includeSummary: document.getElementById('emailIncludeSummary').checked,
          includeKeypoints: document.getElementById('emailIncludeKeypoints').checked,
          includeTranslation: document.getElementById('emailIncludeTranslation').checked,
          includeQA: document.getElementById('emailIncludeQA').checked,
        },
        availability,
      );

      // Verifica che almeno una opzione sia selezionata
      if (!hasAnySelected(options)) {
        await Modal.alert('Seleziona almeno una sezione da includere', 'Nessuna Selezione', '⚠️');
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
      );

      // Apri client email
      EmailManager.openEmailClient(email, subject, body);

      // Chiudi modal
      modal.classList.add('hidden');

      // Feedback
      await Modal.alert(
        'Il client email è stato aperto. Verifica e invia il messaggio.',
        'Email Preparata',
        '✅',
      );

      // Cleanup
      cleanup();
    },
  });
}
