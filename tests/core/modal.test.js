import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@utils/i18n/i18n-extended.js', () => ({
  I18n: {
    t: vi.fn((key) => key),
  },
}));

import { Modal } from '@utils/core/modal.js';

describe('Modal', () => {
  let modal, icon, title, message, confirmBtn, cancelBtn, overlay;

  beforeEach(() => {
    overlay = { addEventListener: vi.fn() };
    modal = {
      classList: { add: vi.fn(), remove: vi.fn() },
      querySelector: vi.fn(() => overlay),
    };
    icon = { textContent: '' };
    title = { textContent: '' };
    message = { textContent: '' };
    confirmBtn = {
      textContent: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn() },
    };
    cancelBtn = {
      textContent: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn() },
    };

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      const map = {
        customModal: modal,
        modalIcon: icon,
        modalTitle: title,
        modalMessage: message,
        modalConfirmBtn: confirmBtn,
        modalCancelBtn: cancelBtn,
      };
      return map[id] || null;
    });
  });

  describe('show()', () => {
    it('test_show_alertType_hidesCancelButton', async () => {
      const p = Modal.show({ type: 'alert', message: 'Test' });

      // Simulate confirm click
      const confirmHandler = confirmBtn.addEventListener.mock.calls[0][1];
      confirmHandler();

      const result = await p;
      expect(result).toBe(true);
      expect(cancelBtn.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('test_show_confirmType_showsCancelButton', async () => {
      const p = Modal.show({ type: 'confirm', message: 'Sure?' });

      const confirmHandler = confirmBtn.addEventListener.mock.calls[0][1];
      confirmHandler();

      await p;
      expect(cancelBtn.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('test_show_cancel_resolvesFalse', async () => {
      const p = Modal.show({ type: 'confirm', message: 'Sure?' });

      const cancelHandler = cancelBtn.addEventListener.mock.calls[0][1];
      cancelHandler();

      const result = await p;
      expect(result).toBe(false);
    });

    it('test_show_setsContentFromOptions', async () => {
      const p = Modal.show({
        type: 'alert',
        title: 'My Title',
        message: 'My Message',
        icon: '🔥',
        confirmText: 'Got it',
      });

      expect(icon.textContent).toBe('🔥');
      expect(title.textContent).toBe('My Title');
      expect(message.textContent).toBe('My Message');
      expect(confirmBtn.textContent).toBe('Got it');

      const confirmHandler = confirmBtn.addEventListener.mock.calls[0][1];
      confirmHandler();
      await p;
    });

    it('test_show_noModalElement_resolvesFalse', async () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);
      const result = await Modal.show({ message: 'Test' });
      expect(result).toBe(false);
    });

    it('test_show_removesModalOnDismiss', async () => {
      const p = Modal.show({ type: 'alert', message: 'Test' });

      expect(modal.classList.remove).toHaveBeenCalledWith('hidden');

      const confirmHandler = confirmBtn.addEventListener.mock.calls[0][1];
      confirmHandler();
      await p;

      expect(modal.classList.add).toHaveBeenCalledWith('hidden');
    });
  });

  describe('shortcut methods', () => {
    it('test_alert_usesInfoIcon', async () => {
      const p = Modal.alert('Alert msg');
      const confirmHandler = confirmBtn.addEventListener.mock.calls[0][1];
      confirmHandler();
      await p;

      expect(icon.textContent).toBe('ℹ️');
      expect(message.textContent).toBe('Alert msg');
    });

    it('test_confirm_usesQuestionIcon', async () => {
      const p = Modal.confirm('Confirm msg');
      const cancelHandler = cancelBtn.addEventListener.mock.calls[0][1];
      cancelHandler();
      await p;

      expect(icon.textContent).toBe('❓');
    });

    it('test_success_usesCheckIcon', async () => {
      const p = Modal.success('Done!');
      const confirmHandler = confirmBtn.addEventListener.mock.calls[0][1];
      confirmHandler();
      await p;

      expect(icon.textContent).toBe('✅');
      expect(title.textContent).toBe('modal.successTitle');
    });

    it('test_error_usesErrorIcon', async () => {
      const p = Modal.error('Failed!');
      const confirmHandler = confirmBtn.addEventListener.mock.calls[0][1];
      confirmHandler();
      await p;

      expect(icon.textContent).toBe('❌');
      expect(title.textContent).toBe('modal.errorTitle');
    });

    it('test_warning_usesWarningIcon', async () => {
      const p = Modal.warning('Careful!');
      const confirmHandler = confirmBtn.addEventListener.mock.calls[0][1];
      confirmHandler();
      await p;

      expect(icon.textContent).toBe('⚠️');
      expect(title.textContent).toBe('modal.warningTitle');
    });
  });
});
