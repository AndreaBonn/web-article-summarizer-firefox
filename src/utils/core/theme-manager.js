// Theme Manager - Gestione Dark Mode centralizzata per tutte le pagine
import { StorageManager } from '../storage/storage-manager.js';
import { Logger } from './logger.js';
import { I18n } from '../i18n/i18n.js';

const SVG_ATTRS =
  'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const MOON_ICON = `<svg data-icon="moon" ${SVG_ATTRS}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const SUN_ICON = `<svg data-icon="sun" ${SVG_ATTRS}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

export const ThemeManager = {
  async init() {
    try {
      const settings = await StorageManager.getSettings();
      this.applyTheme(settings.darkMode || false);
    } catch (error) {
      Logger.error('Errore caricamento tema:', error);
    }
  },

  applyTheme(isDark) {
    if (isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    this._updateIcon(isDark);
  },

  async toggle() {
    const settings = await StorageManager.getSettings();
    const newDarkMode = !settings.darkMode;

    settings.darkMode = newDarkMode;
    await StorageManager.saveSettings(settings);

    this.applyTheme(newDarkMode);
    return newDarkMode;
  },

  _updateIcon(isDark) {
    const buttons = document.querySelectorAll('#themeToggleBtn, [data-theme-toggle]');
    buttons.forEach((btn) => {
      // Dark theme active: offer the sun (back to light), and vice versa.
      btn.innerHTML = isDark ? SUN_ICON : MOON_ICON;
      const label = I18n.t(isDark ? 'theme.light' : 'theme.dark');
      btn.title = label;
      btn.setAttribute('aria-label', label);
    });
  },
};

// Auto-inizializza quando il DOM è pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
} else {
  ThemeManager.init();
}
