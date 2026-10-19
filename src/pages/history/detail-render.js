import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { CitationExtractor } from '../../utils/ai/citation-extractor.js';
import { formatSummaryWithKeyPointsText } from '../../shared/export-formatters.js';
import { getTranslationText } from '../../shared/translation-text.js';

export function renderDetailKeypointsHtml(keyPoints) {
  const keypointsHtml = keyPoints
    .map(
      (point, index) => `
    <div class="keypoint-modal">
      <div class="keypoint-modal-title">${index + 1}. ${HtmlSanitizer.escape(point.title)}</div>
      <div class="keypoint-modal-ref">§${HtmlSanitizer.escape(String(point.paragraphs))}</div>
      <div class="keypoint-modal-desc">${HtmlSanitizer.escape(point.description)}</div>
    </div>
  `,
    )
    .join('');
  return keypointsHtml;
}

export function renderTranslationHtml(translation) {
  const text = getTranslationText(translation);
  if (text) {
    const info =
      typeof translation === 'object'
        ? `<div class="translation-info-modal">
        Tradotto da ${HtmlSanitizer.escape(translation.originalLanguage)} a ${HtmlSanitizer.escape(translation.targetLanguage)}
      </div>`
        : '';
    return `
      ${info}
      <div class="translation-text">${HtmlSanitizer.escape(text)}</div>
    `;
  } else {
    return `
      <p class="modal-empty-state">
        Nessuna traduzione disponibile per questo riassunto
      </p>
    `;
  }
}

export function renderQAHtml(qa) {
  if (qa && qa.length > 0) {
    let qaHtml = '';
    qa.forEach((item, index) => {
      qaHtml += `
        <div class="qa-item">
          <div class="qa-question">
            <strong>Q${index + 1}:</strong> ${HtmlSanitizer.escape(item.question)}
          </div>
          <div class="qa-answer">
            <strong>R${index + 1}:</strong> ${HtmlSanitizer.escape(item.answer)}
          </div>
        </div>
      `;
    });
    return qaHtml;
  } else {
    return `
      <p class="modal-empty-state">
        Nessuna domanda e risposta disponibile per questo riassunto
      </p>
    `;
  }
}

export function renderCitationsHtml(entry) {
  if (entry.citations && entry.citations.citations && entry.citations.citations.length > 0) {
    let citationsHtml = `
      <div class="citations-info">
        <strong>${entry.citations.total_citations || entry.citations.citations.length} citazioni trovate</strong>
      </div>

      <div class="article-citation-box-detail">
        <h4>Citazione Articolo Principale (APA)</h4>
        <div class="article-citation-monospace">
          ${CitationExtractor.formatCitation(entry.article, 'apa')}
        </div>
      </div>

      <div class="citations-list-detail">
    `;

    entry.citations.citations.forEach((citation) => {
      const typeIcon =
        {
          direct_quote: '›',
          reference: '§',
          statistic: '#',
          source: '→',
        }[citation.type] || '•';

      citationsHtml += `
        <div class="citation-item-detail">
          <div class="citation-item-header">
            <span class="citation-type-icon">${typeIcon}</span>
            <span class="citation-id-badge">#${HtmlSanitizer.escape(String(citation.id))}</span>
            ${citation.author ? `<span class="citation-author">${HtmlSanitizer.escape(citation.author)}</span>` : ''}
          </div>
          ${citation.text ? `<div class="citation-quote-text">"${HtmlSanitizer.escape(citation.text)}"</div>` : ''}
          <div class="citation-context-text">${HtmlSanitizer.escape(citation.context)}</div>
        </div>
      `;
    });

    citationsHtml += `</div>`;
    return citationsHtml;
  } else {
    return `
      <p class="modal-empty-state">
        Nessuna citazione disponibile per questo riassunto
      </p>
    `;
  }
}

export function buildDetailCopyText(entry) {
  let text = formatSummaryWithKeyPointsText(entry.summary, entry.keyPoints);

  // Aggiungi traduzione se presente
  const translationText = getTranslationText(entry.translation);
  if (translationText) {
    text += `\n${'='.repeat(50)}\n\n`;
    text += `TRADUZIONE:\n${translationText}\n`;
  }

  // Aggiungi Q&A se presenti
  if (entry.qa && entry.qa.length > 0) {
    text += `\n${'='.repeat(50)}\n\n`;
    text += `DOMANDE E RISPOSTE:\n\n`;
    entry.qa.forEach((qa, index) => {
      text += `Q${index + 1}: ${qa.question}\n`;
      text += `R${index + 1}: ${qa.answer}\n\n`;
    });
  }

  // Aggiungi citazioni se presenti
  if (entry.citations && entry.citations.citations && entry.citations.citations.length > 0) {
    text += `\n${'='.repeat(50)}\n\n`;
    text += `CITAZIONI E BIBLIOGRAFIA:\n\n`;
    // Usa stile APA di default per la copia
    text += CitationExtractor.generateBibliography(entry.article, entry.citations.citations, 'apa');
  }
  return text;
}

export function prepareNotes(raw) {
  let textareaValue = raw;
  if (textareaValue.length > 10000) {
    textareaValue = textareaValue.substring(0, 10000);
  }
  const notes = textareaValue.trim();
  return { textareaValue, notes: notes || null };
}
