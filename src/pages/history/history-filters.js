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
    message: 'Sei sicuro di voler cancellare tutta la cronologia degli articoli singoli?',
    favorites: 'articoli preferiti NON verranno eliminati.',
    title: 'Cancella Articoli Singoli',
  },
  pdf: {
    message: 'Sei sicuro di voler cancellare tutta la cronologia dei PDF analizzati?',
    favorites: 'PDF preferiti NON verranno eliminati.',
    title: 'Elimina Cronologia PDF',
  },
  multi: {
    message: 'Sei sicuro di voler cancellare tutta la cronologia delle analisi Multi Articolo?',
    favorites: 'analisi preferite NON verranno eliminate.',
    title: 'Cancella Analisi Multiple',
  },
};

export function buildClearConfirmMessage(kind, favoritesCount) {
  const copy = CLEAR_COPY[kind];
  let message = copy.message;
  if (favoritesCount > 0) {
    message += `\n\n⭐ ${favoritesCount} ${copy.favorites}`;
  }
  message += '\n\nQuesta azione non può essere annullata.';
  return { message, title: copy.title };
}
