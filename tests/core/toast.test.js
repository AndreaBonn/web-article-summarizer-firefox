import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Toast } from '@utils/core/toast.js';

describe('Toast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('test_show_errorMessage_rendersAlertWithTextAndRole', () => {
    Toast.show('Copia non riuscita', 'error');
    const toast = document.querySelector('.app-toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Copia non riuscita');
    expect(toast.getAttribute('role')).toBe('alert');
    expect(toast.classList.contains('app-toast--error')).toBe(true);
  });

  it('test_show_successMessage_usesPoliteStatusRole', () => {
    Toast.show('Salvato', 'success');
    const toast = document.querySelector('.app-toast');
    expect(toast.getAttribute('role')).toBe('status');
  });

  it('test_show_afterTimeout_removesToast', () => {
    Toast.show('Salvato', 'success');
    expect(document.querySelectorAll('.app-toast')).toHaveLength(1);
    vi.advanceTimersByTime(Toast.DURATION_MS + 500);
    expect(document.querySelectorAll('.app-toast')).toHaveLength(0);
  });

  it('test_show_closeButton_removesToastImmediately', () => {
    Toast.show('Errore', 'error');
    document.querySelector('.app-toast__close').click();
    expect(document.querySelectorAll('.app-toast')).toHaveLength(0);
  });

  it('test_show_htmlInMessage_isRenderedAsText', () => {
    Toast.show('<img src=x onerror=alert(1)>', 'error');
    expect(document.querySelector('.app-toast img')).toBeNull();
    expect(document.querySelector('.app-toast').textContent).toContain('<img');
  });

  it('test_show_twoMessages_reusesSingleHost', () => {
    Toast.show('Uno', 'info');
    Toast.show('Due', 'info');
    expect(document.querySelectorAll('.app-toast-host')).toHaveLength(1);
    expect(document.querySelectorAll('.app-toast')).toHaveLength(2);
  });
});
