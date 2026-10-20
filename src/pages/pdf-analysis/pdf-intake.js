import { I18n } from '../../utils/i18n/i18n.js';

// PDF Analysis - validazione file e costruzione dei record (senza pdfjs-dist)

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * Messaggio d'errore se il file non è accettabile, altrimenti null.
 *
 * @param {{type: string, size: number}} file
 * @returns {string|null}
 */
export function validatePdfFile(file) {
  if (file.type !== 'application/pdf') {
    return I18n.t('pdf.invalidFile');
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return I18n.tf('pdf.fileTooLarge', { max: MAX_PDF_SIZE_BYTES / (1024 * 1024) });
  }
  return null;
}

/**
 * Argomenti `pdfInfo` e `metadata` per HistoryManager.savePDFAnalysis.
 * La struttura di `result` cambia se viene dalla cache o meno.
 *
 * @param {object} params
 * @param {{name: string, size: number}} params.file
 * @param {object} params.result
 * @param {string} params.provider
 * @param {{outputLanguage: string, summaryLength: string}} params.settings
 * @returns {{pdfInfo: object, metadata: object}}
 */
export function buildPdfHistoryRecord({ file, result, provider, settings }) {
  const pdfInfo = {
    name: file.name,
    size: file.size,
    pages: result.pageCount || result.pdfInfo?.pages || 0,
    text: result.extractedText || result.pdfInfo?.text || '',
    metadata: result.pdfInfo?.metadata || {},
  };

  const metadata = {
    provider: provider,
    language: settings.outputLanguage,
    summaryLength: settings.summaryLength,
    fromCache: result.isFromCache || result.fromCache || false,
  };

  return { pdfInfo, metadata };
}

/**
 * Dati per il reading mode: il file PDF (non serializzabile) viene rimosso.
 *
 * @param {object} analysisData
 * @param {number} now - timestamp
 * @returns {object}
 */
export function buildPdfReadingModeData(analysisData, now) {
  const dataToSave = {
    ...analysisData,
    timestamp: now,
  };

  delete dataToSave.pdfFile;
  return dataToSave;
}

const DEFAULT_PROVIDER = 'groq';

/**
 * Seleziona nel select il provider salvato (o il default se non e' tra le opzioni)
 * e ritorna l'etichetta dell'opzione selezionata.
 *
 * @param {HTMLSelectElement} select
 * @param {string|undefined} savedProvider
 * @returns {string}
 */
export function selectProvider(select, savedProvider) {
  const isKnown = Array.from(select.options).some((option) => option.value === savedProvider);
  select.value = isKnown ? savedProvider : DEFAULT_PROVIDER;
  return select.options[select.selectedIndex]?.text ?? '';
}
