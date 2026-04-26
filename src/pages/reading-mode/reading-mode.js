// Reading Mode - Side-by-Side View
// Controller: init, caricamento dati, event listeners, theme, resize

import { state, elements, initElements } from './state.js';
import { VoiceController } from '../../utils/voice/voice-controller.js';
import { Logger } from '../../utils/core/logger.js';
import { ThemeManager } from '../../utils/core/theme-manager.js';
import { eventCleanup } from '../../utils/core/event-cleanup.js';
import { I18n } from '../../utils/i18n/i18n.js';

import {
  displayContent,
  switchArticleView,
  syncScrollPosition,
  switchSummaryTab,
  showError,
} from './display.js';

import { copyAll, exportToPDF } from './export.js';

import { translateArticle, extractCitations } from './features.js';
import { askQuestion } from './features-qa.js';

import {
  setupVoiceEventListeners,
  handleTTSPlay,
  handleTTSPause,
  handleTTSStop,
  handleVoiceInput,
  loadFontSize,
  increaseFontSize,
  decreaseFontSize,
} from './voice.js';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Populate DOM element references
  initElements();

  // Initialize i18n (no language selector on this page, just apply translations)
  await I18n.init();

  try {
    // Initialize voice controller
    state.voiceController = new VoiceController();
    await state.voiceController.initialize();

    // Load data from URL params or storage
    await loadData();

    // Setup event listeners
    setupEventListeners();

    // Setup voice event listeners
    setupVoiceEventListeners();

    // Theme auto-initialized by ThemeManager import

    // Load font size
    loadFontSize();

    // Display content
    displayContent();
  } catch (error) {
    Logger.error('Initialization error:', error);

    if (error.message === 'NODATA') {
      showNoDataMessage();
    } else {
      showError(error.message || 'Errore durante il caricamento dei dati');
    }
  }
});

// Load data
async function loadData() {
  try {
    // Try to get data from URL params
    const params = new URLSearchParams(window.location.search);
    const historyId = params.get('id');
    const source = params.get('source');

    // Check if loading PDF analysis
    if (source === 'pdf' && typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(['pdfReadingMode']);
      if (result.pdfReadingMode) {
        state.currentData = result.pdfReadingMode;
        state.currentData.isPDF = true;
        // Clean up after loading
        await chrome.storage.local.remove(['pdfReadingMode']);
        Logger.info('Dati PDF caricati:', state.currentData);
        return;
      }
    }

    if (historyId && typeof chrome !== 'undefined' && chrome.storage) {
      // Load from history using chrome.storage (use summaryHistory)
      const result = await chrome.storage.local.get(['summaryHistory']);
      const history = result.summaryHistory || [];
      state.currentData = history.find((item) => String(item.id) === String(historyId));

      if (!state.currentData) {
        throw new Error('Riassunto non trovato nella cronologia');
      }

      Logger.info('Dati caricati dalla cronologia:', state.currentData);
    } else if (typeof chrome !== 'undefined' && chrome.storage) {
      // Try to load from chrome.storage (passed from popup)
      const result = await chrome.storage.local.get(['readingModeData']);
      if (result.readingModeData) {
        state.currentData = result.readingModeData;
        // Clean up after loading
        await chrome.storage.local.remove(['readingModeData']);
      } else {
        // No data available - show helpful message
        throw new Error('NODATA');
      }
    } else {
      // Fallback to sessionStorage (for test files)
      const sessionData = sessionStorage.getItem('readingModeData');
      if (sessionData) {
        try {
          state.currentData = JSON.parse(sessionData);
        } catch {
          Logger.warn('sessionStorage: dati corrotti, ignorati');
          throw new Error('NODATA');
        }
      } else {
        throw new Error('NODATA');
      }
    }
  } catch (error) {
    if (error.message === 'NODATA') {
      throw error;
    }
    Logger.error('Error loading data:', error);
    throw error;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Back button
  eventCleanup.addEventListener(elements.backBtn, 'click', () => {
    window.close();
  });

  // Theme toggle
  eventCleanup.addEventListener(elements.themeToggleBtn, 'click', () => ThemeManager.toggle());

  // Copy button
  eventCleanup.addEventListener(elements.copyBtn, 'click', copyAll);

  // Export button
  eventCleanup.addEventListener(elements.exportBtn, 'click', exportToPDF);

  // View toggle buttons
  if (elements.viewIframeBtn) {
    eventCleanup.addEventListener(elements.viewIframeBtn, 'click', () =>
      switchArticleView('iframe'),
    );
  }
  if (elements.viewTextBtn) {
    eventCleanup.addEventListener(elements.viewTextBtn, 'click', () => switchArticleView('text'));
  }

  // Summary tabs
  document.querySelectorAll('.summary-tab').forEach((tab) => {
    eventCleanup.addEventListener(tab, 'click', () => switchSummaryTab(tab.dataset.tab));
  });

  // Translation button
  if (elements.translateBtn) {
    eventCleanup.addEventListener(elements.translateBtn, 'click', translateArticle);
  }

  // Citations button
  if (elements.extractCitationsBtn) {
    eventCleanup.addEventListener(elements.extractCitationsBtn, 'click', extractCitations);
  }

  // Q&A
  if (elements.qaAskBtn) {
    eventCleanup.addEventListener(elements.qaAskBtn, 'click', askQuestion);
  }
  if (elements.qaInput) {
    eventCleanup.addEventListener(elements.qaInput, 'keypress', (e) => {
      if (e.key === 'Enter') askQuestion();
    });
  }

  // Scroll sync
  let scrollTimeout;
  eventCleanup.addEventListener(elements.articleContent, 'scroll', () => {
    if (!state.syncScroll) return;

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      syncScrollPosition('article');
    }, 50);
  });

  eventCleanup.addEventListener(elements.summaryContent, 'scroll', () => {
    if (!state.syncScroll) return;

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      syncScrollPosition('summary');
    }, 50);
  });

  // Resizable divider
  eventCleanup.addEventListener(elements.divider, 'mousedown', startResize);

  // Voice controls
  if (elements.ttsPlayBtn) {
    eventCleanup.addEventListener(elements.ttsPlayBtn, 'click', handleTTSPlay);
  }
  if (elements.ttsPauseBtn) {
    eventCleanup.addEventListener(elements.ttsPauseBtn, 'click', handleTTSPause);
  }
  if (elements.ttsStopBtn) {
    eventCleanup.addEventListener(elements.ttsStopBtn, 'click', handleTTSStop);
  }
  if (elements.qaVoiceBtn) {
    eventCleanup.addEventListener(elements.qaVoiceBtn, 'click', handleVoiceInput);
  }

  // Font size controls
  if (elements.fontIncreaseBtn) {
    eventCleanup.addEventListener(elements.fontIncreaseBtn, 'click', increaseFontSize);
  }
  if (elements.fontDecreaseBtn) {
    eventCleanup.addEventListener(elements.fontDecreaseBtn, 'click', decreaseFontSize);
  }
}

// Resizable divider
function startResize(_e) {
  state.isResizing = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  const onMouseMove = (moveEvent) => {
    if (!state.isResizing) return;

    const container = document.querySelector('.reading-container');
    const containerRect = container.getBoundingClientRect();
    const percentage = ((moveEvent.clientX - containerRect.left) / containerRect.width) * 100;

    // Limit between 20% and 80%
    if (percentage >= 20 && percentage <= 80) {
      document.querySelector('.article-panel').style.flex = `0 0 ${percentage}%`;
      document.querySelector('.summary-panel').style.flex = `0 0 ${100 - percentage}%`;
    }
  };

  const onMouseUp = () => {
    state.isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// Theme managed by ThemeManager (auto-init on import)

function showNoDataMessage() {
  elements.articleContent.innerHTML = `
    <div class="loading-state">
      <div class="no-data-inner">
        <div class="no-data-emoji">—</div>
        <h2 class="no-data-title">Modalità Lettura</h2>
        <p class="no-data-subtitle">
          Per usare questa funzionalità:
        </p>
        <ol class="no-data-list">
          <li>Apri un articolo web</li>
          <li>Clicca sull'icona dell'extension</li>
          <li>Analizza la pagina</li>
          <li>Genera il riassunto</li>
          <li>Clicca su "📖 Modalità Lettura"</li>
        </ol>
        <p class="no-data-hint">
          Oppure apri <strong>test-reading-mode.html</strong> per vedere una demo
        </p>
      </div>
    </div>
  `;
  elements.summaryContent.innerHTML = `
    <div class="loading-state">
      <div class="no-data-inner">
        <div class="no-data-emoji">✨</div>
        <h2 class="no-data-title">Riassunto AI</h2>
        <p class="no-data-summary-subtitle">
          Il riassunto apparirà qui dopo aver analizzato un articolo
        </p>
      </div>
    </div>
  `;
}
