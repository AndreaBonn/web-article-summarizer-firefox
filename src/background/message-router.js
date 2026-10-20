import { validateProvider } from './message-handlers.js';
import { ErrorHandler } from '../utils/core/error-handler.js';
import { Logger } from '../utils/core/logger.js';

const SYNC_VALIDATED_ACTIONS = {
  generateSummary: 'handleGenerateSummary',
  extractCitations: 'handleExtractCitations',
  testApiKey: 'testApiKey',
};
const ASYNC_ACTIONS = {
  translateArticle: 'handleTranslateArticle',
  askQuestion: 'handleAskQuestion',
  translatePDF: 'handleTranslatePDF',
  extractPDFCitations: 'handleExtractPDFCitations',
  askPDFQuestion: 'handleAskPDFQuestion',
  generateCompletion: 'handleGenerateCompletion',
};
// Raw prompt-in, completion-out: content scripts share the extension id, so the sender URL
// is what keeps a web page from driving the user's API keys through them
const EXTENSION_PAGE_ONLY_ACTIONS = new Set(['generateCompletion']);
const LOG_LABELS = {
  generateSummary: 'Errore generazione:',
  extractCitations: 'Errore estrazione citazioni:',
  testApiKey: 'Errore test API:',
  translateArticle: 'Errore traduzione:',
  askQuestion: 'Errore Q&A:',
  translatePDF: 'Errore traduzione PDF:',
  extractPDFCitations: 'Errore citazioni PDF:',
  askPDFQuestion: 'Errore Q&A PDF:',
  generateCompletion: 'Errore completamento:',
};

function isExtensionPage(sender) {
  return typeof sender.url === 'string' && sender.url.startsWith(browser.runtime.getURL(''));
}

export function createMessageListener(handlers) {
  return (request, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return false;

    const action = request.action;
    if (typeof action !== 'string') return false;
    if (Object.hasOwn(SYNC_VALIDATED_ACTIONS, action)) {
      let provider;
      try {
        provider = validateProvider(request.provider);
      } catch (error) {
        sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
        return false;
      }
      const pending =
        action === 'testApiKey'
          ? handlers.testApiKey(provider, request.apiKey)
          : handlers[SYNC_VALIDATED_ACTIONS[action]](request.article, provider, request.settings);
      respond(pending, action, sendResponse);
      return true;
    }
    if (EXTENSION_PAGE_ONLY_ACTIONS.has(action) && !isExtensionPage(sender)) return false;
    if (Object.hasOwn(ASYNC_ACTIONS, action)) {
      respond(handlers[ASYNC_ACTIONS[action]](request), action, sendResponse);
      return true;
    }
    return false;
  };
}

function respond(pending, action, sendResponse) {
  pending
    .then((result) => {
      sendResponse(action === 'testApiKey' ? { success: true } : { success: true, result });
    })
    .catch((error) => {
      Logger.error(LOG_LABELS[action], error);
      sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
    });
}
