// Content Script - Esegue nell'ambito della pagina web
import { ContentExtractor } from '../utils/core/content-extractor.js';
import { Logger } from '../utils/core/logger.js';

const HIGHLIGHT_DURATION_MS = 3000;
const CITATION_HIGHLIGHT_DURATION_MS = 8000;
const MIN_PARAGRAPH_LENGTH = 20;

const paragraphMap = new Map();
let extractedArticle = null;

// Listener per messaggi dal popup
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Accetta solo messaggi dalla propria estensione
  if (sender.id !== browser.runtime.id) {
    return false;
  }

  if (request.action === 'extractArticle') {
    try {
      extractedArticle = ContentExtractor.extract(document);

      // Crea mappa paragrafi → elementi DOM
      buildParagraphMap();

      sendResponse({ success: true, article: extractedArticle });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    // Non restituire true se la risposta è sincrona
    return false;
  }

  if (request.action === 'highlightParagraph') {
    try {
      highlightParagraph(request.paragraphNumber);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  if (request.action === 'highlightText') {
    try {
      const found = highlightTextInPage(request.text);
      sendResponse({ success: found });
    } catch (error) {
      Logger.error('Errore highlight text:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  if (request.action === 'getUrl') {
    sendResponse({ url: window.location.href });
    return false;
  }
});

function buildParagraphMap() {
  if (!extractedArticle) return;

  paragraphMap.clear();
  const allParagraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6');

  let validIndex = 0;
  allParagraphs.forEach((el) => {
    const text = el.textContent.trim();
    if (text.length > MIN_PARAGRAPH_LENGTH) {
      validIndex++;
      paragraphMap.set(validIndex, el);
    }
  });
}

function highlightParagraph(paragraphNumber) {
  // Rimuovi highlight precedenti
  document.querySelectorAll('.ai-summarizer-highlight').forEach((el) => {
    el.classList.remove('ai-summarizer-highlight');
  });

  // Gestisci range (es: "3-5")
  const paragraphs = [];
  if (typeof paragraphNumber === 'string' && paragraphNumber.includes('-')) {
    const [start, end] = paragraphNumber.split('-').map((n) => parseInt(n));
    for (let i = start; i <= end; i++) {
      if (paragraphMap.has(i)) {
        paragraphs.push(paragraphMap.get(i));
      }
    }
  } else {
    const num = parseInt(paragraphNumber);
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
function highlightTextInPage(searchText) {
  // Rimuovi highlight precedenti
  document.querySelectorAll('.citation-highlight').forEach((el) => {
    const parent = el.parentNode;
    parent.replaceChild(document.createTextNode(el.textContent), el);
    parent.normalize();
  });

  if (!searchText || searchText.length < 10) {
    return false;
  }

  // Normalizza il testo di ricerca
  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .replace(/[""''«»]/g, '"') // Normalizza virgolette
      .replace(/\s+/g, ' ') // Normalizza spazi
      .trim();
  };

  const searchNormalized = normalizeText(searchText);

  // Cerca il testo nella pagina
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
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
    const textNormalized = normalizeText(text);

    // Match esatto (normalizzato)
    if (textNormalized.includes(searchNormalized)) {
      nodesToHighlight.push({
        node: node,
        text: text,
        searchText: searchText,
        exact: true,
      });
    }
    // Match parziale (prime 30 parole o 150 caratteri)
    else if (searchText.length > 150) {
      const searchStart = searchNormalized.substring(0, 150);
      if (textNormalized.includes(searchStart)) {
        nodesToHighlight.push({
          node: node,
          text: text,
          searchText: searchText.substring(0, 150),
          exact: false,
        });
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
        nodesToHighlight.push({
          node: node,
          text: text,
          searchText: searchText,
          exact: false,
          keywordMatch: true,
        });
      }
    }
  }

  if (nodesToHighlight.length === 0) {
    return false;
  }

  // Evidenzia i nodi trovati
  nodesToHighlight.forEach(({ node, text, searchText: textToHighlight, keywordMatch }, idx) => {
    const parent = node.parentElement;

    // Per keyword match, evidenzia tutto il nodo
    if (keywordMatch) {
      const highlight = document.createElement('span');
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
    const textNormalized = normalizeText(text);
    const searchNormalized = normalizeText(textToHighlight);
    const index = textNormalized.indexOf(searchNormalized);

    if (index !== -1) {
      // Trova l'indice nel testo originale (non normalizzato)
      // Questo è approssimativo ma funziona nella maggior parte dei casi
      const originalIndex = text
        .toLowerCase()
        .indexOf(textToHighlight.toLowerCase().substring(0, 50));

      if (originalIndex !== -1) {
        const before = text.substring(0, originalIndex);
        const matchLength = Math.min(textToHighlight.length, text.length - originalIndex);
        const match = text.substring(originalIndex, originalIndex + matchLength);
        const after = text.substring(originalIndex + matchLength);

        const fragment = document.createDocumentFragment();

        if (before) fragment.appendChild(document.createTextNode(before));

        const highlight = document.createElement('span');
        highlight.className = 'citation-highlight';
        highlight.style.backgroundColor = '#ffeb3b';
        highlight.style.padding = '2px 4px';
        highlight.style.borderRadius = '3px';
        highlight.style.fontWeight = 'bold';
        highlight.textContent = match;
        fragment.appendChild(highlight);

        if (after) fragment.appendChild(document.createTextNode(after));

        parent.replaceChild(fragment, node);

        if (idx === 0) {
          highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  });

  // Scroll al primo highlight e programma rimozione
  const firstHighlight = document.querySelector('.citation-highlight');
  if (firstHighlight) {
    firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      document.querySelectorAll('.citation-highlight').forEach((el) => {
        const parent = el.parentNode;
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
      });
    }, CITATION_HIGHLIGHT_DURATION_MS);
  }

  return true;
}
