// Reading Mode - Display Module
// Gestisce la visualizzazione dei contenuti (articoli, tab, highlight)

import { state, elements } from './state.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { Logger } from '../../utils/core/logger.js';
import { getProviderLabel, getLanguageLabel } from '../../utils/core/display-labels.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { CitationFormatter } from '../../utils/ai/citation-formatter.js';
import { displayPDFContent } from './display-pdf.js';
import { Modal } from '../../utils/core/modal.js';

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
    showError('Dati articolo mancanti');
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
    elements.translationTabContent.innerHTML = `
      <div class="translation-content">
        <h3>${HtmlSanitizer.escape(article.title)}</h3>
        <div class="translation-text">${HtmlSanitizer.escape(state.currentData.translation)}</div>
      </div>
    `;
  }

  // Check if citations exist
  if (state.currentData.citations) {
    Logger.debug('📚 Struttura citazioni:', state.currentData.citations);

    // Handle both structures: direct array or nested object
    const citationsList = state.currentData.citations.citations || state.currentData.citations;

    if (citationsList && citationsList.length > 0) {
      Logger.debug('📚 Lista citazioni:', citationsList);
      Logger.debug('📚 Prima citazione:', citationsList[0]);

      const totalCitations =
        state.currentData.citations.total_citations ||
        state.currentData.citations.totalCount ||
        citationsList.length;
      let html = `<div class="citations-content"><h3>📚 ${totalCitations} Citazioni Trovate</h3>`;

      citationsList.forEach((citation, index) => {
        // Use correct field names from citation structure - handle null/undefined
        const text = citation.quote_text || citation.text || citation.quote || null;
        const author = citation.author || null;
        const source = citation.source || null;
        const paragraph = citation.paragraph || null;
        const context = citation.context || null;
        const year = citation.year || null;

        // Skip if no meaningful content
        if (!text && !author && !source) {
          Logger.warn('Citazione vuota saltata:', citation);
          return;
        }

        // Type icon
        const typeIcon =
          {
            direct_quote: '💬',
            indirect_quote: '💭',
            study_reference: '🔬',
            statistic: '📊',
            expert_opinion: '👤',
            book_reference: '📖',
            article_reference: '📄',
            report_reference: '📋',
            organization_data: '🏢',
            web_source: '🌐',
          }[citation.type] || '📌';

        // Type label (delegated to CitationFormatter)
        const typeLabel = CitationFormatter.getCitationTypeLabel(citation.type);

        html += `
          <div class="citation-item">
            <div class="citation-header">
              <span class="citation-icon">${typeIcon}</span>
              <div class="citation-number">#${citation.id || index + 1}</div>
              ${author ? `<span class="citation-author-badge">${HtmlSanitizer.escape(author)}</span>` : ''}
              ${paragraph ? `<div class="citation-ref">§${HtmlSanitizer.escape(String(paragraph))}</div>` : ''}
            </div>
            ${text ? `<div class="citation-text">"${HtmlSanitizer.escape(text.substring(0, 300))}${text.length > 300 ? '...' : ''}"</div>` : '<div class="citation-text citation-no-text">Riferimento senza testo citato</div>'}
            ${context ? `<div class="citation-context">📝 ${HtmlSanitizer.escape(context)}</div>` : ''}
            <div class="citation-meta">
              <span class="citation-type">${typeLabel}</span>
              ${source ? `<span class="citation-source">📚 ${HtmlSanitizer.escape(source)}</span>` : ''}
              ${year ? `<span class="citation-year">📅 ${HtmlSanitizer.escape(String(year))}</span>` : ''}
            </div>
          </div>
        `;
      });

      html += '</div>';
      elements.citationsTabContent.innerHTML = html;
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
  // Prepare text view (always available as fallback)
  let html = `
    <div class="article-content">
      <h1>${HtmlSanitizer.escape(article.title || 'Articolo')}</h1>
      ${article.excerpt ? `<p class="article-excerpt"><em>${HtmlSanitizer.escape(article.excerpt)}</em></p>` : ''}
      <hr class="article-divider">
  `;

  // Split content into paragraphs (with safety check)
  if (article.content) {
    const paragraphs = article.content.split('\n\n');
    paragraphs.forEach((para, index) => {
      if (para.trim()) {
        html += `<p data-paragraph="${index + 1}">${HtmlSanitizer.escape(para.trim())}</p>`;
      }
    });
  } else {
    html += `<p class="content-unavailable">Contenuto non disponibile.</p>`;
  }

  html += `</div>`;
  elements.articleText.innerHTML = html;

  // Try iframe FIRST (default) — validate protocol to prevent javascript:/data: injection
  const SAFE_PROTOCOLS = ['https:', 'http:'];
  let iframeSafe = false;
  if (article.url && elements.articleIframe) {
    try {
      const parsedUrl = new URL(article.url);
      iframeSafe = SAFE_PROTOCOLS.includes(parsedUrl.protocol);
    } catch {
      iframeSafe = false;
    }
  }

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
          elements.viewIframeBtn.title = 'Iframe bloccato dal sito';
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
    elements.viewIframeBtn.title = 'URL non disponibile';
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

    // Find and highlight target paragraph
    const targetPara = elements.articleText.querySelector(`[data-paragraph="${paragraphNumber}"]`);
    if (targetPara) {
      targetPara.classList.add('highlight');
      targetPara.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Remove highlight after 3 seconds
      setTimeout(() => {
        targetPara.classList.remove('highlight');
      }, 3000);
    }
  } else {
    // In iframe view, show a message
    Modal.alert('Passa alla vista "Testo" per evidenziare i paragrafi');
  }
}

// Sync scroll position
export function syncScrollPosition(source) {
  const sourceEl = source === 'article' ? elements.articleContent : elements.summaryContent;
  const targetEl = source === 'article' ? elements.summaryContent : elements.articleContent;

  const scrollPercentage = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight);
  const targetScroll = scrollPercentage * (targetEl.scrollHeight - targetEl.clientHeight);

  targetEl.scrollTop = targetScroll;
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
    ? '<span class="cache-badge cache-badge-green">⚡ Da Cache!</span>'
    : '';

  elements.summaryTabContent.innerHTML = `
    ${cacheBadge}
    <div class="summary-text">${HtmlSanitizer.escape(summary)}</div>
  `;
}

// Display key points in tab
export function displayKeypointsInTab(keyPoints) {
  if (!keyPoints || keyPoints.length === 0) {
    elements.keypointsTabContent.innerHTML = `
      <div class="empty-state">
        <p>Nessun punto chiave disponibile</p>
      </div>
    `;
    return;
  }

  let html = '';
  keyPoints.forEach((point, index) => {
    html += `
      <div class="keypoint" data-paragraph="${HtmlSanitizer.escape(String(point.paragraphs))}">
        <div class="keypoint-header">
          <div class="keypoint-title">${index + 1}. ${HtmlSanitizer.escape(point.title)}</div>
          <div class="keypoint-ref">§${HtmlSanitizer.escape(String(point.paragraphs))}</div>
        </div>
        <div class="keypoint-desc">${HtmlSanitizer.escape(point.description)}</div>
      </div>
    `;
  });

  elements.keypointsTabContent.innerHTML = html;

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
