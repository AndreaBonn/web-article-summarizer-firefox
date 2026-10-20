import { StorageManager } from '../utils/storage/storage-manager.js';
import { APIOrchestrator as APIClient } from '../utils/ai/api-orchestrator.js';
import { CacheManager } from '../utils/storage/cache-manager.js';
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

export function validateProvider(provider) {
  if (!VALID_PROVIDERS.has(provider)) {
    throw new Error(`Provider non valido: ${provider}`);
  }
  return provider;
}

export async function handleGenerateSummary(article, provider, settings) {
  const startTime = Date.now();

  // Decrypt only the API key for the requested provider
  const apiKey = await getApiKeyOrThrow(provider);

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
    await toUserFacingError(error, 'handleGenerateSummary');
  }
}

export async function testApiKey(provider, apiKey) {
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

export async function handleExtractCitations(article, provider, settings) {
  const startTime = Date.now();

  const apiKey = await getApiKeyOrThrow(provider);

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
    await toUserFacingError(error, 'handleExtractCitations');
  }
}

export async function handleTranslateArticle(request) {
  const provider = validateProvider(request.provider);
  const apiKey = await getApiKeyOrThrow(provider);

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
    await toUserFacingError(error, 'handleTranslateArticle');
  }
}

export async function handleAskQuestion(request) {
  const provider = validateProvider(request.provider);
  const apiKey = await getApiKeyOrThrow(provider);

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
    await toUserFacingError(error, 'handleAskQuestion');
  }
}

export async function handleTranslatePDF(request) {
  const provider = validateProvider(request.provider);
  const apiKey = await getApiKeyOrThrow(provider);

  try {
    return await translatePDFText(
      request.text,
      request.targetLanguage,
      provider,
      apiKey,
      request.forceTranslate || false,
    );
  } catch (error) {
    await toUserFacingError(error, 'handleTranslatePDF');
  }
}

export async function handleExtractPDFCitations(request) {
  const provider = validateProvider(request.provider);
  const apiKey = await getApiKeyOrThrow(provider);

  try {
    return await extractPDFCitations(request.text, request.filename, provider, apiKey);
  } catch (error) {
    await toUserFacingError(error, 'handleExtractPDFCitations');
  }
}

export async function handleAskPDFQuestion(request) {
  const provider = validateProvider(request.provider);
  const apiKey = await getApiKeyOrThrow(provider);

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
    await toUserFacingError(error, 'handleAskPDFQuestion');
  }
}

const COMPLETION_OPTION_KEYS = ['temperature', 'maxTokens'];

/**
 * Runs one LLM completion for an extension page, so the page never handles the decrypted key.
 * Only sampling options and the JSON response format are forwarded: the model stays the default.
 */
export async function handleGenerateCompletion(request) {
  const provider = validateProvider(request.provider);
  if (typeof request.systemPrompt !== 'string' || typeof request.userPrompt !== 'string') {
    throw new Error('Prompt non valido');
  }
  const apiKey = await getApiKeyOrThrow(provider);
  const requested = request.options && typeof request.options === 'object' ? request.options : {};
  const options = Object.fromEntries(
    COMPLETION_OPTION_KEYS.filter((key) => Number.isFinite(requested[key])).map((key) => [
      key,
      requested[key],
    ]),
  );
  if (requested.responseFormat === 'json') options.responseFormat = 'json';

  try {
    return await APIClient.generateCompletion(
      provider,
      apiKey,
      request.systemPrompt,
      request.userPrompt,
      options,
    );
  } catch (error) {
    await toUserFacingError(error, 'handleGenerateCompletion');
  }
}

async function getApiKeyOrThrow(provider) {
  const apiKey = await StorageManager.getApiKey(provider);
  if (!apiKey) {
    throw new Error('API key non configurata. Vai nelle impostazioni.');
  }
  return apiKey;
}

async function toUserFacingError(error, context) {
  const errorMessage = ErrorHandler.getErrorMessage(error);
  await ErrorHandler.logError(error, context);
  throw new Error(errorMessage, { cause: error });
}
