// Shared Export Formatters
// Funzioni pure per formattare dati in testo — nessun accesso a state, DOM o chrome APIs

const SEPARATOR = '='.repeat(60);

export function formatSummaryWithKeyPointsText(summary, keyPoints) {
  let text = `RIASSUNTO:\n${summary}\n\n`;
  text += `PUNTI CHIAVE:\n`;
  keyPoints.forEach((point, index) => {
    text += `${index + 1}. ${point.title} (§${point.paragraphs})\n   ${point.description}\n\n`;
  });
  return text;
}

/**
 * Formatta citazioni come testo per clipboard/email.
 * @param {Array} citations - Array di oggetti citazione (con author, year, source, quote_text)
 * @returns {string} Testo formattato con sezione CITAZIONI
 */
export function formatCitationsText(citations) {
  if (!citations || citations.length === 0) return '';

  let text = `${SEPARATOR}\n\n`;
  text += `CITAZIONI (${citations.length}):\n\n`;

  citations.forEach((citation, index) => {
    text += `[${index + 1}] `;
    if (citation.author) text += `${citation.author} `;
    if (citation.year) text += `(${citation.year}) `;
    if (citation.source) text += `- ${citation.source}`;
    text += `\n`;
    if (citation.quote_text) text += `   "${citation.quote_text}"\n`;
    text += `\n`;
  });

  return text;
}

/**
 * Formatta Q&A come testo per clipboard/email.
 * @param {Array} qaArray - Array di oggetti {question, answer}
 * @returns {string} Testo formattato con sezione DOMANDE E RISPOSTE
 */
export function formatQAText(qaArray) {
  if (!qaArray || qaArray.length === 0) return '';

  let text = `${SEPARATOR}\n\n`;
  text += `DOMANDE E RISPOSTE:\n\n`;

  qaArray.forEach((qa, index) => {
    text += `Q${index + 1}: ${qa.question}\n`;
    text += `R${index + 1}: ${qa.answer}\n\n`;
  });

  return text;
}

/**
 * Formatta traduzione come testo per clipboard/email.
 * Gestisce sia stringa semplice che oggetto con proprietà .text.
 * @param {string|Object} translation - Testo traduzione o oggetto {text: string}
 * @returns {string} Testo formattato con sezione TRADUZIONE
 */
export function formatTranslationText(translation) {
  if (!translation) return '';

  const translationText = typeof translation === 'string' ? translation : translation.text;
  if (!translationText) return '';

  return `${SEPARATOR}\n\nTRADUZIONE:\n${translationText}\n\n`;
}

/**
 * Formatta punti chiave come testo per clipboard/email.
 * @param {Array} keyPoints - Array di {title, paragraphs, description}
 * @param {boolean} [includeParagraphs=false] - Includi riferimento paragrafi (§N)
 * @returns {string} Testo formattato con sezione PUNTI CHIAVE
 */
export function formatKeyPointsText(keyPoints, includeParagraphs = false) {
  if (!keyPoints || keyPoints.length === 0) return '';

  let text = `PUNTI CHIAVE:\n`;

  keyPoints.forEach((point, index) => {
    if (includeParagraphs && point.paragraphs) {
      text += `${index + 1}. ${point.title} (§${point.paragraphs})\n`;
    } else {
      text += `${index + 1}. ${point.title}\n`;
    }
    text += `   ${point.description}\n\n`;
  });

  return text;
}
