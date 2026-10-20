import { EmailManager } from '../utils/export/email-manager.js';
import { Modal } from '../utils/core/modal.js';
import { I18n } from '../utils/i18n/i18n.js';

export function populateSavedEmails({ savedEmails, listEl, sectionEl, inputEl }) {
  let selectedEmail = null;

  // Mostra/nascondi sezione email salvate
  if (savedEmails.length > 0) {
    sectionEl.classList.remove('hidden');

    // Popola lista
    listEl.innerHTML = '';
    savedEmails.forEach((email) => {
      const item = document.createElement('div');
      item.className = 'saved-email-item';

      const text = document.createElement('span');
      text.className = 'saved-email-text';
      text.textContent = email;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'saved-email-delete';
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = I18n.t('email.removeTitle');

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
        inputEl.value = email;
      });

      // Click per eliminare
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        const confirmed = await Modal.confirm(
          I18n.tf('email.confirmRemove', { email }),
          I18n.t('email.removeEmailTitle'),
          '🗑️',
        );

        if (confirmed) {
          await EmailManager.removeEmail(email);
          item.remove();

          // Nascondi sezione se non ci sono più email
          if (listEl.children.length === 0) {
            sectionEl.classList.add('hidden');
          }

          // Pulisci input se era selezionata
          if (selectedEmail === email) {
            selectedEmail = null;
            inputEl.value = '';
          }
        }
      });

      item.appendChild(text);
      item.appendChild(deleteBtn);
      listEl.appendChild(item);
    });
  } else {
    sectionEl.classList.add('hidden');
  }
}

export function bindEmailModal({ modal, sendBtn, cancelBtn, emailInput, onSend }) {
  const handleSend = async () => {
    await onSend({ cleanup });
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
  return cleanup;
}
