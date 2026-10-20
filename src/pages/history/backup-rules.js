const VALID_PROVIDERS = ['groq', 'openai', 'anthropic', 'gemini'];
const VALID_CONTENT_TYPES = ['general', 'scientific', 'news', 'technical', 'opinion'];
// Backups include the full text extracted from each PDF, which can run to megabytes
const MAX_IMPORT_SIZE_MB = 50;
const MAX_PDF_TEXT_LENGTH = 2000000;

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
export const sanitizePDFEntry = (entry) => {
  if (entry.pdf && typeof entry.pdf === 'object') {
    entry.pdf.name = sanitizeTextField(entry.pdf.name, 500);
    entry.pdf.text = sanitizeTextField(entry.pdf.text, MAX_PDF_TEXT_LENGTH);
    entry.pdf.size = Number.isFinite(entry.pdf.size) ? entry.pdf.size : 0;
    entry.pdf.pages = Number.isFinite(entry.pdf.pages) ? entry.pdf.pages : 0;
  } else {
    entry.pdf = { name: '', text: '', size: 0, pages: 0 };
  }
  entry.metadata = sanitizeMetadata(entry.metadata);
  // The history card reads summary and keyPoints[].title unguarded: a malformed entry would
  // break the whole PDF list, and as a favorite it would survive "clear history"
  entry.summary = sanitizeTextField(entry.summary, 50000) ?? '';
  entry.keyPoints = Array.isArray(entry.keyPoints)
    ? entry.keyPoints.filter((kp) => kp && typeof kp.title === 'string')
    : [];
  entry.qa = Array.isArray(entry.qa) ? entry.qa : null;
  entry.citations =
    entry.citations && typeof entry.citations === 'object' && !Array.isArray(entry.citations)
      ? entry.citations
      : null;
  if (entry.translation && typeof entry.translation === 'object') {
    entry.translation.text = sanitizeTextField(entry.translation.text, MAX_PDF_TEXT_LENGTH);
  } else if (typeof entry.translation === 'string') {
    entry.translation = sanitizeTextField(entry.translation, MAX_PDF_TEXT_LENGTH);
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

  if (file.size > MAX_IMPORT_SIZE_MB * 1024 * 1024) {
    throw new Error(`File troppo grande (max ${MAX_IMPORT_SIZE_MB} MB)`);
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
  const hasPDF = Array.isArray(backup.data.pdfAnalysis);
  if (!hasArticles && !hasMulti && !hasPDF) {
    throw new Error('Il backup non contiene dati importabili');
  }

  return backup;
}

export function buildBackupPayload({
  singleHistory,
  multiHistory,
  pdfHistory = [],
  settings,
  stats,
  now,
}) {
  return {
    version: '1.0.0',
    exportDate: now.toISOString(),
    exportTimestamp: now.getTime(),
    data: {
      singleArticles: singleHistory,
      multiAnalysis: multiHistory,
      pdfAnalysis: pdfHistory,
      settings: settings,
      stats: stats,
    },
    metadata: {
      totalSingleArticles: singleHistory.length,
      totalMultiAnalysis: multiHistory.length,
      totalPDFAnalysis: pdfHistory.length,
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
    `🔬 Analisi multiple: ${backup.metadata?.totalMultiAnalysis ?? backup.data?.multiAnalysis?.length ?? 0}\n` +
    `📑 Analisi PDF: ${backup.metadata?.totalPDFAnalysis ?? backup.data?.pdfAnalysis?.length ?? 0}\n\n` +
    `⚠️ ATTENZIONE:\n` +
    `Questo AGGIUNGERÀ i dati al tuo storico\n` +
    `esistente (non li sostituirà).`
  );
}

export function selectNewEntries(entries, currentIds) {
  return entries.filter((entry) => entry && typeof entry === 'object' && !currentIds.has(entry.id));
}
