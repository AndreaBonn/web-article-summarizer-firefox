// Reading Mode - Export Module
// Gestisce copia negli appunti ed esportazione PDF

import { state, elements } from './state.js';
import { PDFExporter } from '../../utils/export/pdf-exporter.js';
import { Logger } from '../../utils/core/logger.js';
import { buildReadingModeCopyText, buildPdfExportArgs } from './copy-text.js';

// Copy all content
export async function copyAll() {
  if (!state.currentData) return;

  const text = buildReadingModeCopyText(state.currentData);

  try {
    await navigator.clipboard.writeText(text);

    const originalText = elements.copyBtn.textContent;
    elements.copyBtn.textContent = '✓ Copiato!';
    setTimeout(() => {
      elements.copyBtn.textContent = originalText;
    }, 2000);
  } catch (error) {
    Logger.error('Copy error:', error);
    alert('Errore durante la copia');
  }
}

// Export to PDF
export async function exportToPDF() {
  if (!state.currentData) {
    alert('Nessun dato da esportare');
    return;
  }

  try {
    // Mostra loading
    const originalText = elements.exportBtn.textContent;
    elements.exportBtn.textContent = '⏳ Esportazione...';
    elements.exportBtn.disabled = true;

    const { summary, keyPoints } = state.currentData;
    const { articleData, metadataData } = buildPdfExportArgs(state.currentData);

    await PDFExporter.exportToPDF(
      articleData,
      summary,
      keyPoints,
      metadataData,
      state.currentData.translation,
      state.currentData.qa,
      state.currentData.citations,
    );

    // Successo
    elements.exportBtn.textContent = '✓ Esportato!';
    setTimeout(() => {
      elements.exportBtn.textContent = originalText;
      elements.exportBtn.disabled = false;
    }, 2000);
  } catch (error) {
    Logger.error('Export error:', error);
    alert("Errore durante l'esportazione PDF: " + error.message);
    elements.exportBtn.textContent = 'PDF';
    elements.exportBtn.disabled = false;
  }
}
