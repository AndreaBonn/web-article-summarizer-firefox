// Multi-Analysis - Results Display Module
// Handles: formatMarkdown, showAnalysisModal, closeAnalysisModal, switchTab, reopenSavedAnalysis

import { Logger } from '../../utils/core/logger.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { state } from './state.js';
import { exportPdf, exportMarkdown, sendEmail, copyContent } from './export.js';
import { submitQuestion } from './qa.js';

export function formatMarkdown(text) {
  // DOM-based approach: uses textContent for all user data (XSS-safe)
  const container = document.createElement('div');
  const paragraphs = text.split(/\n\n+/);

  paragraphs.forEach((paragraph) => {
    const lines = paragraph.split('\n');

    lines.forEach((line) => {
      // Heading h4 (###)
      const h4Match = line.match(/^### (.*)$/);
      if (h4Match) {
        const el = document.createElement('h4');
        el.textContent = h4Match[1];
        container.appendChild(el);
        return;
      }

      // Heading h3 (##)
      const h3Match = line.match(/^## (.*)$/);
      if (h3Match) {
        const el = document.createElement('h3');
        el.textContent = h3Match[1];
        container.appendChild(el);
        return;
      }

      // Empty line — skip
      if (!line.trim()) return;

      // Normal text with bold support via DOM
      const p = document.createElement('p');
      const parts = line.split(/\*\*(.*?)\*\*/g);
      parts.forEach((part, i) => {
        if (i % 2 === 1) {
          const strong = document.createElement('strong');
          strong.textContent = part;
          p.appendChild(strong);
        } else if (part) {
          p.appendChild(document.createTextNode(part));
        }
      });
      container.appendChild(p);
    });
  });

  return container.innerHTML;
}

export function showAnalysisModal() {
  if (!state.currentAnalysis) return;

  Logger.debug('showAnalysisModal - currentAnalysis:', state.currentAnalysis);

  if (state.currentAnalysis.globalSummary) {
    document.getElementById('tabSummary').innerHTML = `
      <div class="analysis-content">
        ${formatMarkdown(state.currentAnalysis.globalSummary)}
      </div>
    `;
  } else {
    document.getElementById('tabSummary').innerHTML =
      '<p class="multi-empty-message">Riassunto non generato</p>';
  }

  if (state.currentAnalysis.comparison) {
    document.getElementById('tabComparison').innerHTML = `
      <div class="analysis-content">
        ${formatMarkdown(state.currentAnalysis.comparison)}
      </div>
    `;
  } else {
    document.getElementById('tabComparison').innerHTML =
      '<p class="multi-empty-message">Confronto non generato</p>';
  }

  Logger.debug('Verifica Q&A - interactive:', state.currentAnalysis.qa?.interactive);

  if (state.currentAnalysis.qa && state.currentAnalysis.qa.interactive) {
    document.getElementById('tabQA').innerHTML = `
      <div class="qa-interactive">
        <div class="qa-chat-container" id="qaChatContainer">
          <div class="qa-welcome">
            <p><strong>Q&A Interattivo</strong></p>
            <p>Fai domande sui ${state.currentAnalysis.qa.articles?.length || state.selectedArticles.length} articoli selezionati. Il sistema risponderà basandosi esclusivamente sui loro contenuti.</p>
          </div>
        </div>
        <div class="qa-input-container">
          <input type="text" id="qaInput" placeholder="Scrivi la tua domanda..." />
          <button id="qaSubmitBtn" class="btn-primary">Invia</button>
        </div>
      </div>
    `;

    if (state.currentAnalysis.qa.questions && state.currentAnalysis.qa.questions.length > 0) {
      const chatContainer = document.getElementById('qaChatContainer');
      chatContainer.innerHTML = '';

      state.currentAnalysis.qa.questions.forEach((qa) => {
        const questionEl = document.createElement('div');
        questionEl.className = 'qa-message qa-question-msg';
        questionEl.innerHTML = `<strong>Tu:</strong> ${HtmlSanitizer.escape(qa.question)}`;
        chatContainer.appendChild(questionEl);

        const answerEl = document.createElement('div');
        answerEl.className = 'qa-message qa-answer-msg';
        answerEl.innerHTML = `<strong>Assistente:</strong> ${HtmlSanitizer.escape(qa.answer)}`;
        chatContainer.appendChild(answerEl);
      });

      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    document.getElementById('qaSubmitBtn').addEventListener('click', submitQuestion);
    document.getElementById('qaInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitQuestion();
    });
  } else {
    document.getElementById('tabQA').innerHTML =
      '<p class="multi-empty-message">Q&A non abilitato</p>';
  }

  document.getElementById('analysisModal').classList.remove('hidden');
}

export function closeAnalysisModal() {
  document.getElementById('analysisModal').classList.add('hidden');
}

export function switchTab(tabName) {
  document.querySelectorAll('.modal-tab').forEach((tab) => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });

  document.querySelectorAll('.modal-pane').forEach((pane) => {
    pane.classList.remove('active');
  });

  const tabIds = {
    summary: 'tabSummary',
    comparison: 'tabComparison',
    qa: 'tabQA',
  };

  const tabId = tabIds[tabName];
  if (tabId) {
    const tabElement = document.getElementById(tabId);
    if (tabElement) {
      tabElement.classList.add('active');
    } else {
      Logger.error('Tab element non trovato:', tabId);
    }
  }
}

export async function reopenSavedAnalysis(data) {
  Logger.info('Riapertura analisi salvata:', data);

  state.currentAnalysis = {
    id: data.id,
    timestamp: Date.now(),
    globalSummary: data.analysis.globalSummary,
    comparison: data.analysis.comparison,
    qa: data.analysis.qa,
    metadata: {
      provider: data.analysis.metadata?.provider || 'unknown',
    },
  };

  state.selectedArticles = data.articles.map((a) => a.id);
  state.allArticles = data.articles.map((a) => ({
    id: a.id,
    article: {
      title: a.title,
      url: a.url,
      wordCount: a.wordCount,
    },
  }));

  document.querySelector('.selection-panel').style.display = 'none';
  document.querySelector('.analysis-panel').style.display = 'none';

  const header = document.querySelector('header');
  header.innerHTML = `
    <h1>Analisi Multi Articolo</h1>
    <button id="backBtn" class="btn-back">← Cronologia</button>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = browser.runtime.getURL('src/pages/history/history.html');
  });

  document.getElementById('closeModal').addEventListener('click', () => {
    window.location.href = browser.runtime.getURL('src/pages/history/history.html');
  });

  document.querySelectorAll('.modal-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);
  document.getElementById('exportMdBtn').addEventListener('click', exportMarkdown);
  document.getElementById('sendEmailBtn').addEventListener('click', sendEmail);
  document.getElementById('copyBtn').addEventListener('click', copyContent);

  showAnalysisModal();
}
