// Modal System - Componente modale condiviso tra tutte le pagine
import { I18n } from '../i18n/i18n-extended.js';

export const Modal = {
  show(options) {
    return new Promise((resolve) => {
      const modal = document.getElementById('customModal');
      if (!modal) {
        // Modal HTML non presente nella pagina — fallback silenzioso
        resolve(false);
        return;
      }
      const icon = document.getElementById('modalIcon');
      const title = document.getElementById('modalTitle');
      const message = document.getElementById('modalMessage');
      const confirmBtn = document.getElementById('modalConfirmBtn');
      const cancelBtn = document.getElementById('modalCancelBtn');

      // Set content
      icon.textContent = options.icon || '\u2139\uFE0F';
      title.textContent =
        options.title || (typeof I18n !== 'undefined' ? I18n.t('modal.defaultTitle') : 'Info');
      message.textContent = options.message || '';

      // Configure buttons
      if (options.type === 'confirm') {
        cancelBtn.classList.remove('hidden');
        cancelBtn.textContent =
          options.cancelText || (typeof I18n !== 'undefined' ? I18n.t('modal.cancel') : 'Annulla');
        confirmBtn.textContent =
          options.confirmText || (typeof I18n !== 'undefined' ? I18n.t('modal.confirm') : 'OK');
      } else {
        cancelBtn.classList.add('hidden');
        confirmBtn.textContent =
          options.confirmText || (typeof I18n !== 'undefined' ? I18n.t('modal.confirm') : 'OK');
      }

      // Show modal
      modal.classList.remove('hidden');

      // Event handlers
      const handleConfirm = () => {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        resolve(true);
      };

      const handleCancel = () => {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        resolve(false);
      };

      confirmBtn.addEventListener('click', handleConfirm, { once: true });
      cancelBtn.addEventListener('click', handleCancel, { once: true });

      // Close on overlay click
      const overlay = modal.querySelector('.custom-modal-overlay');
      overlay.addEventListener('click', handleCancel, { once: true });
    });
  },

  alert(message, title = I18n.t('modal.defaultTitle'), icon = '\u2139\uFE0F') {
    return this.show({ type: 'alert', title, message, icon, confirmText: 'OK' });
  },

  confirm(message, title = I18n.t('modal.confirmTitle'), icon = '\u2753') {
    return this.show({
      type: 'confirm',
      title,
      message,
      icon,
      confirmText: 'OK',
      cancelText: I18n.t('modal.cancel'),
    });
  },

  success(message, title = I18n.t('modal.successTitle')) {
    return this.show({ type: 'alert', title, message, icon: '\u2705', confirmText: 'OK' });
  },

  error(message, title = I18n.t('modal.errorTitle')) {
    return this.show({ type: 'alert', title, message, icon: '\u274C', confirmText: 'OK' });
  },

  warning(message, title = I18n.t('modal.warningTitle')) {
    return this.show({ type: 'alert', title, message, icon: '\u26A0\uFE0F', confirmText: 'OK' });
  },
};
