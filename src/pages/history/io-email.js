import { populateSavedEmails, bindEmailModal } from '../../shared/email-modal.js';
// io-email.js — Email sending from history

import { state } from './state.js';
import { EmailManager } from '@utils/export/email-manager.js';
import { Modal } from '@utils/core/modal.js';
import { getTranslationText } from '../../shared/translation-text.js';

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

  // Gestisci disponibilità traduzione
  if (state.currentEntry.translation) {
    translationOption.classList.remove('disabled');
    translationCheckbox.disabled = false;
    translationCheckbox.checked = true;
  } else {
    translationOption.classList.add('disabled');
    translationCheckbox.disabled = true;
    translationCheckbox.checked = false;
  }

  // Gestisci disponibilità Q&A
  if (state.currentEntry.qa && state.currentEntry.qa.length > 0) {
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
      const options = {
        includeSummary: document.getElementById('emailIncludeSummary').checked,
        includeKeypoints: document.getElementById('emailIncludeKeypoints').checked,
        includeTranslation:
          document.getElementById('emailIncludeTranslation').checked &&
          state.currentEntry.translation,
        includeQA:
          document.getElementById('emailIncludeQA').checked &&
          state.currentEntry.qa &&
          state.currentEntry.qa.length > 0,
      };

      // Verifica che almeno una opzione sia selezionata
      if (
        !options.includeSummary &&
        !options.includeKeypoints &&
        !options.includeTranslation &&
        !options.includeQA
      ) {
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
