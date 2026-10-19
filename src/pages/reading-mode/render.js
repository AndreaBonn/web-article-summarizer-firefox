// Reading Mode Render - pure HTML building for citations, article text and key points
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { Logger } from '../../utils/core/logger.js';
import { CitationFormatter } from '../../utils/ai/citation-formatter.js';
import { parseParagraphRange } from '../../content/text-match.js';

const MAX_QUOTE_CHARS = 300;
const SAFE_PROTOCOLS = ['https:', 'http:'];

/**
 * Restituisce l'HTML delle citazioni, o null se non c'è nessuna lista da mostrare.
 * Accetta sia l'array diretto sia l'oggetto annidato `{ citations, total_citations }`.
 */
export function renderReadingCitationsHtml(citations) {
  if (!citations) return null;

  // Handle both structures: direct array or nested object
  const citationsList = citations.citations || citations;

  if (!(citationsList && citationsList.length > 0)) return null;

  Logger.debug('📚 Lista citazioni:', citationsList);
  Logger.debug('📚 Prima citazione:', citationsList[0]);

  const totalCitations = citations.total_citations || citations.totalCount || citationsList.length;
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

    const typeIcon = CitationFormatter.getCitationTypeIcon(citation.type);

    // Type label (delegated to CitationFormatter)
    const typeLabel = CitationFormatter.getCitationTypeLabel(citation.type);

    html += `
          <div class="citation-item">
            <div class="citation-header">
              <span class="citation-icon">${typeIcon}</span>
              <div class="citation-number">#${HtmlSanitizer.escape(String(citation.id || index + 1))}</div>
              ${author ? `<span class="citation-author-badge">${HtmlSanitizer.escape(author)}</span>` : ''}
              ${paragraph ? `<div class="citation-ref">§${HtmlSanitizer.escape(String(paragraph))}</div>` : ''}
            </div>
            ${text ? `<div class="citation-text">"${HtmlSanitizer.escape(text.substring(0, MAX_QUOTE_CHARS))}${text.length > MAX_QUOTE_CHARS ? '...' : ''}"</div>` : '<div class="citation-text citation-no-text">Riferimento senza testo citato</div>'}
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
  return html;
}

export function renderArticleTextHtml(article) {
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
  return html;
}

// Validate protocol to prevent javascript:/data: injection in the iframe src
export function isSafeIframeUrl(url) {
  try {
    return SAFE_PROTOCOLS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function computeSyncedScrollTop(source, target) {
  const scrollPercentage = source.scrollTop / (source.scrollHeight - source.clientHeight);
  return scrollPercentage * (target.scrollHeight - target.clientHeight);
}

/**
 * Paragraph elements a key point refers to: a single number or a "start-end" range.
 * The range comes from LLM output, so it is capped at the last paragraph present.
 * @param {ParentNode} container - Element holding the [data-paragraph] paragraphs
 * @param {string|number} paragraphRef - e.g. 3 or "3-5"
 * @returns {Element[]} Matching paragraphs in ascending order
 */
export function findKeypointParagraphs(container, paragraphRef) {
  const byNumber = new Map();
  container.querySelectorAll('[data-paragraph]').forEach((el) => {
    byNumber.set(Number(el.dataset.paragraph), el);
  });
  const last = Math.max(0, ...byNumber.keys());

  const found = [];
  for (const n of parseParagraphRange(paragraphRef)) {
    if (n > last) break;
    if (byNumber.has(n)) found.push(byNumber.get(n));
  }
  return found;
}

export function renderKeypointsTabHtml(keyPoints) {
  if (!keyPoints || keyPoints.length === 0) {
    return `
      <div class="empty-state">
        <p>Nessun punto chiave disponibile</p>
      </div>
    `;
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
  return html;
}
