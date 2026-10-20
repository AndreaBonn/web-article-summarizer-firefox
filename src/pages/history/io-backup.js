import {
  sanitizeMetadata,
  sanitizeArticleEntry,
  sanitizeMultiAnalysisEntry,
  sanitizePDFEntry,
  validateImportFile,
  parseBackup,
  selectNewEntries,
  buildBackupPayload,
  buildImportConfirmMessage,
} from './backup-rules.js';
// io-backup.js — Download and import history backup

import { Logger } from '@utils/core/logger.js';
import { state } from './state.js';
import { StorageManager } from '@utils/storage/storage-manager.js';
import { HistoryManager } from '@utils/storage/history-manager.js';
import { Modal } from '@utils/core/modal.js';
import { I18n } from '@utils/i18n/i18n.js';

/**
 * Scarica l'intera cronologia in formato JSON
 */
export async function downloadHistory() {
  try {
    // Mostra loading
    const btn = document.getElementById('downloadHistoryBtn');
    const originalText = btn.textContent;
    btn.textContent = I18n.t('backup.preparing');
    btn.disabled = true;

    // Ottieni tutta la cronologia
    const singleHistory = await HistoryManager.getHistory();
    const multiHistory = await HistoryManager.getMultiAnalysisHistory();
    const pdfHistory = await HistoryManager.getPDFHistory();

    // Ottieni anche le impostazioni e statistiche
    const settings = await StorageManager.getSettings();
    const statsResult = await browser.storage.local.get(['stats']);
    const stats = statsResult.stats || {};

    // Crea oggetto backup completo
    const backup = buildBackupPayload({
      singleHistory,
      multiHistory,
      pdfHistory,
      settings,
      stats,
      now: new Date(),
    });

    // Converti in JSON
    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Crea nome file con data
    const date = new Date().toISOString().split('T')[0];
    const filename = `ai-summarizer-backup-${date}.json`;

    // Scarica file
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Mostra successo
    btn.textContent = I18n.t('backup.downloaded');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);

    // Mostra statistiche
    await Modal.alert(
      I18n.tf('backup.downloadDone', {
        single: singleHistory.length,
        multi: multiHistory.length,
        pdf: pdfHistory.length,
        summaries: stats.totalSummaries || 0,
        words: (stats.totalWords || 0).toLocaleString(I18n.currentLanguage),
        filename,
      }),
      I18n.t('backup.downloadDoneTitle'),
      '✅',
    );
  } catch (error) {
    Logger.error('Errore download cronologia:', error);

    const btn = document.getElementById('downloadHistoryBtn');
    btn.textContent = I18n.t('backup.buttonError');
    btn.disabled = false;

    setTimeout(() => {
      btn.textContent = I18n.t('history.download');
    }, 2000);

    await Modal.error(
      I18n.t('backup.downloadError') + ' ' + error.message,
      I18n.t('backup.downloadErrorTitle'),
    );
  }
}

/**
 * Importa cronologia da file JSON
 */
export async function importHistory(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    validateImportFile(file);
    const text = await file.text();
    const backup = parseBackup(text);

    // Chiedi conferma
    const confirmed = await Modal.confirm(
      buildImportConfirmMessage(backup),
      I18n.t('backup.importConfirmTitle'),
      '📥',
    );

    if (!confirmed) {
      // Reset input
      event.target.value = '';
      return;
    }

    // Mostra loading
    const btn = document.getElementById('importHistoryBtn');
    const originalText = btn.textContent;
    btn.textContent = I18n.t('backup.importing');
    btn.disabled = true;

    // Importa articoli singoli
    let importedSingle = 0;
    if (backup.data.singleArticles && Array.isArray(backup.data.singleArticles)) {
      const currentHistory = await HistoryManager.getHistory();
      const currentIds = new Set(currentHistory.map((h) => h.id));

      for (const article of selectNewEntries(backup.data.singleArticles, currentIds)) {
        article.metadata = sanitizeMetadata(article.metadata);
        sanitizeArticleEntry(article);
        const storedId = await HistoryManager.importSummary(article);
        if (storedId === null) continue;
        importedSingle++;
      }
    }

    // Importa analisi multiple
    let importedMulti = 0;
    if (backup.data.multiAnalysis && Array.isArray(backup.data.multiAnalysis)) {
      const currentMulti = await HistoryManager.getMultiAnalysisHistory();
      const currentIds = new Set(currentMulti.map((h) => h.id));

      for (const analysis of selectNewEntries(backup.data.multiAnalysis, currentIds)) {
        sanitizeMultiAnalysisEntry(analysis);
        const storedId = await HistoryManager.importMultiAnalysis(analysis);
        if (storedId === null) continue;
        importedMulti++;
      }
    }

    // Importa analisi PDF
    let importedPDF = 0;
    if (Array.isArray(backup.data.pdfAnalysis)) {
      const currentPDF = await HistoryManager.getPDFHistory();
      const currentIds = new Set(currentPDF.map((h) => h.id));

      for (const pdfEntry of selectNewEntries(backup.data.pdfAnalysis, currentIds)) {
        sanitizePDFEntry(pdfEntry);
        const storedId = await HistoryManager.importPDFAnalysis(pdfEntry);
        if (storedId === null) continue;
        importedPDF++;
      }
    }

    // Ricarica cronologia
    await state.loadHistory();
    await state.loadMultiAnalysisHistory();
    await state.loadPDFHistory();

    // Ripristina bottone
    btn.textContent = I18n.t('backup.imported');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);

    // Mostra successo
    await Modal.alert(
      I18n.tf('backup.importDone', {
        single: importedSingle,
        multi: importedMulti,
        pdf: importedPDF,
      }),
      I18n.t('backup.importDoneTitle'),
      '✅',
    );
  } catch (error) {
    Logger.error('Errore importazione cronologia:', error);

    const btn = document.getElementById('importHistoryBtn');
    btn.textContent = I18n.t('backup.buttonError');
    btn.disabled = false;

    setTimeout(() => {
      btn.textContent = I18n.t('history.import');
    }, 2000);

    await Modal.error(
      I18n.tf('backup.importError', { message: error.message }),
      I18n.t('backup.importErrorTitle'),
    );
  } finally {
    // Reset input
    event.target.value = '';
  }
}
