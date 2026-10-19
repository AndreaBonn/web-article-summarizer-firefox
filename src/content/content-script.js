import { buildParagraphMap, highlightParagraph, highlightTextInPage } from './page-highlighter.js';
// Content Script - Esegue nell'ambito della pagina web
import { ContentExtractor } from '../utils/core/content-extractor.js';
import { Logger } from '../utils/core/logger.js';

let paragraphMap = new Map();
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
      if (extractedArticle) paragraphMap = buildParagraphMap(document);

      sendResponse({ success: true, article: extractedArticle });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    // Non restituire true se la risposta è sincrona
    return false;
  }

  if (request.action === 'highlightParagraph') {
    try {
      highlightParagraph(paragraphMap, request.paragraphNumber, document);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  if (request.action === 'highlightText') {
    try {
      const found = highlightTextInPage(document, request.text);
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
