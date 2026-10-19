// Toast — short non-blocking message shown inside the page instead of a modal dialog.
import { I18n } from '../i18n/i18n.js';

const HOST_CLASS = 'app-toast-host';

function getHost() {
  let host = document.querySelector(`.${HOST_CLASS}`);
  if (!host) {
    host = document.createElement('div');
    host.className = HOST_CLASS;
    document.body.appendChild(host);
  }
  return host;
}

export const Toast = {
  DURATION_MS: 4000,

  /**
   * @param {string} message - plain text, never interpreted as HTML
   * @param {'success'|'error'|'info'} type
   */
  show(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `app-toast app-toast--${type}`;
    // Errors interrupt screen readers, confirmations wait their turn.
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const text = document.createElement('span');
    text.className = 'app-toast__text';
    text.textContent = message;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'app-toast__close';
    close.setAttribute('aria-label', I18n.t('common.close'));
    close.textContent = '×';
    close.addEventListener('click', () => toast.remove());

    toast.append(text, close);
    getHost().appendChild(toast);

    setTimeout(() => toast.remove(), this.DURATION_MS);
    return toast;
  },
};
