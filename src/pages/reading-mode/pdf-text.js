import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';

export function splitPdfTextSegments(text) {
  return text
    .split(/--- Pagina (\d+) ---/)
    .filter((part) => part.trim())
    .map((part, index) => ({ kind: index % 2 === 0 ? 'page' : 'content', value: part }));
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
  let html = '<div class="quotes-content"><h3>💬 Citazioni Importanti</h3>';

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
