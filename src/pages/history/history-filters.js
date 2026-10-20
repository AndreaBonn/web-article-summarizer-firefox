import { I18n } from '../../utils/i18n/i18n.js';

export function buildFilterCriteria({ provider, language, contentType }) {
  const filters = {};
  if (provider) filters.provider = provider;
  if (language) filters.language = language;
  if (contentType) filters.contentType = contentType;
  return filters;
}

export function applyFlagFilter(entries, favoriteFilter) {
  if (favoriteFilter === 'favorites') {
    return entries.filter((entry) => entry.favorite === true);
  } else if (favoriteFilter === 'withNotes') {
    return entries.filter((entry) => entry.notes && entry.notes.trim().length > 0);
  }
  return entries;
}

const CLEAR_COPY = {
  single: {
    message: 'history.confirmClearSingle',
    favorites: 'history.favoritesNotDeleted',
    title: 'history.clearSingleTitle',
  },
  pdf: {
    message: 'history.confirmClearPdf',
    favorites: 'history.favoritesNotDeletedPdf',
    title: 'history.clearPdfTitle',
  },
  multi: {
    message: 'history.confirmClearMulti',
    favorites: 'history.favoritesNotDeletedMulti',
    title: 'history.clearMultiTitle',
  },
};

export function buildClearConfirmMessage(kind, favoritesCount) {
  const copy = CLEAR_COPY[kind];
  let message = I18n.t(copy.message);
  if (favoritesCount > 0) {
    message += '\n\n' + I18n.tf(copy.favorites, { count: favoritesCount });
  }
  message += '\n\n' + I18n.t('history.actionCannotUndo');
  return { message, title: I18n.t(copy.title) };
}
