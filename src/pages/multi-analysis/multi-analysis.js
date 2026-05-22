// Multi-Analysis Page Script — Controller
// Orchestrates selection, analysis, and results modules

import { Logger } from '../../utils/core/logger.js';
import { ThemeManager } from '../../utils/core/theme-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { MultiAnalysisManager } from '../../utils/core/multi-analysis-manager.js';
import { Modal } from '../../utils/core/modal.js';
import { ErrorHandler } from '../../utils/core/error-handler.js';
import { state } from './state.js';
import { exportPdf, exportMarkdown, sendEmail, copyContent } from './export.js';
import { loadArticles, selectAll, clearSelection, filterArticles } from './selection.js';
import {
  showAnalysisModal,
  closeAnalysisModal,
  switchTab,
  reopenSavedAnalysis,
} from './results.js';

document.addEventListener('DOMContentLoaded', async () => {
  Logger.info('Multi-Analysis: DOMContentLoaded');

  await I18n.initPage();

  // Controlla se stiamo riaprendo un'analisi salvata
  const result = await browser.storage.local.get(['reopenMultiAnalysis']);
  if (result.reopenMultiAnalysis) {
    await reopenSavedAnalysis(result.reopenMultiAnalysis);
    await browser.storage.local.remove(['reopenMultiAnalysis']);
    return;
  }

  await loadArticles();

  const startBtn = document.getElementById('startAnalysisBtn');

  document.getElementById('backBtn').addEventListener('click', () => {
    window.close();
  });

  document.getElementById('selectAllBtn').addEventListener('click', selectAll);
  document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);
  document.getElementById('searchArticles').addEventListener('input', filterArticles);
  document.getElementById('filterProvider').addEventListener('change', filterArticles);

  if (startBtn) {
    startBtn.addEventListener('click', () => startAnalysis());
  }

  document.getElementById('closeModal').addEventListener('click', closeAnalysisModal);

  document.querySelectorAll('.modal-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);
  document.getElementById('exportMdBtn').addEventListener('click', exportMarkdown);
  document.getElementById('sendEmailBtn').addEventListener('click', sendEmail);
  document.getElementById('copyBtn').addEventListener('click', copyContent);
});

// --- Analysis orchestration ---

async function startAnalysis() {
  if (state.selectedArticles.length < 2) {
    await Modal.alert(I18n.t('multi.minArticles'), I18n.t('multi.minArticlesTitle'), '⚠️');
    return;
  }

  const options = {
    globalSummary: document.getElementById('optGlobalSummary').checked,
    comparison: document.getElementById('optComparison').checked,
    qa: document.getElementById('optQA').checked,
  };

  if (!options.globalSummary && !options.comparison && !options.qa) {
    await Modal.alert(I18n.t('multi.minOptions'), I18n.t('multi.minOptionsTitle'), '⚠️');
    return;
  }

  const articles = state.selectedArticles.map((id) => state.allArticles.find((a) => a.id === id));

  showProgress(I18n.t('multi.checkingCorrelation'), 10);

  const correlationResult = await MultiAnalysisManager.checkArticlesRelation(articles);

  if (!correlationResult.related) {
    hideProgress();
    const choice = await showUnrelatedModal(correlationResult.reason);

    if (choice === 'cancel') return;
    if (choice === 'qaOnly') {
      options.globalSummary = false;
      options.comparison = false;
      options.qa = true;
    }
  }

  try {
    showProgress(I18n.t('multi.startingAnalysis'), 20);
    state.currentAnalysis = await MultiAnalysisManager.analyzeArticles(
      articles,
      options,
      showProgress,
    );
    hideProgress();

    try {
      const analysisId = await HistoryManager.saveMultiAnalysis(state.currentAnalysis, articles);
      state.currentAnalysis.id = analysisId;
      Logger.info('Analisi salvata nella cronologia con ID:', analysisId);
    } catch (saveError) {
      Logger.error('Errore nel salvataggio cronologia:', saveError);
    }

    showAnalysisModal();
  } catch (error) {
    Logger.error('Errore analisi:', error);
    hideProgress();
    await Modal.alert(
      I18n.t('multi.analysisError') + ' ' + ErrorHandler.getErrorMessage(error),
      I18n.t('multi.errorTitle'),
      '❌',
    );
  }
}

function showProgress(message, percent) {
  document.getElementById('progressMessage').textContent = message;
  document.getElementById('progressFill').style.width = percent + '%';
  document.getElementById('progressPercent').textContent = Math.round(percent) + '%';
  document.getElementById('progressModal').classList.remove('hidden');
}

function hideProgress() {
  document.getElementById('progressModal').classList.add('hidden');
}

function showUnrelatedModal(reason = null) {
  return new Promise((resolve) => {
    const modal = document.getElementById('unrelatedModal');
    const reasonEl = document.getElementById('unrelatedReason');

    if (reason) {
      reasonEl.textContent = reason;
      reasonEl.style.display = 'block';
    } else {
      reasonEl.style.display = 'none';
    }

    modal.classList.remove('hidden');

    const controller = new AbortController();
    const { signal } = controller;

    const handleChoice = (choice) => {
      modal.classList.add('hidden');
      controller.abort();
      resolve(choice);
    };

    document
      .getElementById('unrelatedQAOnly')
      .addEventListener('click', () => handleChoice('qaOnly'), { signal });
    document
      .getElementById('unrelatedFullAnalysis')
      .addEventListener('click', () => handleChoice('full'), { signal });
    document
      .getElementById('unrelatedCancel')
      .addEventListener('click', () => handleChoice('cancel'), { signal });
  });
}

// Theme managed by ThemeManager (auto-init on import)
(() => {
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => ThemeManager.toggle());
  }
})();
