import { I18n } from '../utils/i18n/i18n.js';

// Same fallback as StorageManager.getUILanguage
const DEFAULT_LANGUAGE = 'it';

// The worker maps provider errors to user-facing text: it has to speak the language the
// user picked in the options page, which pages apply through I18n.init()
function useLanguage(language) {
  if (typeof language === 'string' && I18n.translations[language]) {
    I18n.currentLanguage = language;
  }
}

export async function applyStoredUiLanguage(storage = browser.storage.local) {
  const { uiLanguage } = await storage.get(['uiLanguage']);
  useLanguage(uiLanguage);
}

export function watchUiLanguage(onChanged = browser.storage.onChanged) {
  onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.uiLanguage) {
      useLanguage(changes.uiLanguage.newValue ?? DEFAULT_LANGUAGE);
    }
  });
}
