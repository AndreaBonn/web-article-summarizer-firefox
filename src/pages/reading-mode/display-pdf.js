// Reading Mode - PDF Display Module
// Gestisce la visualizzazione dei contenuti PDF (testo estratto, citazioni)

import { state, elements } from './state.js';
import { splitPdfTextSegments, describePdfMeta, renderQuotesHtml } from './pdf-text.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { Logger } from '../../utils/core/logger.js';
import { displaySummaryInTab, displayKeypointsInTab } from './display.js';

// Display PDF content
export function displayPDFContent() {
  Logger.info('📄 Rendering PDF content:', state.currentData);

  // Update header
  document.querySelector('.reading-header h1').textContent = '📄 Analisi PDF';

  // Update metadata - gestisci diverse strutture dati
  const { pageCount, filename, provider, languageLabel } = describePdfMeta(state.currentData);

  elements.articleWordCount.textContent = `${pageCount} pagine`;
  elements.articleReadTime.textContent = filename;
  elements.summaryProvider.textContent = provider;
  elements.summaryLanguage.textContent = languageLabel;

  // Left panel: Always show extracted text
  const articlePanel = document.querySelector('.article-panel .panel-header h2');
  articlePanel.textContent = '📄 Testo Estratto';

  // Hide view toggle buttons for PDF
  const viewToggle = document.querySelector('.view-toggle');
  if (viewToggle) viewToggle.style.display = 'none';

  // Show extracted text - gestisci diverse strutture dati
  const extractedText = state.currentData.extractedText || state.currentData.pdf?.text || '';
  displayExtractedText(extractedText);

  // Right panel: Show analysis
  displaySummaryInTab(state.currentData.summary);
  displayKeypointsInTab(state.currentData.keyPoints);

  // Show quotes if available
  if (state.currentData.quotes && state.currentData.quotes.length > 0) {
    displayQuotesInTab(state.currentData.quotes);
  }
}

// Display extracted text
function displayExtractedText(text) {
  const articleText = elements.articleText;
  const articleIframe = elements.articleIframe;

  // Hide iframe, show text container
  articleIframe.style.display = 'none';
  articleText.classList.remove('hidden');

  // Gestisci testo mancante o undefined
  if (!text || typeof text !== 'string') {
    articleText.innerHTML = `
      <div class="extracted-text-container">
        <div class="text-metadata">
          <p><strong>⚠️ Testo non disponibile</strong></p>
          <p class="text-meta-secondary">
            Il testo estratto non è disponibile per questo PDF.
          </p>
        </div>
      </div>
    `;
    return;
  }

  // Format text with page markers
  const formattedText = splitPdfTextSegments(text)
    .map(({ kind, value: part }) => {
      if (kind === 'page') {
        // Page number
        return `<div class="page-marker">📄 Pagina ${part}</div>`;
      } else {
        // Page content
        return `<div class="page-content">${HtmlSanitizer.escape(part).replace(/\n/g, '<br>')}</div>`;
      }
    })
    .join('');

  articleText.innerHTML = `
    <div class="extracted-text-container">
      <div class="text-metadata">
        <p><strong>Testo estratto dal PDF</strong></p>
        <p class="text-meta-secondary">
          Questo è il testo estratto automaticamente dal documento PDF.
        </p>
      </div>
      <hr class="content-divider">
      ${formattedText}
    </div>
  `;
}

// Display quotes in tab
function displayQuotesInTab(quotes) {
  if (!quotes || quotes.length === 0) return;

  const html = renderQuotesHtml(quotes);
  // Add to citations tab
  const citationsTab = document.getElementById('citationsTabContent');
  if (citationsTab) {
    citationsTab.innerHTML = html;
  }
}
