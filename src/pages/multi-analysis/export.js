import { PDFExporter } from '../../utils/export/pdf-exporter.js';
import { MarkdownExporter } from '../../utils/export/markdown-exporter.js';
import { EmailManager } from '../../utils/export/email-manager.js';
import { Modal } from '../../utils/core/modal.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { state } from './state.js';
import { resolveSelectedArticles } from './analysis-model.js';
import { buildMultiAnalysisEmailContent, buildMultiAnalysisCopyText } from './export-text.js';
import { Logger } from '../../utils/core/logger.js';

export async function exportPdf() {
  if (!state.currentAnalysis) return;

  try {
    const options = await showExportOptionsModal('PDF');
    if (!options) return;

    await PDFExporter.exportMultiAnalysisToPDF(
      state.currentAnalysis,
      resolveSelectedArticles(state.selectedArticles, state.allArticles),
      options,
    );
  } catch (error) {
    Logger.error('Errore PDF:', error);
    await Modal.alert(
      I18n.t('multi.exportError', { type: 'PDF' }) + error.message,
      I18n.t('multi.errorTitle'),
      '❌',
    );
  }
}

export async function exportMarkdown() {
  if (!state.currentAnalysis) return;

  try {
    const options = await showExportOptionsModal('Markdown');
    if (!options) return;

    MarkdownExporter.exportMultiAnalysisToMarkdown(
      state.currentAnalysis,
      resolveSelectedArticles(state.selectedArticles, state.allArticles),
      options,
    );
  } catch (error) {
    Logger.error('Errore Markdown:', error);
    await Modal.alert(
      I18n.t('multi.exportError', { type: 'Markdown' }) + error.message,
      I18n.t('multi.errorTitle'),
      '❌',
    );
  }
}

export async function sendEmail() {
  if (!state.currentAnalysis) return;

  try {
    const options = await showExportOptionsModal('Email');
    if (!options) return;

    const content = buildMultiAnalysisEmailContent({
      analysis: state.currentAnalysis,
      selectedIds: state.selectedArticles,
      allArticles: state.allArticles,
      options,
      dateLocale: 'it-IT',
    });

    await EmailManager.showEmailModal(content, 'Analisi Multi Articolo');
  } catch (error) {
    Logger.error('Errore email:', error);
    await Modal.alert(
      I18n.t('multi.exportError', { type: 'Email' }) + error.message,
      I18n.t('multi.errorTitle'),
      '❌',
    );
  }
}

export async function copyContent() {
  if (!state.currentAnalysis) return;

  let qaMessageTexts = [];
  if (state.currentAnalysis.qa && state.currentAnalysis.qa.interactive) {
    const chatContainer = document.getElementById('qaChatContainer');
    if (chatContainer) {
      const messages = chatContainer.querySelectorAll(
        '.qa-message:not(.qa-loading):not(.qa-welcome)',
      );
      qaMessageTexts = Array.from(messages, (msg) => msg.textContent);
    }
  }
  const text = buildMultiAnalysisCopyText(state.currentAnalysis, qaMessageTexts);

  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('copyBtn');
    const originalText = btn.textContent;
    btn.textContent = '✓ Copiato!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  } catch {
    await Modal.alert(I18n.t('multi.copyError'), I18n.t('multi.errorTitle'), '❌');
  }
}

export function showExportOptionsModal(type) {
  return new Promise((resolve) => {
    const modal = document.getElementById('exportOptionsModal');
    const title = document.getElementById('exportModalTitle');
    const summaryOption = document.getElementById('exportSummaryOption');
    const comparisonOption = document.getElementById('exportComparisonOption');
    const qaOption = document.getElementById('exportQAOption');
    const cancelBtn = document.getElementById('exportCancelBtn');
    const confirmBtn = document.getElementById('exportConfirmBtn');

    title.textContent = `Esporta ${type}`;

    summaryOption.style.display = state.currentAnalysis.summary ? 'flex' : 'none';
    comparisonOption.style.display = state.currentAnalysis.comparison ? 'flex' : 'none';
    qaOption.style.display = state.currentAnalysis.qa ? 'flex' : 'none';

    modal.classList.remove('hidden');

    const handleConfirm = () => {
      const options = {
        includeSummary: document.getElementById('exportIncludeSummary').checked,
        includeComparison: document.getElementById('exportIncludeComparison').checked,
        includeQA: document.getElementById('exportIncludeQA').checked,
      };
      cleanup();
      resolve(options);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    const cleanup = () => {
      modal.classList.add('hidden');
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}
