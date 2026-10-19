// Popup Citations Render - pure HTML building and highlight strategy for citations
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { CitationFormatter } from '../../utils/ai/citation-formatter.js';

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
        <strong>📚 ${totalCitations} citazioni trovate</strong>
      </div>
      <div class="citations-actions">
        <select id="citationStyleSelect" class="citation-style-select" title="Stile bibliografico per la citazione dell'articolo principale">
          <option value="apa">APA (Autore. (Anno). Titolo.)</option>
          <option value="mla">MLA (Autore. "Titolo.")</option>
          <option value="chicago">Chicago (Autore. "Titolo.")</option>
          <option value="ieee">IEEE (Autore, "Titolo,")</option>
          <option value="harvard">Harvard (Autore (Anno) Titolo.)</option>
        </select>
        <button id="copyCitationsBtn" class="btn-icon" title="Copia Bibliografia">📋</button>
      </div>
    </div>

    <div class="article-citation-box">
      <h4>📄 Citazione Articolo Principale</h4>
      <p class="citation-style-hint">Lo stile selezionato sopra si applica a questa citazione</p>
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
      <div class="citation-item"
           data-citation-id="${HtmlSanitizer.escape(String(citation.id))}"
           data-citation-text="${escapedText}"
           data-paragraph="${safeParagraph}"
           class="citation-item-clickable"
           title="Clicca per evidenziare nell'articolo">
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
