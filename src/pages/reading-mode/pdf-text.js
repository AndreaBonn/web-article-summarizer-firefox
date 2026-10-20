import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { I18n } from '../../utils/i18n/i18n.js';

/**
 * Splits extracted PDF text on "--- Pagina N ---" markers.
 * split() with a capture group yields [preamble, N, content, N, content, ...]:
 * position decides the kind, so blank parts must be dropped without shifting it.
 * @param {string} text
 * @returns {Array<{kind: 'page'|'content', value: string}>}
 */
export function splitPdfTextSegments(text) {
  const segments = [];
  text.split(/--- Pagina (\d+) ---/).forEach((part, index) => {
    const isPageNumber = index % 2 === 1;
    if (isPageNumber) segments.push({ kind: 'page', value: part });
    else if (part.trim()) segments.push({ kind: 'content', value: part });
  });
  return segments;
}

/**
 * HTML of the extracted PDF text with one marker per page.
 * @param {string} text
 * @returns {string} Escaped HTML
 */
export function renderPdfPagesHtml(text) {
  return splitPdfTextSegments(text)
    .map(({ kind, value }) =>
      kind === 'page'
        ? `<div class="page-marker">${HtmlSanitizer.escape(I18n.tf('reading.pageMarker', { page: value }))}</div>`
        : `<div class="page-content">${HtmlSanitizer.escape(value).replace(/\n/g, '<br>')}</div>`,
    )
    .join('');
}

export function describePdfMeta(data) {
  const pageCount = data.pageCount || data.pdf?.pages || 0;
  const filename = data.filename || data.pdf?.name || 'PDF';
  const provider = data.apiProvider || data.metadata?.provider || 'AI';
  const language = data.metadata?.language || 'it';

  return {
    pageCount,
    filename,
    provider,
    languageLabel: language === 'it' ? 'Italiano' : language.toUpperCase(),
  };
}

export function renderQuotesHtml(quotes) {
  let html = `<div class="quotes-content"><h3>${HtmlSanitizer.escape(I18n.t('reading.importantQuotes'))}</h3>`;

  quotes.forEach((quote, index) => {
    html += `
      <div class="quote-item">
        <div class="quote-number">${index + 1}</div>
        <div class="quote-text">"${HtmlSanitizer.escape(quote)}"</div>
      </div>
    `;
  });

  html += '</div>';

  return html;
}
