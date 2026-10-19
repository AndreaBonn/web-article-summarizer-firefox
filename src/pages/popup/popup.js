// Popup Script - Controller principale
// Entry point ES Module: importa tutti i moduli e gestisce init + event listeners

import { state, elements, initElements, showState, showError, presentError } from './state.js';
import { translationState, citationsState } from './features.js';
import { analyzeArticle, switchTab, copyToClipboard } from './analysis.js';
import { buildReadingModeData, describeReadingModeStorageError } from './popup-data.js';
import { exportToPDF, exportToMarkdown, openEmailModal } from './export.js';
import { askQuestion, translateArticle } from './features.js';
import { extractCitations } from './citations.js';
import { resetArticleSession } from './session-reset.js';
import { initVoiceController, handleVoiceQuestion } from './voice.js';
import { setupProviderSelect, saveSetupKey } from './setup.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { ProgressTracker } from '../../utils/core/progress-tracker.js';
import { eventCleanup } from '../../utils/core/event-cleanup.js';
import { Logger } from '../../utils/core/logger.js';
import { ThemeManager } from '../../utils/core/theme-manager.js';
import { bindMenuButton } from '../../utils/core/menu-button.js';

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    Logger.info('Popup inizializzato');

    initElements();
    await I18n.init();

    state.progressTracker = new ProgressTracker(
      elements.loadingState,
      elements.loadingText,
      document.getElementById('progressBar'),
      document.getElementById('progressPercent'),
    );
    state.progressTracker.defineSteps([
      { name: 'extract', label: I18n.t('progress.extract'), weight: 10 },
      { name: 'classify', label: I18n.t('progress.classify'), weight: 15 },
      { name: 'generate', label: I18n.t('progress.generate'), weight: 60 },
      { name: 'keypoints', label: I18n.t('progress.keypoints'), weight: 10 },
      { name: 'save', label: I18n.t('progress.save'), weight: 5 },
    ]);

    const settings = await StorageManager.getSettings();
    state.configuredProviders = await StorageManager.getConfiguredProviders();
    setupProviderSelect(settings.selectedProvider);

    const savedLanguage = await StorageManager.getSelectedLanguage();
    if (savedLanguage) {
      state.selectedLanguage = savedLanguage;
      elements.languageSelect.value = savedLanguage;
    }

    // Always set "auto" as default on open
    state.selectedContentType = 'auto';
    elements.contentTypeSelect.value = 'auto';

    await showCurrentPageTitle();
    await showShortcutHint();
    showState(state.configuredProviders.length > 0 ? 'initial' : 'setup');

    bindEvents();
    await initVoiceController();
  } catch (error) {
    Logger.error('Errore inizializzazione popup:', error);
    await presentError(error, 'Inizializzazione popup');
  }
});

function bindEvents() {
  const on = (el, type, handler) => eventCleanup.addEventListener(el, type, handler);

  on(elements.analyzeBtn, 'click', analyzeArticle);
  on(elements.retryBtn, 'click', analyzeArticle);
  on(elements.themeToggleBtn, 'click', () => ThemeManager.toggle());
  on(elements.settingsBtn, 'click', () => openOptions());
  on(elements.addProviderBtn, 'click', () => openOptions());
  on(elements.setupOtherBtn, 'click', () => openOptions());
  on(elements.setupSaveBtn, 'click', saveSetupKey);
  on(elements.setupKeyInput, 'keydown', (e) => {
    if (e.key === 'Enter') saveSetupKey();
  });
  on(elements.historyBtn, 'click', () => openPage('src/pages/history/history.html'));
  on(elements.multiAnalysisBtn, 'click', () =>
    openPage('src/pages/multi-analysis/multi-analysis.html'),
  );
  on(elements.pdfAnalysisBtn, 'click', () => openPage('src/pages/pdf-analysis/pdf-analysis.html'));
  on(elements.errorPdfBtn, 'click', () => openPage('src/pages/pdf-analysis/pdf-analysis.html'));
  on(elements.errorConfigureBtn, 'click', () => openOptions(elements.providerSelect.value));
  on(elements.errorOtherProviderBtn, 'click', () => {
    showState('initial');
    elements.customizeDetails.open = true;
    elements.providerSelect.focus();
  });
  on(elements.readingModeBtn, 'click', openReadingMode);
  on(elements.copyBtn, 'click', copyToClipboard);
  on(elements.newBtn, 'click', resetArticleSession);
  bindMenuButton(elements.exportMenuBtn, elements.exportMenu);
  on(elements.exportPdfBtn, 'click', exportToPDF);
  on(elements.exportMdBtn, 'click', exportToMarkdown);
  on(elements.sendEmailBtn, 'click', openEmailModal);
  on(elements.askBtn, 'click', askQuestion);
  on(elements.questionInput, 'keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing && !elements.askBtn.disabled) {
      e.preventDefault();
      askQuestion();
    }
  });
  on(elements.translateBtn, 'click', translateArticle);
  on(elements.extractCitationsBtn, 'click', extractCitations);

  const voiceQuestionBtn = document.getElementById('voiceQuestionBtn');
  if (voiceQuestionBtn) on(voiceQuestionBtn, 'click', handleVoiceQuestion);

  document.querySelectorAll('.tab').forEach((tab) => {
    on(tab, 'click', () => switchTab(tab.dataset.tab));
  });

  on(elements.providerSelect, 'change', async () => {
    const settings = await StorageManager.getSettings();
    settings.selectedProvider = elements.providerSelect.value;
    await StorageManager.saveSettings(settings);
  });
  on(elements.languageSelect, 'change', async () => {
    state.selectedLanguage = elements.languageSelect.value;
    await StorageManager.saveSelectedLanguage(state.selectedLanguage);
  });
  on(elements.contentTypeSelect, 'change', () => {
    state.selectedContentType = elements.contentTypeSelect.value;
  });
}

async function openPage(url) {
  try {
    await browser.tabs.create({ url });
  } catch (error) {
    Logger.error(`Impossibile aprire ${url}:`, error);
    showError(I18n.t('error.openPageFailed'));
  }
}

// Options page, optionally scrolled to one provider's key field
async function openOptions(provider = '') {
  if (provider) {
    await openPage(browser.runtime.getURL(`src/pages/options/options.html#${provider}`));
    return;
  }
  try {
    await browser.runtime.openOptionsPage();
  } catch (error) {
    Logger.error('Impossibile aprire le impostazioni:', error);
    showError(I18n.t('error.openPageFailed'));
  }
}

async function showCurrentPageTitle() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    elements.currentPageTitle.textContent = tab?.title || '';
  } catch (error) {
    Logger.warn('Titolo della scheda non disponibile:', error.message);
  }
}

// Shows the real shortcut, including one the user reassigned in Firefox
async function showShortcutHint() {
  try {
    const commands = await browser.commands.getAll();
    const shortcut = commands.find((c) => c.name === '_execute_action')?.shortcut;
    if (!shortcut) return;
    elements.shortcutKeys.replaceChildren(
      ...shortcut.split('+').flatMap((key, index) => {
        const kbd = document.createElement('kbd');
        kbd.textContent = key;
        return index === 0 ? [kbd] : [document.createTextNode('+'), kbd];
      }),
    );
    elements.shortcutHint.classList.remove('hidden');
  } catch (error) {
    Logger.debug('Scorciatoia non disponibile:', error.message);
  }
}

// Open Reading Mode
async function openReadingMode() {
  if (!state.currentArticle || !state.currentResults) {
    showError(I18n.t('reading.noSummary'));
    return;
  }

  const readingData = buildReadingModeData({
    article: state.currentArticle,
    results: state.currentResults,
    translation: translationState.value,
    citations: citationsState.value,
    qa: state.currentQA,
    providerValue: elements.providerSelect.value,
    selectedLanguage: state.selectedLanguage,
    selectedContentType: state.selectedContentType,
  });

  try {
    await browser.storage.local.set({ readingModeData: readingData });
  } catch (error) {
    Logger.error('Errore apertura reading mode:', error);
    showError(describeReadingModeStorageError(error));
    return;
  }

  await browser.tabs.create({ url: 'src/pages/reading-mode/reading-mode.html' });
}
