// Reading Mode - pure helpers for translation/citations rendering and history updates

import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';

/**
 * Text of a PDF entry, whichever structure holds it.
 * @param {Object} data - Reading mode data
 * @returns {string|undefined} extractedText, falling back to pdf.text
 */
export function resolvePdfText(data) {
  return data.extractedText || data.pdf?.text;
}

/**
 * Builds the updated history entry: new values win, existing ones are kept otherwise.
 * @param {Object} existing - Entry already in history
 * @param {Object} data - Reading mode data with translation/citations/qa
 * @param {number} now - Timestamp to assign
 * @returns {Object} New entry (inputs are not mutated)
 */
export function mergeHistoryEntryUpdate(existing, data, now) {
  return {
    ...existing,
    translation: data.translation || existing.translation,
    citations: data.citations || existing.citations,
    qa: data.qa || existing.qa,
    timestamp: now,
  };
}

/**
 * Applies the reading mode data to the history entry with the same article URL.
 * @param {Array} history - Article history
 * @param {Object} data - Reading mode data (data.article.url identifies the entry)
 * @param {number} now - Timestamp to assign
 * @returns {{history: Array, found: boolean}} New array when found, same array otherwise
 */
export function applyArticleUpdate(history, data, now) {
  const existingIndex = history.findIndex(
    (item) => item.article && item.article.url === data.article.url,
  );

  if (existingIndex < 0) return { history, found: false };

  const updated = [...history];
  updated[existingIndex] = mergeHistoryEntryUpdate(history[existingIndex], data, now);
  return { history: updated, found: true };
}

/**
 * HTML of the translation tab content.
 * @param {string} title - Article or file title
 * @param {string} translation - Translated text
 * @returns {string} Escaped HTML, newlines turned into <br>
 */
export function renderTranslationHtml(title, translation) {
  return `
      <div class="translation-content">
        <h3>${HtmlSanitizer.escape(title)}</h3>
        <div class="translation-text">${HtmlSanitizer.escape(translation).replace(/\n/g, '<br>')}</div>
      </div>
    `;
}

/**
 * HTML of the citations tab content.
 * @param {Object|null|undefined} citations - Extraction result with a citations array
 * @returns {string} HTML list, or the empty message
 */
export function renderExtractedCitationsHtml(citations) {
  let html = '<div class="citations-content">';

  if (citations && citations.citations && citations.citations.length > 0) {
    const totalCitations =
      citations.total_citations || citations.totalCount || citations.citations.length;
    html += `<h3>${totalCitations} Citazioni Trovate</h3>`;

    citations.citations.forEach((citation, index) => {
      // Estrai i campi per questa citazione
      const text = citation.quote_text || citation.text || citation.quote || null;
      const author = citation.author || null;

      html += `
          <div class="citation-item">
            <div class="citation-number">[${index + 1}]</div>
            <div class="citation-text">${HtmlSanitizer.escape(text || 'Testo citazione non disponibile')}</div>
            ${author ? `<div class="citation-author">— ${HtmlSanitizer.escape(author)}</div>` : ''}
            ${citation.paragraph ? `<div class="citation-ref">§${HtmlSanitizer.escape(String(citation.paragraph))}</div>` : ''}
          </div>
        `;
    });
  } else {
    html += '<p>Nessuna citazione trovata in questo articolo</p>';
  }

  html += '</div>';
  return html;
}
