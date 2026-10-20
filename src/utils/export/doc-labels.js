import { I18n } from '../i18n/i18n.js';

/** Label for exported documents (Markdown, PDF, email, clipboard) in the interface language. */
export function docLabel(key, vars) {
  return I18n.tf(`doc.${key}`, vars);
}

/** The same label in capitals, as the plain-text and PDF exports title their sections. */
export function docHeading(key, vars) {
  return docLabel(key, vars).toLocaleUpperCase(I18n.currentLanguage);
}

export function docDate(date) {
  return date.toLocaleDateString(I18n.currentLanguage);
}

export function citationTypeLabel(type) {
  const key = `citationType.${type}`;
  const label = I18n.t(key);
  return label === key ? I18n.t('citationType.other') : label;
}
