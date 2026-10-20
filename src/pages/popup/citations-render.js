// Popup Citations Render - pure HTML building and highlight strategy for citations
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { CitationFormatter } from '../../utils/ai/citation-formatter.js';
import { I18n } from '../../utils/i18n/i18n.js';

const MAX_QUOTE_CHARS = 200;

export function resolveTotalCitations(citationsData) {
  return (
    citationsData.total_citations || citationsData.totalCount || citationsData.citations.length
  );
}

export function renderCitationsHtml(citationsData) {
  const totalCitations = resolveTotalCitations(citationsData);

  let html = `
    <div class="citations-header">
      <div class="citations-info">
        <strong>${HtmlSanitizer.escape(I18n.tf('citations.foundCount', { count: totalCitations }))}</strong>
      </div>
      <div class="citations-actions">
        <select id="citationStyleSelect" class="citation-style-select" title="${HtmlSanitizer.escape(I18n.t('citations.styleTitle'))}">
          <option value="apa">${HtmlSanitizer.escape(I18n.t('citations.styleApa'))}</option>
          <option value="mla">${HtmlSanitizer.escape(I18n.t('citations.styleMla'))}</option>
          <option value="chicago">${HtmlSanitizer.escape(I18n.t('citations.styleChicago'))}</option>
          <option value="ieee">${HtmlSanitizer.escape(I18n.t('citations.styleIeee'))}</option>
          <option value="harvard">${HtmlSanitizer.escape(I18n.t('citations.styleHarvard'))}</option>
        </select>
        <button id="copyCitationsBtn" class="btn-icon" title="${HtmlSanitizer.escape(I18n.t('citations.copyTitle'))}">📋</button>
      </div>
    </div>

    <div class="article-citation-box">
      <h4>${HtmlSanitizer.escape(I18n.t('citations.mainArticle'))}</h4>
      <p class="citation-style-hint">${HtmlSanitizer.escape(I18n.t('citations.styleHint'))}</p>
      <div id="mainCitationText" class="citation-text"></div>
    </div>

    <div class="citations-list">
  `;

  citationsData.citations.forEach((citation) => {
    const typeIcon = CitationFormatter.getCitationTypeIcon(citation.type);

    // Usa quote_text dalla nuova struttura (contenuto sanitizzato)
    const quoteText = citation.quote_text || citation.text || '';
    const escapedText = HtmlSanitizer.escape(quoteText);
    const safeAuthor = HtmlSanitizer.escape(citation.author || '');
    const safeContext = HtmlSanitizer.escape(citation.context || '');
    const safeSource = HtmlSanitizer.escape(citation.source || '');
    const safeParagraph = HtmlSanitizer.escape(String(citation.paragraph || ''));

    html += `
      <div class="citation-item citation-item-clickable"
           data-citation-id="${HtmlSanitizer.escape(String(citation.id))}"
           data-citation-text="${escapedText}"
           data-paragraph="${safeParagraph}"
           title="${HtmlSanitizer.escape(I18n.t('citations.highlightTitle'))}">
        <div class="citation-header">
          <span class="citation-icon">${typeIcon}</span>
          <span class="citation-number">#${HtmlSanitizer.escape(String(citation.id))}</span>
          ${citation.author ? `<span class="citation-author">${safeAuthor}</span>` : ''}
          ${citation.paragraph ? `<span class="citation-paragraph">§${safeParagraph}</span>` : ''}
        </div>
        ${quoteText ? `<div class="citation-text">"${HtmlSanitizer.escape(quoteText.substring(0, MAX_QUOTE_CHARS))}${quoteText.length > MAX_QUOTE_CHARS ? '...' : ''}"</div>` : ''}
        ${citation.context ? `<div class="citation-context">${safeContext}</div>` : ''}
        <div class="citation-meta">
          <span class="citation-type">${CitationFormatter.getCitationTypeLabel(citation.type)}</span>
          ${citation.source ? `<span class="citation-source">📚 ${safeSource}</span>` : ''}
          ${citation.year ? `<span class="citation-year">📅 ${HtmlSanitizer.escape(String(citation.year || ''))}</span>` : ''}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

/**
 * Evidenzia una citazione: prima il testo, il paragrafo solo come fallback.
 * Le funzioni di evidenziazione arrivano come dipendenze.
 */
export async function highlightCitation(
  { citationText, paragraph },
  { highlightText, highlightParagraph },
) {
  if (citationText) {
    const success = await highlightText(citationText);

    // Se non trova il testo, prova con il paragrafo come fallback
    if (!success && paragraph) {
      await highlightParagraph(paragraph);
    }
  }
  // Fallback: usa solo il paragrafo se non c'è testo
  else if (paragraph) {
    await highlightParagraph(paragraph);
  }
}
