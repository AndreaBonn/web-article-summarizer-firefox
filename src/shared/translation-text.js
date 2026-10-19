/**
 * Text of a translation, whichever shape stores it: a plain string (reading mode)
 * or an object `{ text, targetLanguage, ... }` (history entries).
 * @param {string|{text?: string}|null|undefined} translation
 * @returns {string} The text, or '' when there is nothing usable
 */
export function getTranslationText(translation) {
  if (typeof translation === 'string') return translation;
  if (translation && typeof translation.text === 'string') return translation.text;
  return '';
}
