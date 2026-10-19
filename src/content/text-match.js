const MIN_PARAGRAPH_LENGTH = 20;

export function isSubstantialParagraph(text) {
  return text.length > MIN_PARAGRAPH_LENGTH;
}

/**
 * Yields the paragraph numbers referenced by a key point ("3-5" or 7).
 * Lazy on purpose: the range comes from LLM output, so an absurd bound such as
 * "1-99999999999" must not be materialized as an array.
 *
 * @param {string|number} paragraphNumber - Single number or "start-end" range
 * @returns {Generator<number>}
 */
export function* parseParagraphRange(paragraphNumber) {
  if (typeof paragraphNumber === 'string' && paragraphNumber.includes('-')) {
    const [start, end] = paragraphNumber.split('-').map((n) => parseInt(n));
    for (let i = start; i <= end; i++) {
      yield i;
    }
  } else {
    yield parseInt(paragraphNumber);
  }
}

const QUOTE_CHARS = /["\u201C\u201D'\u2018\u2019\u00AB\u00BB]/g;

// Same-length fold: quotes map 1:1, so indexes stay valid on the raw text
const foldQuotes = (text) => text.toLowerCase().replace(QUOTE_CHARS, '"');

export const normalizeQuoteText = (text) => {
  return foldQuotes(text)
    .replace(/\s+/g, ' ') // Normalizza spazi
    .trim();
};

export function classifyNodeMatch(textNormalized, searchText, searchNormalized) {
  // Match esatto (normalizzato)
  if (textNormalized.includes(searchNormalized)) {
    return {
      searchText: searchText,
      exact: true,
    };
  }
  // Match parziale (prime 30 parole o 150 caratteri)
  else if (searchText.length > 150) {
    const searchStart = searchNormalized.substring(0, 150);
    if (textNormalized.includes(searchStart)) {
      return {
        searchText: searchText.substring(0, 150),
        exact: false,
      };
    }
  }
  // Match per parole chiave (se il testo è molto lungo)
  else if (searchText.length > 50) {
    // Estrai le prime 5 parole significative
    const keywords = searchNormalized
      .split(' ')
      .filter((w) => w.length > 4)
      .slice(0, 5);

    let keywordMatches = 0;
    for (const keyword of keywords) {
      if (textNormalized.includes(keyword)) {
        keywordMatches++;
      }
    }

    // Se troviamo almeno 3 keyword match, probabilmente è il testo giusto
    if (keywordMatches >= Math.min(3, keywords.length)) {
      return {
        searchText: searchText,
        exact: false,
        keywordMatch: true,
      };
    }
  }
  return null;
}

export function locateHighlightSpan(text, textToHighlight) {
  const textNormalized = normalizeQuoteText(text);
  const searchNormalized = normalizeQuoteText(textToHighlight);
  const index = textNormalized.indexOf(searchNormalized);

  if (index !== -1) {
    // Trova l'indice nel testo originale (non normalizzato)
    // Questo è approssimativo ma funziona nella maggior parte dei casi
    const originalIndex = foldQuotes(text).indexOf(foldQuotes(textToHighlight).substring(0, 50));

    if (originalIndex !== -1) {
      const before = text.substring(0, originalIndex);
      const matchLength = Math.min(textToHighlight.length, text.length - originalIndex);
      const match = text.substring(originalIndex, originalIndex + matchLength);
      const after = text.substring(originalIndex + matchLength);

      return { before, match, after };
    }
  }
  return null;
}
