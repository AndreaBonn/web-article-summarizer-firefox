// history-detail.js — Modal dettaglio e funzioni di export

import { state } from './state.js';
import { getProviderLabel, getLanguageLabel } from '../../utils/core/display-labels.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { PDFExporter } from '../../utils/export/pdf-exporter.js';
import { MarkdownExporter } from '../../utils/export/markdown-exporter.js';
import { Modal } from '../../utils/core/modal.js';
import { getTranslationText } from '../../shared/translation-text.js';
import { showExportModal, computeExportAvailability } from '../../shared/export-modal.js';
import {
  renderDetailKeypointsHtml,
  renderTranslationHtml,
  renderQAHtml,
  renderCitationsHtml,
  buildDetailCopyText,
  prepareNotes,
} from './detail-render.js';

export async function openDetail(id) {
  state.currentEntry = await HistoryManager.getSummaryById(id);

  if (!state.currentEntry) {
    await Modal.error(I18n.t('history.summaryNotFound'));
    return;
  }

  // Populate modal
  document.getElementById('detailModalTitle').textContent = state.currentEntry.article.title;
  const uiLang = I18n.currentLanguage;
  document.getElementById('modalDate').textContent = new Date(
    state.currentEntry.timestamp,
  ).toLocaleString(uiLang === 'en' ? 'en-US' : 'it-IT');
  document.getElementById('modalProvider').textContent =
    `${I18n.t('controls.provider')}: ${getProviderLabel(state.currentEntry.metadata.provider)}`;
  document.getElementById('modalLanguage').textContent =
    `${I18n.t('controls.language')} ${getLanguageLabel(state.currentEntry.metadata.language, uiLang)}`;
  document.getElementById('modalStats').textContent =
    `${state.currentEntry.article.wordCount} ${I18n.t('article.words')} • ${state.currentEntry.article.readingTimeMinutes} ${I18n.t('article.readingTime')}`;

  // Summary
  document.getElementById('modalSummary').innerHTML =
    `<p>${HtmlSanitizer.escape(state.currentEntry.summary)}</p>`;

  // Key points
  document.getElementById('modalKeypoints').innerHTML = renderDetailKeypointsHtml(
    state.currentEntry.keyPoints,
  );

  // Translation (if available)
  document.getElementById('modalTranslation').innerHTML = renderTranslationHtml(
    state.currentEntry.translation,
  );

  // Q&A (if available)
  document.getElementById('modalQA').innerHTML = renderQAHtml(state.currentEntry.qa);

  // Citations (if available)
  document.getElementById('modalCitations').innerHTML = renderCitationsHtml(state.currentEntry);

  // Notes (always editable)
  const notesHtml = `
    <div class="notes-container">
      <textarea id="notesTextarea" class="notes-textarea" placeholder="${HtmlSanitizer.escape(I18n.t('history.notesPlaceholder'))}">${HtmlSanitizer.escape(state.currentEntry.notes || '')}</textarea>
      <button id="saveNotesBtn" class="btn btn-primary save-notes-btn">${HtmlSanitizer.escape(I18n.t('history.saveNotes'))}</button>
    </div>
  `;
  document.getElementById('modalNotes').innerHTML = notesHtml;

  // Add event listener for save notes
  document.getElementById('saveNotesBtn').addEventListener('click', async () => {
    const notesTextarea = document.getElementById('notesTextarea');
    const { textareaValue, notes } = prepareNotes(notesTextarea.value);
    if (notesTextarea.value.length > 10000) {
      notesTextarea.value = textareaValue;
    }
    await HistoryManager.updateSummaryNotes(state.currentEntry.id, notes);
    state.currentEntry.notes = notes;

    const btn = document.getElementById('saveNotesBtn');
    const originalText = btn.textContent;
    btn.textContent = '✓ Salvate!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  });

  // Show modal
  document.getElementById('detailModal').classList.remove('hidden');
}

export function closeModal() {
  // Stop TTS if playing
  if (state.voiceController) {
    state.voiceController.stopSpeaking();
  }

  document.getElementById('detailModal').classList.add('hidden');
  state.currentEntry = null;
}

export function switchModalTab(tabName) {
  document.querySelectorAll('.modal-tab').forEach((tab) => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });

  document.querySelectorAll('.modal-pane').forEach((pane) => {
    pane.classList.remove('active');
  });

  if (tabName === 'summary') {
    document.getElementById('modalSummary').classList.add('active');
  } else if (tabName === 'keypoints') {
    document.getElementById('modalKeypoints').classList.add('active');
  } else if (tabName === 'translation') {
    document.getElementById('modalTranslation').classList.add('active');
  } else if (tabName === 'qa') {
    document.getElementById('modalQA').classList.add('active');
  } else if (tabName === 'citations') {
    document.getElementById('modalCitations').classList.add('active');
  } else if (tabName === 'notes') {
    document.getElementById('modalNotes').classList.add('active');
  }
}

export function exportCurrentPdf() {
  if (!state.currentEntry) return;

  showExportModal({
    availability: _getEntryAvailability(),
    prefix: 'pdf',
    onConfirm: async (options) => {
      try {
        const translation =
          options.includeTranslation && state.currentEntry.translation
            ? getTranslationText(state.currentEntry.translation)
            : null;

        await PDFExporter.exportToPDF(
          state.currentEntry.article,
          options.includeSummary ? state.currentEntry.summary : null,
          options.includeKeypoints ? state.currentEntry.keyPoints : null,
          state.currentEntry.metadata,
          translation,
          options.includeQA ? state.currentEntry.qa : null,
          options.includeCitations ? state.currentEntry.citations : null,
        );
      } catch (error) {
        await Modal.error(I18n.t('history.exportPdfError') + ' ' + error.message);
      }
    },
  });
}

export function exportCurrentMarkdown() {
  if (!state.currentEntry) return;

  showExportModal({
    title: I18n.t('export.markdown'),
    resetTitle: I18n.t('export.pdf'),
    availability: _getEntryAvailability(),
    prefix: 'pdf',
    onConfirm: async (options) => {
      try {
        const translation =
          options.includeTranslation && state.currentEntry.translation
            ? getTranslationText(state.currentEntry.translation)
            : null;

        MarkdownExporter.exportToMarkdown(
          state.currentEntry.article,
          options.includeSummary ? state.currentEntry.summary : null,
          options.includeKeypoints ? state.currentEntry.keyPoints : null,
          state.currentEntry.metadata,
          translation,
          options.includeQA ? state.currentEntry.qa : null,
          state.currentEntry.notes || null,
          options.includeCitations ? state.currentEntry.citations : null,
        );
      } catch (error) {
        await Modal.error(I18n.t('history.exportMdError') + ' ' + error.message);
      }
    },
  });
}

function _getEntryAvailability() {
  return computeExportAvailability({
    translation: state.currentEntry.translation,
    qa: state.currentEntry.qa,
    citations: state.currentEntry.citations,
  });
}

export async function copyCurrentSummary() {
  if (!state.currentEntry) return;

  const text = buildDetailCopyText(state.currentEntry);

  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('copyModalBtn');
    const originalText = btn.textContent;
    btn.textContent = I18n.t('feedback.copied');
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  } catch {
    await Modal.error(I18n.t('history.copyError'));
  }
}

export async function deleteCurrentEntry() {
  if (!state.currentEntry) return;

  const confirmed = await Modal.confirm(
    I18n.t('history.confirmDelete'),
    I18n.t('history.deleteTitle'),
    '×',
  );

  if (!confirmed) return;

  await HistoryManager.deleteSummary(state.currentEntry.id);
  closeModal();
  await state.loadHistory();
}
