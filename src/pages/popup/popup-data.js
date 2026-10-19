// Pure helpers for the popup controller: no access to state, elements or browser APIs.

const QUOTA_ERROR_MESSAGE =
  'Impossibile aprire la modalità lettura: spazio di archiviazione insufficiente.';

export function buildReadingModeData({
  article,
  results,
  translation,
  citations,
  qa,
  providerValue,
  selectedLanguage,
  selectedContentType,
}) {
  return {
    article,
    summary: results.summary,
    keyPoints: results.keyPoints,
    translation: translation || null,
    citations: citations || null,
    qa: qa && qa.length > 0 ? qa : null,
    metadata: {
      provider: providerValue,
      language: selectedLanguage,
      contentType: results.detectedContentType || selectedContentType,
    },
  };
}

export function describeReadingModeStorageError(error) {
  const isQuotaError = error.message?.includes('QUOTA') || error.message?.includes('quota');
  return isQuotaError
    ? QUOTA_ERROR_MESSAGE
    : `Impossibile aprire la modalità lettura: ${error.message}`;
}
