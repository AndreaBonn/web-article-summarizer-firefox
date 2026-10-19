import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { populateSavedEmails, bindEmailModal } from '../../src/shared/email-modal.js';
import { EmailManager } from '../../src/utils/export/email-manager.js';
import { Modal } from '../../src/utils/core/modal.js';

vi.mock('../../src/utils/export/email-manager.js', () => ({
  EmailManager: { removeEmail: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../src/utils/core/modal.js', () => ({
  Modal: { confirm: vi.fn().mockResolvedValue(true) },
}));

let config;
beforeEach(() => {
  vi.clearAllMocks();
  Modal.confirm.mockResolvedValue(true);
  document.body.innerHTML =
    '<div id="section" class="hidden"><div id="list"></div></div><div id="modal"><div class="custom-modal-overlay"></div><input><button id="send"></button><button id="cancel"></button></div>';
  config = {
    modal: document.querySelector('#modal'),
    sendBtn: document.querySelector('#send'),
    cancelBtn: document.querySelector('#cancel'),
    emailInput: document.querySelector('input'),
    onSend: vi.fn(),
  };
});
afterEach(() => {
  vi.restoreAllMocks();
});

function populate(savedEmails) {
  populateSavedEmails({
    savedEmails,
    listEl: document.querySelector('#list'),
    sectionEl: document.querySelector('#section'),
    inputEl: config.emailInput,
  });
}

describe('saved emails', () => {
  it('selects clicked email and deselects the previous item', () => {
    populate(['first@example.com', 'second@example.com']);
    const items = document.querySelectorAll('.saved-email-item');
    expect(document.querySelector('#section').classList.contains('hidden')).toBe(false);
    items[0].click();
    expect(items[0].classList.contains('selected')).toBe(true);
    expect(config.emailInput.value).toBe('first@example.com');
    items[1].querySelector('span').click();
    expect(items[0].classList.contains('selected')).toBe(false);
    expect(items[1].classList.contains('selected')).toBe(true);
    expect(config.emailInput.value).toBe('second@example.com');
  });

  it('removes a confirmed selected email, hides the empty section and clears the input', async () => {
    populate(['first@example.com']);
    document.querySelector('.saved-email-item').click();
    document.querySelector('.saved-email-delete').click();
    await vi.waitFor(() => expect(document.querySelector('#list').children.length).toBe(0));
    expect(Modal.confirm).toHaveBeenCalledWith(
      'Vuoi rimuovere "first@example.com" dalla lista?',
      'Rimuovi Email',
      '🗑️',
    );
    expect(EmailManager.removeEmail).toHaveBeenCalledWith('first@example.com');
    expect(config.emailInput.value).toBe('');
    expect(document.querySelector('#section').classList.contains('hidden')).toBe(true);
  });

  it('keeps the selected input and visible section when another email is removed', async () => {
    populate(['first@example.com', 'second@example.com']);
    document.querySelectorAll('.saved-email-item')[1].click();
    document.querySelector('.saved-email-delete').click();
    await vi.waitFor(() => expect(document.querySelector('#list').children.length).toBe(1));
    expect(config.emailInput.value).toBe('second@example.com');
    expect(document.querySelector('#section').classList.contains('hidden')).toBe(false);
  });

  it('retains an email when deletion is cancelled and removes it after confirmation', async () => {
    populate(['first@example.com']);
    Modal.confirm.mockResolvedValueOnce(false);
    document.querySelector('.saved-email-delete').click();
    await vi.waitFor(() => expect(Modal.confirm).toHaveBeenCalledTimes(1));
    expect(document.querySelector('#list').textContent).toContain('first@example.com');
    expect(EmailManager.removeEmail).not.toHaveBeenCalled();
    document.querySelector('.saved-email-delete').click();
    await vi.waitFor(() => expect(EmailManager.removeEmail).toHaveBeenCalledTimes(1));
  });

  it('hides an empty saved email section', () => {
    populate(['first@example.com']);
    expect(document.querySelector('#section').classList.contains('hidden')).toBe(false);
    populate([]);
    expect(document.querySelector('#section').classList.contains('hidden')).toBe(true);
  });
});

describe('email modal bindings', () => {
  it('sends on click and Enter, and exposes cleanup to the caller', () => {
    const cleanup = bindEmailModal(config);
    config.sendBtn.click();
    expect(config.onSend).toHaveBeenCalledWith({ cleanup });
    config.emailInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'a', bubbles: true }));
    expect(config.onSend).toHaveBeenCalledTimes(1);
    config.emailInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
    expect(config.onSend).toHaveBeenCalledTimes(2);
    cleanup();
    config.sendBtn.click();
    expect(config.onSend).toHaveBeenCalledTimes(2);
  });

  it.each(['overlay', 'cancel'])('closes on %s and removes all listeners', (mode) => {
    bindEmailModal(config);
    config.sendBtn.click();
    expect(config.onSend).toHaveBeenCalledTimes(1);
    config.emailInput.click();
    expect(config.modal.classList.contains('hidden')).toBe(false);
    (mode === 'overlay'
      ? document.querySelector('.custom-modal-overlay')
      : config.cancelBtn
    ).click();
    expect(config.modal.classList.contains('hidden')).toBe(true);
    config.modal.classList.remove('hidden');
    config.sendBtn.click();
    config.emailInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
    config.cancelBtn.click();
    document.querySelector('.custom-modal-overlay').click();
    expect(config.onSend).toHaveBeenCalledTimes(1);
    expect(config.modal.classList.contains('hidden')).toBe(false);
  });
});
