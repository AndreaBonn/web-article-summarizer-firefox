// history-collections.js — PDF e Multi-analysis history

import { Logger } from '../../utils/core/logger.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { Modal } from '../../utils/core/modal.js';

export async function loadPDFHistory() {
  Logger.info('Caricamento cronologia PDF...');
  const history = await HistoryManager.getPDFHistory();
  Logger.info('Trovati', history.length, 'PDF analizzati');
  const container = document.getElementById('pdfHistoryList');

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">—</div>
        <p>Nessun PDF analizzato</p>
        <small>I tuoi PDF analizzati appariranno qui</small>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map((entry) => createPDFCard(entry)).join('');

  // Aggiungi event listeners
  document.querySelectorAll('.pdf-card').forEach((card) => {
    const id = card.dataset.id;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.history-btn') || e.target.closest('.btn-favorite')) return;
      openPDF(id);
    });

    const deleteBtn = card.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deletePDF(id);
      });
    }

    const favoriteBtn = card.querySelector('.btn-favorite');
    if (favoriteBtn) {
      favoriteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isFavorite = await HistoryManager.togglePDFFavorite(id);
        favoriteBtn.classList.toggle('active', isFavorite);
        favoriteBtn.textContent = isFavorite ? '⭐' : '☆';
        favoriteBtn.title = isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti';
      });
    }
  });
}

function createPDFCard(entry) {
  const date = HistoryManager.formatDate(entry.timestamp);
  const fileSize = HistoryManager.formatFileSize(entry.pdf.size);
  const isFavorite = entry.favorite || false;
  const hasTranslation = !!entry.translation;
  const hasQA = entry.qa && entry.qa.length > 0;
  const hasCitations =
    entry.citations && entry.citations.citations && entry.citations.citations.length > 0;
  const hasNotes = !!entry.notes;

  const badges = [];
  if (hasTranslation) badges.push('<span class="badge">Tradotto</span>');
  if (hasQA) badges.push(`<span class="badge">${Number(entry.qa.length) || 0} Q&A</span>`);
  if (hasCitations)
    badges.push(
      `<span class="badge">${Number(entry.citations.citations.length) || 0} Citazioni</span>`,
    );
  if (hasNotes) badges.push('<span class="badge">Note</span>');
  if (entry.metadata.fromCache) badges.push('<span class="badge cache-badge">Cache</span>');

  return `
    <div class="history-card pdf-card" data-id="${HtmlSanitizer.escape(entry.id)}">
      <div class="card-header">
        <div class="card-title-row">
          <h3 class="card-title">${HtmlSanitizer.escape(entry.pdf.name)}</h3>
          <button class="btn-favorite ${isFavorite ? 'active' : ''}"
                  title="${isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}">
            ${isFavorite ? '⭐' : '☆'}
          </button>
        </div>
        <div class="card-meta">
          <span class="meta-item">${HtmlSanitizer.escape(date)}</span>
          <span class="meta-item">${HtmlSanitizer.escape(fileSize)}</span>
          <span class="meta-item">${HtmlSanitizer.escape(String(entry.pdf.pages))} pagine</span>
          <span class="meta-item">${HtmlSanitizer.escape(entry.metadata.provider)}</span>
          <span class="meta-item">${HtmlSanitizer.escape(entry.metadata.language)}</span>
        </div>
      </div>

      <div class="card-content">
        <div class="summary-preview">
          ${HtmlSanitizer.escape(entry.summary.substring(0, 200))}${entry.summary.length > 200 ? '...' : ''}
        </div>

        ${badges.length > 0 ? `<div class="badges">${badges.join('')}</div>` : ''}

        <div class="keypoints-preview">
          <strong>Punti Chiave:</strong>
          <ul>
            ${entry.keyPoints
              .slice(0, 3)
              .map((kp) => `<li>${HtmlSanitizer.escape(kp.title)}</li>`)
              .join('')}
            ${entry.keyPoints.length > 3 ? `<li><em>+${entry.keyPoints.length - 3} altri...</em></li>` : ''}
          </ul>
        </div>
      </div>

      <div class="card-actions">
        <button class="history-btn btn-delete btn-delete-full" title="Elimina">
          Elimina
        </button>
      </div>
    </div>
  `;
}

async function openPDF(id) {
  const entry = await HistoryManager.getPDFById(id);
  if (!entry) {
    alert('PDF non trovato');
    return;
  }

  // Prepara dati per reading mode
  const readingData = {
    pdf: entry.pdf,
    summary: entry.summary,
    keyPoints: entry.keyPoints,
    translation: entry.translation,
    citations: entry.citations,
    qa: entry.qa,
    notes: entry.notes,
    metadata: entry.metadata,
    historyId: entry.id,
    source: 'pdf',
    // Aggiungi campi necessari per il reading mode
    isPDF: true,
    extractedText: entry.pdf.text,
    pageCount: entry.pdf.pages,
    filename: entry.pdf.name,
    apiProvider: entry.metadata.provider,
  };

  // Salva in storage
  await browser.storage.local.set({ pdfReadingMode: readingData });

  // Apri reading mode
  browser.tabs.create({ url: 'src/pages/reading-mode/reading-mode.html?source=pdf' });
}

async function deletePDF(id) {
  const confirmed = await Modal.confirm(
    'Sei sicuro di voler eliminare questo PDF dalla cronologia?\n\nQuesta azione non può essere annullata.',
    'Elimina PDF',
    '×',
  );

  if (!confirmed) return;

  await HistoryManager.deletePDF(id);
  await loadPDFHistory();
}

export async function loadMultiAnalysisHistory() {
  Logger.info('Caricamento cronologia multi-analisi...');
  const history = await HistoryManager.getMultiAnalysisHistory();
  Logger.info('Trovate', history.length, 'analisi Multi Articolo');
  const container = document.getElementById('multiAnalysisList');

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">—</div>
        <p>Nessuna analisi Multi Articolo</p>
        <small>Le tue analisi Multi Articolo appariranno qui</small>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map((entry) => createMultiAnalysisCard(entry)).join('');

  // Aggiungi event listeners
  document.querySelectorAll('.multi-analysis-card').forEach((card) => {
    const id = card.dataset.id;

    card.addEventListener('click', (e) => {
      // Non aprire se si clicca sulla stella o sul pulsante elimina
      if (e.target.closest('.multi-analysis-btn') || e.target.closest('.btn-favorite-multi'))
        return;

      openMultiAnalysis(id);
    });

    const deleteBtn = card.querySelector('.btn-delete-multi');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteMultiAnalysis(id);
      });
    }

    const favoriteBtn = card.querySelector('.btn-favorite-multi');
    if (favoriteBtn) {
      favoriteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isFavorite = await HistoryManager.toggleMultiAnalysisFavorite(id);

        // Aggiorna UI
        favoriteBtn.classList.toggle('active', isFavorite);
        favoriteBtn.textContent = isFavorite ? '⭐' : '☆';
        favoriteBtn.title = isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti';
      });
    }
  });
}

function createMultiAnalysisCard(entry) {
  const date = HistoryManager.formatDate(entry.timestamp);
  const qaCount = entry.analysis?.qa?.questions?.length || 0;
  const articlesCount = entry.articles?.length || 0;
  const provider = entry.metadata?.provider || 'unknown';

  return `
    <div class="multi-analysis-card" data-id="${HtmlSanitizer.escape(entry.id)}">
      <div class="multi-analysis-header">
        <div>
          <div class="multi-analysis-title">
            ${HtmlSanitizer.escape(I18n.t('multi.analysisOf'))} ${articlesCount} ${HtmlSanitizer.escape(I18n.t('multi.articles'))}
          </div>
          <div class="multi-analysis-meta">
            <span class="multi-analysis-badge articles">${articlesCount} ${HtmlSanitizer.escape(I18n.t('multi.articles'))}</span>
            <span class="multi-analysis-badge date">${HtmlSanitizer.escape(date)}</span>
            <span class="multi-analysis-badge provider">${HtmlSanitizer.escape(provider)}</span>
            ${qaCount > 0 ? `<span class="multi-analysis-badge qa">${qaCount} Q&A</span>` : ''}
          </div>
        </div>
        <button class="btn-favorite-multi ${entry.favorite ? 'active' : ''}" data-id="${HtmlSanitizer.escape(entry.id)}" title="${entry.favorite ? HtmlSanitizer.escape(I18n.t('history.removeFavorite')) : HtmlSanitizer.escape(I18n.t('history.addFavorite'))}">
          ${entry.favorite ? '⭐' : '☆'}
        </button>
      </div>

      <div class="multi-analysis-articles">
        <div class="multi-analysis-articles-title">${HtmlSanitizer.escape(I18n.t('multi.articlesIncluded'))}</div>
        ${
          entry.articles && entry.articles.length > 0
            ? entry.articles
                .slice(0, 3)
                .map(
                  (a) => `
          <div class="multi-analysis-article-item">${HtmlSanitizer.escape(a.title || I18n.t('common.titleUnavailable'))}</div>
        `,
                )
                .join('')
            : `<div class="multi-analysis-article-item">${I18n.t('multi.noArticles')}</div>`
        }
        ${entry.articles && entry.articles.length > 3 ? `<div class="multi-analysis-article-item">... e altri ${entry.articles.length - 3}</div>` : ''}
      </div>

      <div class="multi-analysis-actions">
        <button class="multi-analysis-btn danger btn-delete-multi">Elimina</button>
      </div>
    </div>
  `;
}

async function openMultiAnalysis(id) {
  Logger.debug('Apertura analisi Multi Articolo ID:', id);
  const entry = await HistoryManager.getMultiAnalysisById(id);
  Logger.debug('Entry trovata:', entry);

  if (!entry) {
    await Modal.error(I18n.t('common.analysisNotFound'));
    return;
  }

  // Verifica che i dati siano validi
  if (!entry.analysis || !entry.articles) {
    await Modal.error(
      "Questa analisi ha una struttura dati non valida. Prova a eliminarla e rifare l'analisi.",
    );
    return;
  }

  // Apri la pagina multi-analysis con i dati salvati
  browser.storage.local.set(
    {
      reopenMultiAnalysis: {
        id: entry.id,
        analysis: entry.analysis,
        articles: entry.articles,
      },
    },
    () => {
      Logger.debug('Reindirizzamento a multi-analysis.html');
      window.location.href = browser.runtime.getURL('src/pages/multi-analysis/multi-analysis.html');
    },
  );
}

async function deleteMultiAnalysis(id) {
  const confirmed = await Modal.confirm(
    'Vuoi eliminare questa analisi Multi Articolo?',
    'Conferma Eliminazione',
    '⚠️',
  );

  if (confirmed) {
    await HistoryManager.deleteMultiAnalysis(id);
    await loadMultiAnalysisHistory();
  }
}
