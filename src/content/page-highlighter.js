import {
  isSubstantialParagraph,
  parseParagraphRange,
  normalizeQuoteText,
  classifyNodeMatch,
  locateHighlightSpan,
} from './text-match.js';

const HIGHLIGHT_DURATION_MS = 3000;
const CITATION_HIGHLIGHT_DURATION_MS = 8000;

export function buildParagraphMap(doc) {
  const paragraphMap = new Map();
  const allParagraphs = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6');

  let validIndex = 0;
  allParagraphs.forEach((el) => {
    const text = el.textContent.trim();
    if (isSubstantialParagraph(text)) {
      validIndex++;
      paragraphMap.set(validIndex, el);
    }
  });
  return paragraphMap;
}

export function highlightParagraph(paragraphMap, paragraphNumber, doc) {
  // Rimuovi highlight precedenti
  doc.querySelectorAll('.ai-summarizer-highlight').forEach((el) => {
    el.classList.remove('ai-summarizer-highlight');
  });

  // Gestisci range (es: "3-5")
  const paragraphs = [];
  for (const num of parseParagraphRange(paragraphNumber)) {
    if (paragraphMap.has(num)) {
      paragraphs.push(paragraphMap.get(num));
    }
  }

  if (paragraphs.length === 0) return;

  // Scrolla al primo paragrafo
  paragraphs[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Aggiungi highlight
  paragraphs.forEach((el) => {
    el.classList.add('ai-summarizer-highlight');
  });

  // Rimuovi dopo HIGHLIGHT_DURATION_MS
  setTimeout(() => {
    paragraphs.forEach((el) => {
      el.classList.remove('ai-summarizer-highlight');
    });
  }, HIGHLIGHT_DURATION_MS);
}

// CSS highlight is now injected via manifest.json content_scripts.css

// Evidenzia testo specifico nella pagina (per citazioni)
export function highlightTextInPage(doc, searchText) {
  // Rimuovi highlight precedenti
  doc.querySelectorAll('.citation-highlight').forEach((el) => {
    const parent = el.parentNode;
    parent.replaceChild(doc.createTextNode(el.textContent), el);
    parent.normalize();
  });

  if (!searchText || searchText.length < 10) {
    return false;
  }

  // Normalizza il testo di ricerca
  const searchNormalized = normalizeQuoteText(searchText);

  // Cerca il testo nella pagina
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      // Ignora script, style, e nodi già evidenziati
      if (
        node.parentElement.tagName === 'SCRIPT' ||
        node.parentElement.tagName === 'STYLE' ||
        node.parentElement.classList.contains('citation-highlight')
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodesToHighlight = [];
  let node;

  // Cerca match esatti o parziali
  while ((node = walker.nextNode())) {
    const text = node.textContent;
    const textNormalized = normalizeQuoteText(text);

    const match = classifyNodeMatch(textNormalized, searchText, searchNormalized);
    if (match) nodesToHighlight.push({ node: node, text: text, ...match });
  }

  if (nodesToHighlight.length === 0) {
    return false;
  }

  // Evidenzia i nodi trovati
  nodesToHighlight.forEach(({ node, text, searchText: textToHighlight, keywordMatch }, idx) => {
    const parent = node.parentElement;

    // Per keyword match, evidenzia tutto il nodo
    if (keywordMatch) {
      const highlight = doc.createElement('span');
      highlight.className = 'citation-highlight';
      highlight.style.backgroundColor = '#ffeb3b';
      highlight.style.padding = '2px 4px';
      highlight.style.borderRadius = '3px';
      highlight.style.fontWeight = 'bold';
      highlight.textContent = text;

      parent.replaceChild(highlight, node);

      if (idx === 0) {
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Per match esatti/parziali, evidenzia solo la parte corrispondente
    const span = locateHighlightSpan(text, textToHighlight);
    if (span) {
      const { before, match, after } = span;
      const fragment = doc.createDocumentFragment();

      if (before) fragment.appendChild(doc.createTextNode(before));

      const highlight = doc.createElement('span');
      highlight.className = 'citation-highlight';
      highlight.style.backgroundColor = '#ffeb3b';
      highlight.style.padding = '2px 4px';
      highlight.style.borderRadius = '3px';
      highlight.style.fontWeight = 'bold';
      highlight.textContent = match;
      fragment.appendChild(highlight);

      if (after) fragment.appendChild(doc.createTextNode(after));

      parent.replaceChild(fragment, node);

      if (idx === 0) {
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  // Scroll al primo highlight e programma rimozione
  const firstHighlight = doc.querySelector('.citation-highlight');
  if (!firstHighlight) {
    return false;
  }
  firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });

  setTimeout(() => {
    doc.querySelectorAll('.citation-highlight').forEach((el) => {
      const parent = el.parentNode;
      parent.replaceChild(doc.createTextNode(el.textContent), el);
      parent.normalize();
    });
  }, CITATION_HIGHLIGHT_DURATION_MS);

  return true;
}
