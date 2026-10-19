import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.spyOn(console, 'error').mockImplementation(() => {});

vi.mock('@utils/storage/storage-manager.js', () => ({
  StorageManager: {
    getSettings: vi.fn().mockResolvedValue({ darkMode: false }),
    saveSettings: vi.fn().mockResolvedValue(undefined),
  },
}));

// Prevent auto-init side effects
const originalReadyState = Object.getOwnPropertyDescriptor(Document.prototype, 'readyState');

import { ThemeManager } from '@utils/core/theme-manager.js';
import { StorageManager } from '@utils/storage/storage-manager.js';

describe('ThemeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.classList.remove('dark-mode');
    document.body.innerHTML = '';
  });

  describe('applyTheme()', () => {
    it('test_applyTheme_true_addsDarkModeClass', () => {
      ThemeManager.applyTheme(true);
      expect(document.body.classList.contains('dark-mode')).toBe(true);
    });

    it('test_applyTheme_false_removesDarkModeClass', () => {
      document.body.classList.add('dark-mode');
      ThemeManager.applyTheme(false);
      expect(document.body.classList.contains('dark-mode')).toBe(false);
    });

    it('test_applyTheme_true_updatesButtonIcon', () => {
      document.body.innerHTML = '<button id="themeToggleBtn"></button>';
      ThemeManager.applyTheme(true);

      const btn = document.getElementById('themeToggleBtn');
      const svg = btn.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg.dataset.icon).toBe('sun');
      expect(btn.textContent).not.toContain('◐');
      expect(btn.title).toBe('Tema chiaro');
      expect(btn.getAttribute('aria-label')).toBe('Tema chiaro');
    });

    it('test_applyTheme_false_updatesButtonIcon', () => {
      document.body.innerHTML = '<button id="themeToggleBtn"></button>';
      ThemeManager.applyTheme(false);

      const btn = document.getElementById('themeToggleBtn');
      const svg = btn.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg.dataset.icon).toBe('moon');
      expect(btn.textContent).not.toContain('◑');
      expect(btn.title).toBe('Tema scuro');
      expect(btn.getAttribute('aria-label')).toBe('Tema scuro');
    });

    it('test_applyTheme_dataThemeToggleButton_alsoGetsIcon', () => {
      document.body.innerHTML = '<button data-theme-toggle></button>';
      ThemeManager.applyTheme(false);
      expect(document.querySelector('[data-theme-toggle] svg')).not.toBeNull();
    });

    it('test_applyTheme_noButton_noError', () => {
      expect(() => ThemeManager.applyTheme(true)).not.toThrow();
    });
  });

  describe('init()', () => {
    it('test_init_darkModeEnabled_appliesDark', async () => {
      StorageManager.getSettings.mockResolvedValue({ darkMode: true });
      await ThemeManager.init();
      expect(document.body.classList.contains('dark-mode')).toBe(true);
    });

    it('test_init_darkModeDisabled_appliesLight', async () => {
      StorageManager.getSettings.mockResolvedValue({ darkMode: false });
      await ThemeManager.init();
      expect(document.body.classList.contains('dark-mode')).toBe(false);
    });

    it('test_init_error_doesNotThrow', async () => {
      StorageManager.getSettings.mockRejectedValue(new Error('fail'));
      await expect(ThemeManager.init()).resolves.not.toThrow();
    });
  });

  describe('toggle()', () => {
    it('test_toggle_fromLight_switchesToDark', async () => {
      StorageManager.getSettings.mockResolvedValue({ darkMode: false });
      const result = await ThemeManager.toggle();

      expect(result).toBe(true);
      expect(document.body.classList.contains('dark-mode')).toBe(true);
      expect(StorageManager.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ darkMode: true })
      );
    });

    it('test_toggle_fromDark_switchesToLight', async () => {
      StorageManager.getSettings.mockResolvedValue({ darkMode: true });
      const result = await ThemeManager.toggle();

      expect(result).toBe(false);
      expect(document.body.classList.contains('dark-mode')).toBe(false);
    });
  });
});
