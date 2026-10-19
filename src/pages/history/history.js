// History Page Script

import { state } from './state.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { ThemeManager } from '../../utils/core/theme-manager.js';
import { eventCleanup } from '../../utils/core/event-cleanup.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { DebounceUtility } from '../../utils/core/debounce-utility.js';
import { SearchOptimizer } from '../../utils/core/search-optimizer.js';
import { HistoryLazyLoader } from '../../utils/core/history-lazy-loader.js';
import { VoiceController } from '../../utils/voice/voice-controller.js';
import { Modal } from '../../utils/core/modal.js';
import { Logger } from '../../utils/core/logger.js';
import { bindMenuButton } from '../../utils/core/menu-button.js';
import {
  openDetail,
  closeModal,
  switchModalTab,
  exportCurrentPdf,
  exportCurrentMarkdown,
  copyCurrentSummary,
  deleteCurrentEntry,
} from './detail.js';
import { loadPDFHistory, loadMultiAnalysisHistory } from './collections.js';
import {
  sendCurrentEmail,
  openReadingModeFromHistory,
  downloadHistory,
  importHistory,
} from './io.js';
import {
  setupVoiceEventListeners,
  handleModalTTSPlay,
  handleModalTTSPause,
  handleModalTTSStop,
} from './voice.js';

// Inizializza SearchOptimizer nello state
state.searchOptimizer = new SearchOptimizer();

// Registra callbacks sullo state per evitare circular imports tra i moduli
state.loadHistory = () => loadHistory();
state.loadMultiAnalysisHistory = () => loadMultiAnalysisHistory();

// Modal System — caricato da utils/modal.js

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await I18n.initPage();

    // Initialize voice controller
    state.voiceController = new VoiceController();
    await state.voiceController.initialize();

    // Setup voice event listeners
    setupVoiceEventListeners();

    // Assicurati che il tab single sia visibile all'avvio
    document.getElementById('historyList').classList.remove('hidden');
    document.getElementById('multiAnalysisList').classList.add('hidden');

    await loadHistory();

    // History tabs event listeners
    document.querySelectorAll('.history-tab').forEach((tab) => {
      eventCleanup.addEventListener(tab, 'click', () => switchTab(tab.dataset.tab));
    });

    // Event listeners
    eventCleanup.addEventListener(document.getElementById('backBtn'), 'click', () => {
      window.close();
    });

    // Crea versione debounced della ricerca con feedback visivo
    state.debouncedSearch = DebounceUtility.debounceWithFeedback(
      handleSearch,
      300, // 300ms di attesa
      document.getElementById('searchInput'),
    );

    eventCleanup.addEventListener(
      document.getElementById('searchInput'),
      'input',
      state.debouncedSearch,
    );
    bindMenuButton(document.getElementById('manageBtn'), document.getElementById('manageMenu'));
    eventCleanup.addEventListener(document.getElementById('filtersToggleBtn'), 'click', (e) => {
      const panel = document.getElementById('filtersPanel');
      const isOpen = panel.classList.toggle('hidden') === false;
      e.currentTarget.setAttribute('aria-expanded', String(isOpen));
    });
    eventCleanup.addEventListener(
      document.getElementById('providerFilter'),
      'change',
      handleFilter,
    );
    eventCleanup.addEventListener(
      document.getElementById('languageFilter'),
      'change',
      handleFilter,
    );
    eventCleanup.addEventListener(
      document.getElementById('contentTypeFilter'),
      'change',
      handleFilter,
    );
    eventCleanup.addEventListener(
      document.getElementById('favoriteFilter'),
      'change',
      handleFilter,
    );
    eventCleanup.addEventListener(
      document.getElementById('downloadHistoryBtn'),
      'click',
      downloadHistory,
    );
    eventCleanup.addEventListener(document.getElementById('importHistoryBtn'), 'click', () => {
      document.getElementById('importFileInput').click();
    });
    eventCleanup.addEventListener(
      document.getElementById('importFileInput'),
      'change',
      importHistory,
    );
    eventCleanup.addEventListener(
      document.getElementById('clearSingleHistoryBtn'),
      'click',
      clearSingleHistory,
    );
    eventCleanup.addEventListener(
      document.getElementById('clearPDFHistoryBtn'),
      'click',
      clearPDFHistory,
    );
    eventCleanup.addEventListener(
      document.getElementById('clearMultiHistoryBtn'),
      'click',
      clearMultiHistory,
    );

    // Modal
    eventCleanup.addEventListener(document.getElementById('closeModal'), 'click', closeModal);
    eventCleanup.addEventListener(
      document.getElementById('readingModeBtn'),
      'click',
      openReadingModeFromHistory,
    );
    eventCleanup.addEventListener(
      document.getElementById('exportPdfBtn'),
      'click',
      exportCurrentPdf,
    );
    eventCleanup.addEventListener(
      document.getElementById('exportMdBtn'),
      'click',
      exportCurrentMarkdown,
    );
    eventCleanup.addEventListener(
      document.getElementById('sendEmailBtn'),
      'click',
      sendCurrentEmail,
    );
    eventCleanup.addEventListener(
      document.getElementById('copyModalBtn'),
      'click',
      copyCurrentSummary,
    );
    eventCleanup.addEventListener(
      document.getElementById('deleteModalBtn'),
      'click',
      deleteCurrentEntry,
    );

    // Modal tabs
    document.querySelectorAll('.modal-tab').forEach((tab) => {
      eventCleanup.addEventListener(tab, 'click', () => switchModalTab(tab.dataset.tab));
    });

    // Voice controls in modal
    eventCleanup.addEventListener(
      document.getElementById('modalTtsPlayBtn'),
      'click',
      handleModalTTSPlay,
    );
    eventCleanup.addEventListener(
      document.getElementById('modalTtsPauseBtn'),
      'click',
      handleModalTTSPause,
    );
    eventCleanup.addEventListener(
      document.getElementById('modalTtsStopBtn'),
      'click',
      handleModalTTSStop,
    );

    // Close modal on background click
    eventCleanup.addEventListener(document.getElementById('detailModal'), 'click', (e) => {
      if (e.target.id === 'detailModal') {
        closeModal();
      }
    });

    // Theme toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      eventCleanup.addEventListener(themeBtn, 'click', () => ThemeManager.toggle());
    }
  } catch (error) {
    Logger.error('Errore inizializzazione pagina cronologia:', error);
  }
});

export async function loadHistory() {
  state.currentHistory = await HistoryManager.getHistory();

  // Inizializza lazy loader se non esiste
  if (!state.lazyLoader) {
    const listEl = document.getElementById('historyList');
    state.lazyLoader = new HistoryLazyLoader(listEl, 20); // 20 items per page

    // Imposta callbacks
    state.lazyLoader.onItemClick = openDetail;
    state.lazyLoader.onFavoriteToggle = async (id) => {
      const isFavorite = await HistoryManager.toggleFavorite(id);
      // Aggiorna anche in currentHistory
      const entry = state.currentHistory.find((e) => e.id === id);
      if (entry) {
        entry.favorite = isFavorite;
      }
      return isFavorite;
    };
  }

  displayHistory(state.currentHistory);
}

function displayHistory(history) {
  const listEl = document.getElementById('historyList');
  const emptyEl = document.getElementById('emptyState');

  if (history.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  state.lazyLoader.setItems(history);
}

async function handleSearch(e) {
  const query = e.target.value.trim();

  if (query === '') {
    state.searchOptimizer.reset();
    displayHistory(state.currentHistory);
    return;
  }

  // One search box looks everywhere: title, address and summary
  const filtered = state.searchOptimizer.search(state.currentHistory, query, {
    searchInTitle: true,
    searchInUrl: true,
    searchInContent: true,
  });

  displayHistory(filtered);
}

async function handleFilter() {
  const provider = document.getElementById('providerFilter').value;
  const language = document.getElementById('languageFilter').value;
  const contentType = document.getElementById('contentTypeFilter').value;
  const favoriteFilter = document.getElementById('favoriteFilter').value;

  let filtered = state.currentHistory;

  // Applica filtri standard
  const filters = {};
  if (provider) filters.provider = provider;
  if (language) filters.language = language;
  if (contentType) filters.contentType = contentType;

  if (Object.keys(filters).length > 0) {
    filtered = await HistoryManager.filterHistory(filters);
  }

  // Applica filtro preferiti/note
  if (favoriteFilter === 'favorites') {
    filtered = filtered.filter((entry) => entry.favorite === true);
  } else if (favoriteFilter === 'withNotes') {
    filtered = filtered.filter((entry) => entry.notes && entry.notes.trim().length > 0);
  }

  displayHistory(filtered);
}

async function clearSingleHistory() {
  const history = await HistoryManager.getHistory();
  const favoritesCount = history.filter((e) => e.favorite).length;

  let message = 'Sei sicuro di voler cancellare tutta la cronologia degli articoli singoli?';
  if (favoritesCount > 0) {
    message += `\n\n⭐ ${favoritesCount} articoli preferiti NON verranno eliminati.`;
  }
  message += '\n\nQuesta azione non può essere annullata.';

  const confirmed = await Modal.confirm(message, 'Cancella Articoli Singoli', '🗑️');

  if (!confirmed) return;

  await HistoryManager.clearHistory();
  await loadHistory();
}

async function clearPDFHistory() {
  const history = await HistoryManager.getPDFHistory();
  const favoritesCount = history.filter((e) => e.favorite).length;

  let message = 'Sei sicuro di voler cancellare tutta la cronologia dei PDF analizzati?';
  if (favoritesCount > 0) {
    message += `\n\n⭐ ${favoritesCount} PDF preferiti NON verranno eliminati.`;
  }
  message += '\n\nQuesta azione non può essere annullata.';

  const confirmed = await Modal.confirm(message, 'Elimina Cronologia PDF', '🗑️');

  if (!confirmed) return;

  await HistoryManager.clearPDFHistory();
  await loadPDFHistory();
}

async function clearMultiHistory() {
  const history = await HistoryManager.getMultiAnalysisHistory();
  const favoritesCount = history.filter((e) => e.favorite).length;

  let message = 'Sei sicuro di voler cancellare tutta la cronologia delle analisi Multi Articolo?';
  if (favoritesCount > 0) {
    message += `\n\n⭐ ${favoritesCount} analisi preferite NON verranno eliminate.`;
  }
  message += '\n\nQuesta azione non può essere annullata.';

  const confirmed = await Modal.confirm(message, 'Cancella Analisi Multiple', '🗑️');

  if (!confirmed) return;

  await HistoryManager.clearMultiAnalysisHistory();
  await loadMultiAnalysisHistory();
}

// ===== MULTI-ANALYSIS HISTORY =====

function switchTab(tab) {
  // Aggiorna UI dei tab
  document.querySelectorAll('.history-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  // Mostra/nascondi liste
  document.getElementById('historyList').classList.toggle('hidden', tab !== 'single');
  document.getElementById('pdfHistoryList').classList.toggle('hidden', tab !== 'pdf');
  document.getElementById('multiAnalysisList').classList.toggle('hidden', tab !== 'multi');

  // Mostra/nascondi pulsanti appropriati
  document.getElementById('clearSingleHistoryBtn').classList.toggle('hidden', tab !== 'single');
  document.getElementById('clearPDFHistoryBtn').classList.toggle('hidden', tab !== 'pdf');
  document.getElementById('clearMultiHistoryBtn').classList.toggle('hidden', tab !== 'multi');

  // Carica la cronologia appropriata
  if (tab === 'multi') {
    loadMultiAnalysisHistory();
  } else if (tab === 'pdf') {
    loadPDFHistory();
  }
}

// Theme managed by ThemeManager (auto-init on import, toggle registered in DOMContentLoaded)
