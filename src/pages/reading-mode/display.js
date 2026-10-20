// Reading Mode - Display Module
// Gestisce la visualizzazione dei contenuti (articoli, tab, highlight)

import { state, elements } from './state.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { Logger } from '../../utils/core/logger.js';
import { getProviderLabel, getLanguageLabel } from '../../utils/core/display-labels.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { displayPDFContent } from './display-pdf.js';
import { Modal } from '../../utils/core/modal.js';
import {
  computeSyncedScrollTop,
  findKeypointParagraphs,
  isSafeIframeUrl,
  renderArticleTextHtml,
  renderKeypointsTabHtml,
  renderReadingCitationsHtml,
} from './render.js';
import { renderTranslationHtml } from './reading-mode-history.js';

// Display content
export function displayContent() {
  if (!state.currentData) return;

  // Check if PDF
  if (state.currentData.isPDF) {
    displayPDFContent();
    return;
  }

  const { article, summary, keyPoints, metadata } = state.currentData;

  // Safety check for article
  if (!article) {
    Logger.error('Article data is missing');
    showError(I18n.t('reading.missingData'));
    return;
  }

  // Article metadata
  elements.articleWordCount.textContent = `${article.wordCount || 0} ${I18n.t('article.words')}`;
  elements.articleReadTime.textContent = `${article.readingTimeMinutes || 0} ${I18n.t('article.readingTime')}`;

  // Summary metadata
  elements.summaryProvider.textContent = metadata?.provider
    ? getProviderLabel(metadata.provider)
    : 'AI';
  elements.summaryLanguage.textContent = getLanguageLabel(
    metadata?.language || 'it',
    I18n.currentLanguage,
  );

  // Article content
  displayArticle(article);

  // Summary content in tabs
  displaySummaryInTab(summary);
  displayKeypointsInTab(keyPoints);

  // Check if translation exists
  if (state.currentData.translation) {
    elements.translationTabContent.innerHTML = renderTranslationHtml(
      article.title,
      state.currentData.translation,
    );
  }

  // Check if citations exist
  if (state.currentData.citations) {
    Logger.debug('📚 Struttura citazioni:', state.currentData.citations);

    const citationsHtml = renderReadingCitationsHtml(state.currentData.citations);
    if (citationsHtml !== null) {
      elements.citationsTabContent.innerHTML = citationsHtml;
    }
  }

  // Check if Q&A exists
  if (state.currentData.qa && state.currentData.qa.length > 0) {
    state.currentData.qa.forEach((item) => {
      const qaItem = document.createElement('div');
      qaItem.className = 'qa-item';
      qaItem.innerHTML = `
        <div class="qa-question">Q: ${HtmlSanitizer.escape(item.question)}</div>
        <div class="qa-answer">A: ${HtmlSanitizer.escape(item.answer)}</div>
      `;
      elements.qaHistory.appendChild(qaItem);
    });
  }
}

// Display article
function displayArticle(article) {
  elements.articleText.innerHTML = renderArticleTextHtml(article);

  // Try iframe FIRST (default) — validate protocol to prevent javascript:/data: injection
  const iframeSafe = Boolean(article.url && elements.articleIframe) && isSafeIframeUrl(article.url);

  if (iframeSafe) {
    elements.articleIframe.src = article.url;

    // Start with iframe view
    switchArticleView('iframe');

    // Detect if iframe fails to load
    setTimeout(() => {
      try {
        const iframeDoc =
          elements.articleIframe.contentDocument || elements.articleIframe.contentWindow.document;
        if (!iframeDoc || iframeDoc.body.innerHTML === '') {
          Logger.warn('⚠️ Iframe bloccato, switch automatico a vista testo');
          switchArticleView('text');
          elements.viewIframeBtn.disabled = true;
          elements.viewIframeBtn.title = I18n.t('reading.iframeBlocked');
        } else {
          Logger.info('✅ Iframe caricato correttamente');
        }
      } catch {
        // Cross-origin error = iframe loaded successfully
        Logger.info('✅ Iframe caricato (cross-origin)');
      }
    }, 3000);
  } else {
    // No URL = use text view
    switchArticleView('text');
    elements.viewIframeBtn.disabled = true;
    elements.viewIframeBtn.title = I18n.t('reading.urlUnavailable');
  }
}

// Highlight paragraph in article
function highlightParagraph(paragraphNumber) {
  // Only works in text view
  if (!elements.articleText.classList.contains('hidden')) {
    // Remove previous highlights
    document.querySelectorAll('.highlight').forEach((el) => {
      el.classList.remove('highlight');
    });

    // Find and highlight target paragraphs (a key point can span a range, e.g. "3-5")
    const targets = findKeypointParagraphs(elements.articleText, paragraphNumber);
    if (targets.length > 0) {
      targets.forEach((el) => el.classList.add('highlight'));
      targets[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Remove highlight after 3 seconds
      setTimeout(() => {
        targets.forEach((el) => el.classList.remove('highlight'));
      }, 3000);
    }
  } else {
    // In iframe view, show a message
    Modal.alert(I18n.t('reading.switchToTextView'));
  }
}

// Sync scroll position
export function syncScrollPosition(source) {
  const sourceEl = source === 'article' ? elements.articleContent : elements.summaryContent;
  const targetEl = source === 'article' ? elements.summaryContent : elements.articleContent;

  targetEl.scrollTop = computeSyncedScrollTop(sourceEl, targetEl);
}

// Switch summary tab
export function switchSummaryTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.summary-tab').forEach((tab) => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });

  // Update tab content
  document.querySelectorAll('.summary-tab-content').forEach((content) => {
    content.classList.remove('active');
  });

  const targetContent = document.getElementById(`${tabName}TabContent`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
}

// Display summary in tab
export function displaySummaryInTab(summary) {
  // Controlla se il PDF è dalla cache
  const isFromCache =
    state.currentData?.isFromCache || state.currentData?.metadata?.fromCache || false;
  const cacheBadge = isFromCache
    ? `<span class="cache-badge cache-badge-green">${I18n.t('reading.fromCacheBadge')}</span>`
    : '';

  elements.summaryTabContent.innerHTML = `
    ${cacheBadge}
    <div class="summary-text">${HtmlSanitizer.escape(summary)}</div>
  `;
}

// Display key points in tab
export function displayKeypointsInTab(keyPoints) {
  elements.keypointsTabContent.innerHTML = renderKeypointsTabHtml(keyPoints);
  if (!keyPoints || keyPoints.length === 0) return;

  // Add click handlers
  elements.keypointsTabContent.querySelectorAll('.keypoint').forEach((el) => {
    el.addEventListener('click', () => {
      const paragraph = el.dataset.paragraph;
      highlightParagraph(paragraph);
    });
  });
}

// Switch article view (iframe vs text)
export function switchArticleView(view) {
  if (view === 'iframe') {
    // Hide error message if present
    const errorDiv = document.querySelector('.iframe-error');
    if (errorDiv) errorDiv.remove();

    // Show iframe, hide text
    elements.articleIframe.style.display = 'block';
    elements.articleText.classList.add('hidden');

    // Update buttons
    elements.viewIframeBtn.classList.add('active');
    elements.viewTextBtn.classList.remove('active');

    // Disable sync scroll (iframe can't sync)
    state.syncScroll = false;
  } else {
    // Show text, hide iframe and error
    elements.articleIframe.style.display = 'none';
    const errorDiv = document.querySelector('.iframe-error');
    if (errorDiv) errorDiv.style.display = 'none';

    elements.articleText.classList.remove('hidden');

    // Update buttons
    elements.viewIframeBtn.classList.remove('active');
    elements.viewTextBtn.classList.add('active');

    // Enable sync scroll
    state.syncScroll = true;
  }
}

// Show error in both panels
export function showError(message) {
  const safeMessage = HtmlSanitizer.escape(message);
  elements.articleContent.innerHTML = `
    <div class="loading-state">
      <p class="error-text">❌ ${safeMessage}</p>
    </div>
  `;
  elements.summaryContent.innerHTML = `
    <div class="loading-state">
      <p class="error-text">❌ ${safeMessage}</p>
    </div>
  `;
}
