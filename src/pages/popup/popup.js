// Popup Script - Controller principale
// Entry point ES Module: importa tutti i moduli e gestisce init + event listeners

import { state, elements, initElements, showState, showError } from './state.js';
import { translationState, citationsState } from './features.js';
import { analyzeArticle, generateSummary, switchTab, copyToClipboard } from './analysis.js';
import { exportToPDF, exportToMarkdown, openEmailModal } from './export.js';
import { askQuestion, translateArticle } from './features.js';
import { extractCitations } from './citations.js';
import { initVoiceController, handleVoiceQuestion } from './voice.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { ProgressTracker } from '../../utils/core/progress-tracker.js';
import { eventCleanup } from '../../utils/core/event-cleanup.js';
import { ErrorHandler } from '../../utils/core/error-handler.js';
import { Logger } from '../../utils/core/logger.js';
import { ThemeManager } from '../../utils/core/theme-manager.js';

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    Logger.info('Popup inizializzato');

    // Initialize DOM elements
    initElements();

    // Initialize i18n
    await I18n.init();

    // Initialize Progress Tracker
    state.progressTracker = new ProgressTracker(
      elements.loadingState,
      elements.loadingText,
      document.getElementById('progressBar'),
      document.getElementById('progressPercent'),
    );

    // Define process steps
    state.progressTracker.defineSteps([
      { name: 'extract', label: '📄 Estrazione articolo', weight: 10 },
      { name: 'classify', label: '🔍 Classificazione tipo', weight: 15 },
      { name: 'generate', label: '🤖 Generazione riassunto', weight: 60 },
      { name: 'keypoints', label: '🔑 Estrazione punti chiave', weight: 10 },
      { name: 'save', label: '💾 Salvataggio', weight: 5 },
    ]);

    // Load settings
    const settings = await StorageManager.getSettings();
    elements.providerSelect.value = settings.selectedProvider;

    // Theme is auto-initialized by ThemeManager import

    // Load saved UI language
    const savedUILanguage = await StorageManager.getUILanguage();
    const uiLanguageSelect = document.getElementById('uiLanguageSelect');
    if (savedUILanguage && uiLanguageSelect) {
      uiLanguageSelect.value = savedUILanguage;
    }

    // Load saved output language
    const savedLanguage = await StorageManager.getSelectedLanguage();
    if (savedLanguage) {
      state.selectedLanguage = savedLanguage;
      elements.languageSelect.value = savedLanguage;
      elements.languageSelectReady.value = savedLanguage;
    }

    // Always set "auto" as default on open
    state.selectedContentType = 'auto';
    elements.contentTypeSelect.value = 'auto';
    elements.contentTypeSelectReady.value = 'auto';

    // Event listener for UI language change (with cleanup)
    if (uiLanguageSelect) {
      const handleUILanguageChange = async (e) => {
        await I18n.setLanguage(e.target.value);
      };
      eventCleanup.addEventListener(uiLanguageSelect, 'change', handleUILanguageChange);
    }

    // Event listeners with automatic cleanup
    eventCleanup.addEventListener(elements.analyzeBtn, 'click', analyzeArticle);
    eventCleanup.addEventListener(elements.generateBtn, 'click', generateSummary);
    eventCleanup.addEventListener(elements.retryBtn, 'click', analyzeArticle);
    eventCleanup.addEventListener(elements.themeToggleBtn, 'click', () => ThemeManager.toggle());
    eventCleanup.addEventListener(elements.settingsBtn, 'click', async () => {
      try {
        await browser.runtime.openOptionsPage();
      } catch (error) {
        Logger.error('Impossibile aprire le impostazioni:', error);
        showError('Impossibile aprire le impostazioni. Riprova.');
      }
    });
    eventCleanup.addEventListener(elements.historyBtn, 'click', async () => {
      try {
        await browser.tabs.create({ url: 'src/pages/history/history.html' });
      } catch (error) {
        Logger.error('Impossibile aprire la cronologia:', error);
        showError('Impossibile aprire la cronologia. Riprova.');
      }
    });
    eventCleanup.addEventListener(elements.multiAnalysisBtn, 'click', async () => {
      try {
        await browser.tabs.create({ url: 'src/pages/multi-analysis/multi-analysis.html' });
      } catch (error) {
        Logger.error('Impossibile aprire multi-analisi:', error);
        showError('Impossibile aprire multi-analisi. Riprova.');
      }
    });
    eventCleanup.addEventListener(elements.pdfAnalysisBtn, 'click', async () => {
      try {
        await browser.tabs.create({ url: 'src/pages/pdf-analysis/pdf-analysis.html' });
      } catch (error) {
        Logger.error('Impossibile aprire analisi PDF:', error);
        showError('Impossibile aprire analisi PDF. Riprova.');
      }
    });
    eventCleanup.addEventListener(elements.readingModeBtn, 'click', openReadingMode);
    eventCleanup.addEventListener(elements.copyBtn, 'click', copyToClipboard);
    eventCleanup.addEventListener(elements.newBtn, 'click', reset);
    eventCleanup.addEventListener(elements.exportPdfBtn, 'click', exportToPDF);
    eventCleanup.addEventListener(elements.exportMdBtn, 'click', exportToMarkdown);
    eventCleanup.addEventListener(elements.sendEmailBtn, 'click', openEmailModal);
    eventCleanup.addEventListener(elements.askBtn, 'click', askQuestion);
    eventCleanup.addEventListener(elements.translateBtn, 'click', translateArticle);
    eventCleanup.addEventListener(elements.extractCitationsBtn, 'click', extractCitations);

    // Initialize Voice Controller
    await initVoiceController();

    // Event listener for voice question
    const voiceQuestionBtn = document.getElementById('voiceQuestionBtn');
    if (voiceQuestionBtn) {
      eventCleanup.addEventListener(voiceQuestionBtn, 'click', handleVoiceQuestion);
    }

    // Tabs
    document.querySelectorAll('.tab').forEach((tab) => {
      const handleTabClick = () => switchTab(tab.dataset.tab);
      eventCleanup.addEventListener(tab, 'click', handleTabClick);
    });

    // Save selected provider
    const handleProviderChange = async () => {
      const settings = await StorageManager.getSettings();
      settings.selectedProvider = elements.providerSelect.value;
      await StorageManager.saveSettings(settings);
    };
    eventCleanup.addEventListener(elements.providerSelect, 'change', handleProviderChange);

    // Save selected language (initial page)
    const handleLanguageChange = async () => {
      state.selectedLanguage = elements.languageSelect.value;
      elements.languageSelectReady.value = state.selectedLanguage; // Sync
      await StorageManager.saveSelectedLanguage(state.selectedLanguage);
      Logger.debug('Lingua selezionata:', state.selectedLanguage);
    };
    eventCleanup.addEventListener(elements.languageSelect, 'change', handleLanguageChange);

    // Save selected language (ready page)
    const handleLanguageReadyChange = async () => {
      state.selectedLanguage = elements.languageSelectReady.value;
      elements.languageSelect.value = state.selectedLanguage; // Sync
      await StorageManager.saveSelectedLanguage(state.selectedLanguage);
      Logger.debug('Lingua selezionata:', state.selectedLanguage);
    };
    eventCleanup.addEventListener(
      elements.languageSelectReady,
      'change',
      handleLanguageReadyChange,
    );

    // Handle content type change (initial page)
    const handleContentTypeChange = () => {
      state.selectedContentType = elements.contentTypeSelect.value;
      elements.contentTypeSelectReady.value = state.selectedContentType; // Sync
      Logger.debug('Tipo di contenuto selezionato:', state.selectedContentType);
    };
    eventCleanup.addEventListener(elements.contentTypeSelect, 'change', handleContentTypeChange);

    // Handle content type change (ready page)
    const handleContentTypeReadyChange = () => {
      state.selectedContentType = elements.contentTypeSelectReady.value;
      elements.contentTypeSelect.value = state.selectedContentType; // Sync
      Logger.debug('Tipo di contenuto selezionato:', state.selectedContentType);
    };
    eventCleanup.addEventListener(
      elements.contentTypeSelectReady,
      'change',
      handleContentTypeReadyChange,
    );

    Logger.info('Event listeners configurati con cleanup automatico');

    // Log listener statistics
    const stats = eventCleanup.getStats();
    Logger.debug(
      `📊 Listener registrati: ${stats.totalListeners} su ${stats.totalElements} elementi`,
    );
  } catch (error) {
    Logger.error('Errore inizializzazione popup:', error);
    // Use ErrorHandler to display error to the user
    await ErrorHandler.showError(error, 'Inizializzazione popup');
  }
});

function reset() {
  state.currentArticle = null;
  state.currentResults = null;
  state.currentQA = []; // Clear Q&A as well

  // Reset content type to 'auto'
  state.selectedContentType = 'auto';
  elements.contentTypeSelect.value = 'auto';
  elements.contentTypeSelectReady.value = 'auto';

  showState('initial');
}

// Theme toggle delegated to ThemeManager

// Open Reading Mode
async function openReadingMode() {
  if (!state.currentArticle || !state.currentResults) {
    showError('Nessun riassunto disponibile per la modalità lettura');
    return;
  }

  // Prepare data for reading mode (include all available data)
  const readingData = {
    article: state.currentArticle,
    summary: state.currentResults.summary,
    keyPoints: state.currentResults.keyPoints,
    translation: translationState.value || null,
    citations: citationsState.value || null,
    qa: state.currentQA && state.currentQA.length > 0 ? state.currentQA : null,
    metadata: {
      provider: elements.providerSelect.value,
      language: state.selectedLanguage,
      contentType: state.currentResults.detectedContentType || state.selectedContentType,
    },
  };

  // Save to browser.storage.local (persists across tabs)
  try {
    await browser.storage.local.set({ readingModeData: readingData });
  } catch (error) {
    Logger.error('Errore apertura reading mode:', error);
    const isQuotaError = error.message?.includes('QUOTA') || error.message?.includes('quota');
    showError(
      isQuotaError
        ? 'Impossibile aprire la modalità lettura: spazio di archiviazione insufficiente.'
        : `Impossibile aprire la modalità lettura: ${error.message}`,
    );
    return;
  }

  // Open reading mode in new tab
  await browser.tabs.create({ url: 'src/pages/reading-mode/reading-mode.html' });
}
