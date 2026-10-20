// Language Names — single source of truth for language code → display name mapping

// Native names (for AI prompts that need the target language's own name)
export const LANGUAGE_NAMES = {
  it: 'Italiano',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

// Italian names (for UI display in Italian context)
export const LANGUAGE_NAMES_IT = {
  it: 'Italiano',
  en: 'Inglese',
  es: 'Spagnolo',
  fr: 'Francese',
  de: 'Tedesco',
};

export function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || code;
}

/**
 * Lowercase Italian name — for AI system prompts (e.g. "Rispondi in italiano")
 */
export function getLanguageNameForPrompt(code) {
  return (LANGUAGE_NAMES_IT[code] || code).toLowerCase();
}
