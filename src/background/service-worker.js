// Background Service Worker - Handles API calls
import { StorageManager } from '../utils/storage/storage-manager.js';
import { APIOrchestrator as APIClient } from '../utils/ai/api-orchestrator.js';
import { CacheManager } from '../utils/storage/cache-manager.js';
import { AutoMaintenance } from '../utils/core/auto-maintenance.js';
import { CitationExtractor } from '../utils/ai/citation-extractor.js';
import { Translator } from '../utils/core/translator.js';
import { AdvancedAnalysis } from '../utils/ai/advanced-analysis.js';
import {
  translatePDFText,
  extractPDFCitations,
  askQuestionPDF,
} from '../pages/reading-mode/pdf.js';
import { ErrorHandler } from '../utils/core/error-handler.js';
import { Logger } from '../utils/core/logger.js';

const VALID_PROVIDERS = new Set(['groq', 'openai', 'anthropic', 'gemini']);

function validateProvider(provider) {
  if (!VALID_PROVIDERS.has(provider)) {
    throw new Error(`Provider non valido: ${provider}`);
  }
  return provider;
}

// Initialize automatic cache maintenance
const autoMaintenance = new AutoMaintenance();
autoMaintenance.initialize().catch((err) => Logger.error('AutoMaintenance init failed:', err));

// Persistent alarm listener for MV3 (survives service worker restarts)
browser.alarms.onAlarm.addListener((alarm) => {
  autoMaintenance.handleAlarm(alarm);
});

// MV3 Lifecycle Events
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    Logger.info('AI Article Summarizer installato');
  } else if (details.reason === 'update') {
    Logger.info(
      'AI Article Summarizer aggiornato alla versione',
      browser.runtime.getManifest().version,
    );
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Validate that the message comes from this extension
  if (sender.id !== browser.runtime.id) {
    return false;
  }

  if (request.action === 'generateSummary') {
    let provider;
    try {
      provider = validateProvider(request.provider);
    } catch (error) {
      sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
      return false;
    }
    handleGenerateSummary(request.article, provider, request.settings)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        Logger.error('Errore generazione:', error);
        sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
      });
    return true; // Keep the channel open for async response
  }

  if (request.action === 'extractCitations') {
    let provider;
    try {
      provider = validateProvider(request.provider);
    } catch (error) {
      sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
      return false;
    }
    handleExtractCitations(request.article, provider, request.settings)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        Logger.error('Errore estrazione citazioni:', error);
        sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
      });
    return true;
  }

  if (request.action === 'testApiKey') {
    let provider;
    try {
      provider = validateProvider(request.provider);
    } catch (error) {
      sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
      return false;
    }
    testApiKey(provider, request.apiKey)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        Logger.error('Errore test API:', error);
        sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
      });
    return true;
  }

  if (request.action === 'translateArticle') {
    handleTranslateArticle(request)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        Logger.error('Errore traduzione:', error);
        sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
      });
    return true;
  }

  if (request.action === 'askQuestion') {
    handleAskQuestion(request)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        Logger.error('Errore Q&A:', error);
        sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
      });
    return true;
  }

  if (request.action === 'translatePDF') {
    handleTranslatePDF(request)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        Logger.error('Errore traduzione PDF:', error);
        sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
      });
    return true;
  }

  if (request.action === 'extractPDFCitations') {
    handleExtractPDFCitations(request)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        Logger.error('Errore citazioni PDF:', error);
        sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
      });
    return true;
  }

  if (request.action === 'askPDFQuestion') {
    handleAskPDFQuestion(request)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        Logger.error('Errore Q&A PDF:', error);
        sendResponse({ success: false, error: ErrorHandler.getErrorMessage(error) });
      });
    return true;
  }

  // Return false for other messages
  return false;
});

async function handleGenerateSummary(article, provider, settings) {
  const startTime = Date.now();

  // Decrypt only the API key for the requested provider
  const apiKey = await StorageManager.getApiKey(provider);
  if (!apiKey) {
    throw new Error('API key non configurata. Vai nelle impostazioni.');
  }

  // Get performance settings
  const performanceSettings = await StorageManager.getSettings();
  const enableCache = performanceSettings.enableCache !== false;

  // Generate content hash for cache validation
  const contentHash = CacheManager.hashContent(article.content);

  // Instantiate CacheManager only once
  const cacheManager = enableCache ? new CacheManager() : null;

  try {
    // 1. Check cache with content validation
    if (cacheManager) {
      const cached = await cacheManager.get(article.url, provider, settings, contentHash);
      if (cached) {
        return {
          summary: cached.summary,
          keyPoints: cached.keyPoints,
          fromCache: true,
          usedProvider: provider,
        };
      }
    }

    // 2. Call API with retry
    const responseText = await APIClient.callAPI(provider, apiKey, article, settings);

    // 3. Parse response
    const { summary, keyPoints } = APIClient.parseResponse(responseText);

    // 4. Save to cache with content hash
    if (cacheManager) {
      await cacheManager.set(
        article.url,
        provider,
        settings,
        { summary, keyPoints },
        null,
        contentHash,
      );
    }

    // 5. Update statistics
    const generationTime = Date.now() - startTime;
    await StorageManager.updateStats(provider, article.wordCount, generationTime);

    return {
      summary,
      keyPoints,
      fromCache: false,
      usedProvider: provider,
      generationTime,
    };
  } catch (error) {
    Logger.error('Errore generazione riassunto:', error);
    const errorMessage = ErrorHandler.getErrorMessage(error);
    await ErrorHandler.logError(error, 'handleGenerateSummary');
    throw new Error(errorMessage, { cause: error });
  }
}

async function testApiKey(provider, apiKey) {
  const testArticle = {
    title: 'Test Article',
    paragraphs: [{ id: 1, text: 'This is a test paragraph to verify API connectivity.' }],
    wordCount: 10,
    readingTimeMinutes: 1,
    content: 'This is a test paragraph to verify API connectivity.',
  };

  const testSettings = {
    summaryLength: 'short',
    tone: 'neutral',
    autoDetectLanguage: true,
  };

  try {
    await APIClient.callAPI(provider, apiKey, testArticle, testSettings);
    return true;
  } catch (error) {
    throw new Error(`Test fallito: ${error.message}`, { cause: error });
  }
}

async function handleExtractCitations(article, provider, settings) {
  const startTime = Date.now();

  const apiKey = await StorageManager.getApiKey(provider);
  if (!apiKey) {
    throw new Error('API key non configurata. Vai nelle impostazioni.');
  }

  const performanceSettings = await StorageManager.getSettings();
  const enableCache = performanceSettings.enableCache !== false;
  const contentHash = CacheManager.hashContent(article.content);
  const cacheKey = article.url + '_citations';

  // Instantiate CacheManager only once
  const cacheManager = enableCache ? new CacheManager() : null;

  // 1. Check cache
  if (cacheManager) {
    const cached = await cacheManager.get(cacheKey, provider, { type: 'citations' }, contentHash);
    if (cached) {
      return { citations: cached, fromCache: true, usedProvider: provider };
    }
  }

  // 2. Extract citations from API
  try {
    const citations = await CitationExtractor.extractCitations(article, provider, apiKey, settings);

    // 3. Save to cache
    if (cacheManager) {
      await cacheManager.set(
        cacheKey,
        provider,
        { type: 'citations' },
        citations,
        null,
        contentHash,
      );
    }

    const extractionTime = Date.now() - startTime;
    return {
      citations,
      fromCache: false,
      usedProvider: provider,
      extractionTime,
    };
  } catch (error) {
    Logger.error('Errore estrazione citazioni:', error);
    const errorMessage = ErrorHandler.getErrorMessage(error);
    await ErrorHandler.logError(error, 'handleExtractCitations');
    throw new Error(errorMessage, { cause: error });
  }
}

async function handleTranslateArticle(request) {
  const provider = validateProvider(request.provider);
  const apiKey = await StorageManager.getApiKey(provider);
  if (!apiKey) {
    throw new Error('API key non configurata. Vai nelle impostazioni.');
  }

  try {
    const translation = await Translator.translateArticle(
      request.article,
      request.targetLanguage,
      provider,
      apiKey,
      request.contentType || null,
    );
    return { translation };
  } catch (error) {
    const errorMessage = ErrorHandler.getErrorMessage(error);
    await ErrorHandler.logError(error, 'handleTranslateArticle');
    throw new Error(errorMessage, { cause: error });
  }
}

async function handleAskQuestion(request) {
  const provider = validateProvider(request.provider);
  const apiKey = await StorageManager.getApiKey(provider);
  if (!apiKey) {
    throw new Error('API key non configurata. Vai nelle impostazioni.');
  }

  try {
    const answer = await AdvancedAnalysis.askQuestion(
      request.question,
      request.article,
      request.summary,
      provider,
      apiKey,
      request.settings || {},
    );
    return { answer };
  } catch (error) {
    const errorMessage = ErrorHandler.getErrorMessage(error);
    await ErrorHandler.logError(error, 'handleAskQuestion');
    throw new Error(errorMessage, { cause: error });
  }
}

async function handleTranslatePDF(request) {
  const provider = validateProvider(request.provider);
  const apiKey = await StorageManager.getApiKey(provider);
  if (!apiKey) {
    throw new Error('API key non configurata. Vai nelle impostazioni.');
  }

  try {
    return await translatePDFText(
      request.text,
      request.targetLanguage,
      provider,
      apiKey,
      request.forceTranslate || false,
    );
  } catch (error) {
    const errorMessage = ErrorHandler.getErrorMessage(error);
    await ErrorHandler.logError(error, 'handleTranslatePDF');
    throw new Error(errorMessage, { cause: error });
  }
}

async function handleExtractPDFCitations(request) {
  const provider = validateProvider(request.provider);
  const apiKey = await StorageManager.getApiKey(provider);
  if (!apiKey) {
    throw new Error('API key non configurata. Vai nelle impostazioni.');
  }

  try {
    return await extractPDFCitations(request.text, request.filename, provider, apiKey);
  } catch (error) {
    const errorMessage = ErrorHandler.getErrorMessage(error);
    await ErrorHandler.logError(error, 'handleExtractPDFCitations');
    throw new Error(errorMessage, { cause: error });
  }
}

async function handleAskPDFQuestion(request) {
  const provider = validateProvider(request.provider);
  const apiKey = await StorageManager.getApiKey(provider);
  if (!apiKey) {
    throw new Error('API key non configurata. Vai nelle impostazioni.');
  }

  try {
    const answer = await askQuestionPDF(
      request.question,
      request.extractedText,
      request.summary,
      provider,
      apiKey,
    );
    return { answer };
  } catch (error) {
    const errorMessage = ErrorHandler.getErrorMessage(error);
    await ErrorHandler.logError(error, 'handleAskPDFQuestion');
    throw new Error(errorMessage, { cause: error });
  }
}
