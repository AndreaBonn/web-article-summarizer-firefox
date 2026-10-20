// Reading Mode - Export Module
// Gestisce copia negli appunti ed esportazione PDF

import { state, elements } from './state.js';
import { PDFExporter } from '../../utils/export/pdf-exporter.js';
import { Logger } from '../../utils/core/logger.js';
import { getTranslationText } from '../../shared/translation-text.js';
import { buildReadingModeCopyText, buildPdfExportArgs } from './copy-text.js';
import { I18n } from '../../utils/i18n/i18n.js';

// Copy all content
export async function copyAll() {
  if (!state.currentData) return;

  const text = buildReadingModeCopyText(state.currentData);

  try {
    await navigator.clipboard.writeText(text);

    const originalText = elements.copyBtn.textContent;
    elements.copyBtn.textContent = I18n.t('feedback.copied');
    setTimeout(() => {
      elements.copyBtn.textContent = originalText;
    }, 2000);
  } catch (error) {
    Logger.error('Copy error:', error);
    alert(I18n.t('history.copyError'));
  }
}

// Export to PDF
export async function exportToPDF() {
  if (!state.currentData) {
    alert(I18n.t('reading.noDataToExport'));
    return;
  }

  try {
    // Mostra loading
    const originalText = elements.exportBtn.textContent;
    elements.exportBtn.textContent = I18n.t('reading.exporting');
    elements.exportBtn.disabled = true;

    const { summary, keyPoints } = state.currentData;
    const { articleData, metadataData } = buildPdfExportArgs(state.currentData);

    await PDFExporter.exportToPDF(
      articleData,
      summary,
      keyPoints,
      metadataData,
      getTranslationText(state.currentData.translation) || null,
      state.currentData.qa,
      state.currentData.citations,
    );

    // Successo
    elements.exportBtn.textContent = I18n.t('feedback.exported');
    setTimeout(() => {
      elements.exportBtn.textContent = originalText;
      elements.exportBtn.disabled = false;
    }, 2000);
  } catch (error) {
    Logger.error('Export error:', error);
    alert(I18n.t('popup.exportPdfError') + ' ' + error.message);
    elements.exportBtn.textContent = 'PDF';
    elements.exportBtn.disabled = false;
  }
}
