// i18n.js - Sistema di internazionalizzazione
// Versione 3.0 - Traduzioni caricate da file JSON in locales/
import { StorageManager } from '../storage/storage-manager.js';
import itTranslations from './locales/it.json';
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';
import frTranslations from './locales/fr.json';
import deTranslations from './locales/de.json';

export const I18n = {
  currentLanguage: 'it',

  translations: {
    it: itTranslations,
    en: enTranslations,
    es: esTranslations,
    fr: frTranslations,
    de: deTranslations,
  },

  // Inizializza la lingua
  async init() {
    const lang = await StorageManager.getUILanguage();
    if (lang) {
      this.currentLanguage = lang;
    }
    this.updateUI();
  },

  // Inizializzazione completa per una pagina: init + carica lingua UI + event listener
  async initPage() {
    await this.init();
    const savedUILanguage = await StorageManager.getUILanguage();
    const uiLanguageSelect = document.getElementById('uiLanguageSelect');
    if (savedUILanguage && uiLanguageSelect) {
      uiLanguageSelect.value = savedUILanguage;
    }
    if (uiLanguageSelect) {
      uiLanguageSelect.addEventListener('change', async (e) => {
        await this.setLanguage(e.target.value);
      });
    }
  },

  // Cambia lingua
  async setLanguage(lang) {
    if (this.translations[lang]) {
      this.currentLanguage = lang;
      await StorageManager.saveUILanguage(lang);
      this.updateUI();
    }
  },

  // Ottieni traduzione
  t(key) {
    const translation = this.translations[this.currentLanguage]?.[key];
    return translation || key;
  },

  // Ottieni traduzione con sostituzione placeholder
  tf(key, replacements = {}) {
    let translation = this.t(key);
    Object.keys(replacements).forEach((placeholder) => {
      translation = translation.replaceAll(`{${placeholder}}`, () =>
        String(replacements[placeholder]),
      );
    });
    return translation;
  },

  // Aggiorna tutti gli elementi con data-i18n
  updateUI() {
    // Aggiorna elementi con data-i18n (testo)
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      const translation = this.t(key);

      // Gestisci placeholder per input
      if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
        element.setAttribute('placeholder', translation);
      }
      // Gestisci option in select
      else if (element.tagName === 'OPTION') {
        element.textContent = translation;
      }
      // Gestisci altri elementi
      else {
        element.textContent = translation;
      }
    });

    // Aggiorna elementi con data-i18n-title (attributo title)
    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
      const key = element.getAttribute('data-i18n-title');
      const translation = this.t(key);
      element.setAttribute('title', translation);
    });

    // Aggiorna anche il titolo della pagina se presente
    const titleElement = document.querySelector('title');
    const titleKey = titleElement?.getAttribute('data-i18n');
    if (titleKey) {
      document.title = this.t(titleKey);
    }
  },

  // Ottieni tutte le lingue disponibili
  getAvailableLanguages() {
    return [
      { code: 'it', name: 'Italiano', flag: '🇮🇹' },
      { code: 'en', name: 'English', flag: '🇺🇸' },
      // ES, FR, DE disponibili ma non ancora tradotte al 100%
      // { code: 'es', name: 'Español', flag: '🇪🇸' },
      // { code: 'fr', name: 'Français', flag: '🇫🇷' },
      // { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
    ];
  },
};
