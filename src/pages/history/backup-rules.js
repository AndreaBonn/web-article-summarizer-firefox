const VALID_PROVIDERS = ['groq', 'openai', 'anthropic', 'gemini'];
const VALID_CONTENT_TYPES = ['general', 'scientific', 'news', 'technical', 'opinion'];

export const sanitizeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return { provider: 'groq', language: 'it' };
  return {
    ...metadata,
    provider: VALID_PROVIDERS.includes(metadata.provider) ? metadata.provider : 'groq',
    contentType: VALID_CONTENT_TYPES.includes(metadata.contentType)
      ? metadata.contentType
      : undefined,
    language:
      typeof metadata.language === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(metadata.language)
        ? metadata.language
        : 'it',
  };
};

// Sanitize text fields to prevent stored XSS via malicious backup
export const sanitizeTextField = (val, maxLen = 50000) => {
  if (typeof val !== 'string') return typeof val === 'undefined' ? undefined : '';
  return val.substring(0, maxLen);
};

/** Mutates the freshly parsed backup entry in place. */
export const sanitizeArticleEntry = (entry) => {
  if (entry.article && typeof entry.article === 'object') {
    entry.article.title = sanitizeTextField(entry.article.title, 500);
    entry.article.content = sanitizeTextField(entry.article.content, 100000);
    entry.article.excerpt = sanitizeTextField(entry.article.excerpt, 1000);
  }
  entry.summary = sanitizeTextField(entry.summary, 50000);
  if (entry.translation && typeof entry.translation === 'object') {
    entry.translation.text = sanitizeTextField(entry.translation.text, 100000);
  } else if (typeof entry.translation === 'string') {
    entry.translation = sanitizeTextField(entry.translation, 100000);
  }
  entry.notes = sanitizeTextField(entry.notes, 10000);
};

/** Mutates the freshly parsed backup entry in place. */
export const sanitizeMultiAnalysisEntry = (entry) => {
  if (entry.analysis && typeof entry.analysis === 'object') {
    entry.analysis.globalSummary = sanitizeTextField(entry.analysis.globalSummary, 100000);
    entry.analysis.comparison = sanitizeTextField(entry.analysis.comparison, 100000);
  }
};

export function validateImportFile(file) {
  // Validate file type
  if (file.type && !['application/json', 'text/json', ''].includes(file.type)) {
    if (!file.name.endsWith('.json')) {
      throw new Error('Formato file non valido. Seleziona un file .json');
    }
  }

  // Leggi file con limite di dimensione (10 MB)
  const MAX_IMPORT_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_IMPORT_SIZE) {
    throw new Error('File troppo grande (max 10 MB)');
  }
}

export function parseBackup(text) {
  const backup = JSON.parse(text);

  // Valida struttura del backup
  if (
    !backup ||
    !backup.version ||
    typeof backup.version !== 'string' ||
    !backup.data ||
    typeof backup.data !== 'object' ||
    Array.isArray(backup.data)
  ) {
    throw new Error('File di backup non valido');
  }

  // Valida che contenga almeno una delle chiavi attese
  const hasArticles = backup.data.singleArticles && Array.isArray(backup.data.singleArticles);
  const hasMulti = backup.data.multiAnalysis && Array.isArray(backup.data.multiAnalysis);
  if (!hasArticles && !hasMulti) {
    throw new Error('Il backup non contiene dati importabili');
  }

  return backup;
}

export function buildBackupPayload({ singleHistory, multiHistory, settings, stats, now }) {
  return {
    version: '1.0.0',
    exportDate: now.toISOString(),
    exportTimestamp: now.getTime(),
    data: {
      singleArticles: singleHistory,
      multiAnalysis: multiHistory,
      settings: settings,
      stats: stats,
    },
    metadata: {
      totalSingleArticles: singleHistory.length,
      totalMultiAnalysis: multiHistory.length,
      totalSummaries: stats.totalSummaries || 0,
      totalWords: stats.totalWords || 0,
    },
  };
}

export function buildImportConfirmMessage(backup) {
  return (
    `Vuoi importare questo backup?\n\n` +
    `📅 Data backup:\n${new Date(backup.exportDate).toLocaleString('it-IT')}\n\n` +
    `📄 Articoli singoli: ${backup.metadata?.totalSingleArticles ?? backup.data?.singleArticles?.length ?? 0}\n` +
    `🔬 Analisi multiple: ${backup.metadata?.totalMultiAnalysis ?? backup.data?.multiAnalysis?.length ?? 0}\n\n` +
    `⚠️ ATTENZIONE:\n` +
    `Questo AGGIUNGERÀ i dati al tuo storico\n` +
    `esistente (non li sostituirà).`
  );
}

export function selectNewEntries(entries, currentIds) {
  return entries.filter((entry) => !currentIds.has(entry.id));
}
