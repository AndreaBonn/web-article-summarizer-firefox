// history-collections.js — PDF e Multi-analysis history

import {
  renderPDFCardHtml,
  renderMultiAnalysisCardHtml,
  buildPDFReadingData,
  isValidMultiAnalysisEntry,
} from './collections-render.js';
import { Logger } from '../../utils/core/logger.js';
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

  container.innerHTML = history.map((entry) => renderPDFCardHtml(entry)).join('');

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
        favoriteBtn.textContent = isFavorite ? '★' : '☆';
        favoriteBtn.title = isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti';
      });
    }
  });
}

async function openPDF(id) {
  const entry = await HistoryManager.getPDFById(id);
  if (!entry) {
    alert('PDF non trovato');
    return;
  }

  // Prepara dati per reading mode
  const readingData = buildPDFReadingData(entry);

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

  container.innerHTML = history.map((entry) => renderMultiAnalysisCardHtml(entry)).join('');

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
        favoriteBtn.textContent = isFavorite ? '★' : '☆';
        favoriteBtn.title = isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti';
      });
    }
  });
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
  if (!isValidMultiAnalysisEntry(entry)) {
    await Modal.error(
      "Questa analisi ha una struttura dati non valida. Prova a eliminarla e rifare l'analisi.",
    );
    return;
  }

  // Apri la pagina multi-analysis con i dati salvati
  await browser.storage.local.set({
    reopenMultiAnalysis: {
      id: entry.id,
      analysis: entry.analysis,
      articles: entry.articles,
      timestamp: entry.timestamp,
    },
  });
  Logger.debug('Reindirizzamento a multi-analysis.html');
  window.location.href = browser.runtime.getURL('src/pages/multi-analysis/multi-analysis.html');
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
