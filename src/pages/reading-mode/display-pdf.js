// Reading Mode - PDF Display Module
// Gestisce la visualizzazione dei contenuti PDF (testo estratto, citazioni)

import { state, elements } from './state.js';
import { renderPdfPagesHtml, describePdfMeta, renderQuotesHtml } from './pdf-text.js';
import { Logger } from '../../utils/core/logger.js';
import { displaySummaryInTab, displayKeypointsInTab } from './display.js';
import { I18n } from '../../utils/i18n/i18n.js';

// Display PDF content
export function displayPDFContent() {
  Logger.info('📄 Rendering PDF content:', state.currentData);

  // Update header
  document.querySelector('.reading-header h1').textContent = I18n.t('reading.pdfAnalysisTitle');

  // Update metadata - gestisci diverse strutture dati
  const { pageCount, filename, provider, languageLabel } = describePdfMeta(state.currentData);

  elements.articleWordCount.textContent = I18n.tf('reading.pdfPages', { count: pageCount });
  elements.articleReadTime.textContent = filename;
  elements.summaryProvider.textContent = provider;
  elements.summaryLanguage.textContent = languageLabel;

  // Left panel: Always show extracted text
  const articlePanel = document.querySelector('.article-panel .panel-header h2');
  articlePanel.textContent = I18n.t('reading.extractedTextTitle');

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
          <p><strong>${I18n.t('reading.pdfTextUnavailable')}</strong></p>
          <p class="text-meta-secondary">
            ${I18n.t('reading.pdfTextUnavailableDesc')}
          </p>
        </div>
      </div>
    `;
    return;
  }

  // Format text with page markers
  const formattedText = renderPdfPagesHtml(text);

  articleText.innerHTML = `
    <div class="extracted-text-container">
      <div class="text-metadata">
        <p><strong>${I18n.t('reading.pdfTextHeading')}</strong></p>
        <p class="text-meta-secondary">
          ${I18n.t('reading.pdfTextDesc')}
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
