// history-detail.js — Modal dettaglio e funzioni di export

import { state } from './state.js';
import { getProviderLabel, getLanguageLabel } from '../../utils/core/display-labels.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { CitationExtractor } from '../../utils/ai/citation-extractor.js';
import { PDFExporter } from '../../utils/export/pdf-exporter.js';
import { MarkdownExporter } from '../../utils/export/markdown-exporter.js';
import { Modal } from '../../utils/core/modal.js';
import { showExportModal, computeExportAvailability } from '../../shared/export-modal.js';
import { formatSummaryWithKeyPointsText } from '../../shared/export-formatters.js';

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
  const keypointsHtml = state.currentEntry.keyPoints
    .map(
      (point, index) => `
    <div class="keypoint-modal">
      <div class="keypoint-modal-title">${index + 1}. ${HtmlSanitizer.escape(point.title)}</div>
      <div class="keypoint-modal-ref">§${HtmlSanitizer.escape(String(point.paragraphs))}</div>
      <div class="keypoint-modal-desc">${HtmlSanitizer.escape(point.description)}</div>
    </div>
  `,
    )
    .join('');
  document.getElementById('modalKeypoints').innerHTML = keypointsHtml;

  // Translation (if available)
  if (state.currentEntry.translation) {
    document.getElementById('modalTranslation').innerHTML = `
      <div class="translation-info-modal">
        Tradotto da ${HtmlSanitizer.escape(state.currentEntry.translation.originalLanguage)} a ${HtmlSanitizer.escape(state.currentEntry.translation.targetLanguage)}
      </div>
      <div class="translation-text">${HtmlSanitizer.escape(state.currentEntry.translation.text)}</div>
    `;
  } else {
    document.getElementById('modalTranslation').innerHTML = `
      <p class="modal-empty-state">
        Nessuna traduzione disponibile per questo riassunto
      </p>
    `;
  }

  // Q&A (if available)
  if (state.currentEntry.qa && state.currentEntry.qa.length > 0) {
    let qaHtml = '';
    state.currentEntry.qa.forEach((qa, index) => {
      qaHtml += `
        <div class="qa-item">
          <div class="qa-question">
            <strong>Q${index + 1}:</strong> ${HtmlSanitizer.escape(qa.question)}
          </div>
          <div class="qa-answer">
            <strong>R${index + 1}:</strong> ${HtmlSanitizer.escape(qa.answer)}
          </div>
        </div>
      `;
    });
    document.getElementById('modalQA').innerHTML = qaHtml;
  } else {
    document.getElementById('modalQA').innerHTML = `
      <p class="modal-empty-state">
        Nessuna domanda e risposta disponibile per questo riassunto
      </p>
    `;
  }

  // Citations (if available)
  if (
    state.currentEntry.citations &&
    state.currentEntry.citations.citations &&
    state.currentEntry.citations.citations.length > 0
  ) {
    let citationsHtml = `
      <div class="citations-info">
        <strong>${state.currentEntry.citations.total_citations || state.currentEntry.citations.citations.length} citazioni trovate</strong>
      </div>

      <div class="article-citation-box-detail">
        <h4>Citazione Articolo Principale (APA)</h4>
        <div class="article-citation-monospace">
          ${CitationExtractor.formatCitation(state.currentEntry.article, 'apa')}
        </div>
      </div>

      <div class="citations-list-detail">
    `;

    state.currentEntry.citations.citations.forEach((citation) => {
      const typeIcon =
        {
          direct_quote: '›',
          reference: '§',
          statistic: '#',
          source: '→',
        }[citation.type] || '•';

      citationsHtml += `
        <div class="citation-item-detail">
          <div class="citation-item-header">
            <span class="citation-type-icon">${typeIcon}</span>
            <span class="citation-id-badge">#${HtmlSanitizer.escape(String(citation.id))}</span>
            ${citation.author ? `<span class="citation-author">${HtmlSanitizer.escape(citation.author)}</span>` : ''}
          </div>
          ${citation.text ? `<div class="citation-quote-text">"${HtmlSanitizer.escape(citation.text)}"</div>` : ''}
          <div class="citation-context-text">${HtmlSanitizer.escape(citation.context)}</div>
        </div>
      `;
    });

    citationsHtml += `</div>`;
    document.getElementById('modalCitations').innerHTML = citationsHtml;
  } else {
    document.getElementById('modalCitations').innerHTML = `
      <p class="modal-empty-state">
        Nessuna citazione disponibile per questo riassunto
      </p>
    `;
  }

  // Notes (always editable)
  const notesHtml = `
    <div class="notes-container">
      <textarea id="notesTextarea" class="notes-textarea" placeholder="Aggiungi note personali su questo articolo...">${HtmlSanitizer.escape(state.currentEntry.notes || '')}</textarea>
      <button id="saveNotesBtn" class="btn btn-primary save-notes-btn">Salva Note</button>
    </div>
  `;
  document.getElementById('modalNotes').innerHTML = notesHtml;

  // Add event listener for save notes
  document.getElementById('saveNotesBtn').addEventListener('click', async () => {
    const notesTextarea = document.getElementById('notesTextarea');
    if (notesTextarea.value.length > 10000) {
      notesTextarea.value = notesTextarea.value.substring(0, 10000);
    }
    const notes = notesTextarea.value.trim();
    await HistoryManager.updateSummaryNotes(state.currentEntry.id, notes || null);
    state.currentEntry.notes = notes || null;

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
            ? state.currentEntry.translation.text
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
        await Modal.error("Errore durante l'esportazione PDF: " + error.message);
      }
    },
  });
}

export function exportCurrentMarkdown() {
  if (!state.currentEntry) return;

  showExportModal({
    title: 'Esporta Markdown',
    resetTitle: 'Esporta PDF',
    availability: _getEntryAvailability(),
    prefix: 'pdf',
    onConfirm: async (options) => {
      try {
        const translation =
          options.includeTranslation && state.currentEntry.translation
            ? state.currentEntry.translation.text
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
        await Modal.error("Errore durante l'esportazione Markdown: " + error.message);
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

  let text = formatSummaryWithKeyPointsText(
    state.currentEntry.summary,
    state.currentEntry.keyPoints,
  );

  // Aggiungi traduzione se presente
  if (state.currentEntry.translation) {
    text += `\n${'='.repeat(50)}\n\n`;
    text += `TRADUZIONE:\n${state.currentEntry.translation.text}\n`;
  }

  // Aggiungi Q&A se presenti
  if (state.currentEntry.qa && state.currentEntry.qa.length > 0) {
    text += `\n${'='.repeat(50)}\n\n`;
    text += `DOMANDE E RISPOSTE:\n\n`;
    state.currentEntry.qa.forEach((qa, index) => {
      text += `Q${index + 1}: ${qa.question}\n`;
      text += `R${index + 1}: ${qa.answer}\n\n`;
    });
  }

  // Aggiungi citazioni se presenti
  if (
    state.currentEntry.citations &&
    state.currentEntry.citations.citations &&
    state.currentEntry.citations.citations.length > 0
  ) {
    text += `\n${'='.repeat(50)}\n\n`;
    text += `CITAZIONI E BIBLIOGRAFIA:\n\n`;
    // Usa stile APA di default per la copia
    text += CitationExtractor.generateBibliography(
      state.currentEntry.article,
      state.currentEntry.citations.citations,
      'apa',
    );
  }

  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('copyModalBtn');
    const originalText = btn.textContent;
    btn.textContent = '✓ Copiato!';
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
