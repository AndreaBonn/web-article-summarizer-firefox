// Popup shared state — imported by all popup modules
// Properties are mutated at runtime, the object reference stays the same.
import { I18n } from '../../utils/i18n/i18n.js';
import { ErrorHandler } from '../../utils/core/error-handler.js';
import { getProviderLabel } from '../../utils/core/display-labels.js';

export const state = {
  currentArticle: null,
  currentResults: null,
  selectedLanguage: 'it',
  selectedContentType: 'auto',
  currentQA: [],
  progressTracker: null,
  configuredProviders: [],
};

// DOM element references — populated by initElements() after DOMContentLoaded
export const elements = {};

const STATE_VIEWS = ['setup', 'initial', 'loading', 'error', 'results'];

export function initElements() {
  Object.assign(elements, {
    // States
    setupState: document.getElementById('setupState'),
    initialState: document.getElementById('initialState'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    resultsState: document.getElementById('resultsState'),

    // Article info
    articleInfo: document.getElementById('articleInfo'),
    articleTitle: document.getElementById('articleTitle'),
    articleStats: document.getElementById('articleStats'),
    currentPageTitle: document.getElementById('currentPageTitle'),

    // Controls
    providerSelect: document.getElementById('providerSelect'),
    languageSelect: document.getElementById('languageSelect'),
    contentTypeSelect: document.getElementById('contentTypeSelect'),
    customizeDetails: document.getElementById('customizeDetails'),
    addProviderBtn: document.getElementById('addProviderBtn'),
    shortcutHint: document.getElementById('shortcutHint'),
    shortcutKeys: document.getElementById('shortcutKeys'),

    // Setup
    setupKeyInput: document.getElementById('setupKeyInput'),
    setupSaveBtn: document.getElementById('setupSaveBtn'),
    setupStatus: document.getElementById('setupStatus'),
    setupOtherBtn: document.getElementById('setupOtherBtn'),

    // Buttons
    analyzeBtn: document.getElementById('analyzeBtn'),
    retryBtn: document.getElementById('retryBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    historyBtn: document.getElementById('historyBtn'),
    multiAnalysisBtn: document.getElementById('multiAnalysisBtn'),
    pdfAnalysisBtn: document.getElementById('pdfAnalysisBtn'),
    readingModeBtn: document.getElementById('readingModeBtn'),
    copyBtn: document.getElementById('copyBtn'),
    newBtn: document.getElementById('newBtn'),
    exportMenuBtn: document.getElementById('exportMenuBtn'),
    exportMenu: document.getElementById('exportMenu'),
    exportPdfBtn: document.getElementById('exportPdfBtn'),
    exportMdBtn: document.getElementById('exportMdBtn'),
    sendEmailBtn: document.getElementById('sendEmailBtn'),
    askBtn: document.getElementById('askBtn'),

    // Error
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage'),
    errorConfigureBtn: document.getElementById('errorConfigureBtn'),
    errorOtherProviderBtn: document.getElementById('errorOtherProviderBtn'),
    errorPdfBtn: document.getElementById('errorPdfBtn'),

    // Content
    loadingText: document.getElementById('loadingText'),
    summaryContent: document.getElementById('summaryContent'),
    keypointsContent: document.getElementById('keypointsContent'),
    translationContent: document.getElementById('translationContent'),

    // Q&A
    questionInput: document.getElementById('questionInput'),
    qaAnswer: document.getElementById('qaAnswer'),

    // Translation
    translateBtn: document.getElementById('translateBtn'),

    // Citations
    extractCitationsBtn: document.getElementById('extractCitationsBtn'),
    citationsContent: document.getElementById('citationsContent'),
  });
}

// UI state helpers — used by multiple modules
export function showState(stateName) {
  STATE_VIEWS.forEach((name) => {
    elements[`${name}State`].classList.toggle('hidden', name !== stateName);
  });
  elements.articleInfo.classList.toggle('hidden', stateName !== 'results');
  if (stateName === 'results' || stateName === 'initial' || stateName === 'setup') {
    I18n.updateUI();
  }
}

export function getSummaryLength() {
  return document.querySelector('input[name="summaryLength"]:checked')?.value || 'detailed';
}

/**
 * Error state with the recovery action that matches the error kind,
 * instead of a modal that only offers "OK".
 */
export async function presentError(error, context = '') {
  const kind = ErrorHandler.classifyError(error);
  const provider = getProviderLabel(elements.providerSelect.value);

  const copy = {
    missing_key: {
      title: I18n.tf('error.title.missingKey', { provider }),
      message: I18n.t('error.missingKeyDetail'),
    },
    unsupported_page: {
      title: I18n.t('error.title.unsupported'),
      message: I18n.t('error.unsupportedDetail'),
    },
    page_unreachable: {
      title: I18n.t('error.title.unreachable'),
      message: I18n.t('error.unreachableDetail'),
    },
    generic: {
      title: I18n.t('error.title.generic'),
      message: ErrorHandler.getErrorMessage(error),
    },
  }[kind];

  elements.errorTitle.textContent = copy.title;
  elements.errorMessage.textContent = copy.message;
  elements.errorConfigureBtn.classList.toggle('hidden', kind !== 'missing_key');
  const otherReady = state.configuredProviders.some((p) => p !== elements.providerSelect.value);
  elements.errorOtherProviderBtn.classList.toggle('hidden', kind !== 'missing_key' || !otherReady);
  elements.errorPdfBtn.classList.toggle('hidden', kind !== 'unsupported_page');
  elements.retryBtn.classList.toggle('hidden', kind === 'unsupported_page');
  elements.errorState.querySelector('.error-box').dataset.kind = kind;

  showState('error');
  await ErrorHandler.logError(error, context);
}

export function showError(message) {
  elements.errorTitle.textContent = I18n.t('error.title.generic');
  elements.errorMessage.textContent = message;
  elements.errorConfigureBtn.classList.add('hidden');
  elements.errorOtherProviderBtn.classList.add('hidden');
  elements.errorPdfBtn.classList.add('hidden');
  elements.retryBtn.classList.remove('hidden');
  showState('error');
}
