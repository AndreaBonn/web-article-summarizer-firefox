import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContentClassifier } from '@utils/ai/content-classifier.js';

// Mock Chrome APIs usate da saveUserCorrection
beforeEach(() => {
  global.browser = {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
    runtime: { id: 'test-id' },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getCategoryLabel
// ---------------------------------------------------------------------------

describe('ContentClassifier.getCategoryLabel()', () => {
  it('test_getCategoryLabel_withAuto_returnsRilevamentoAutomatico', () => {
    expect(ContentClassifier.getCategoryLabel('auto')).toBe('Rilevamento Automatico');
  });

  it('test_getCategoryLabel_withScientific_returnsScientifico', () => {
    expect(ContentClassifier.getCategoryLabel('scientific')).toBe('Scientifico');
  });

  it('test_getCategoryLabel_withNews_returnsNews', () => {
    expect(ContentClassifier.getCategoryLabel('news')).toBe('News');
  });

  it('test_getCategoryLabel_withTutorial_returnsTutorial', () => {
    expect(ContentClassifier.getCategoryLabel('tutorial')).toBe('Tutorial');
  });

  it('test_getCategoryLabel_withBusiness_returnsBusiness', () => {
    expect(ContentClassifier.getCategoryLabel('business')).toBe('Business');
  });

  it('test_getCategoryLabel_withOpinion_returnsOpinione', () => {
    expect(ContentClassifier.getCategoryLabel('opinion')).toBe('Opinione');
  });

  it('test_getCategoryLabel_withGeneral_returnsGenerico', () => {
    expect(ContentClassifier.getCategoryLabel('general')).toBe('Generico');
  });

  it('test_getCategoryLabel_withUnknownCategory_returnsCategoryAsIs', () => {
    expect(ContentClassifier.getCategoryLabel('unknown-cat')).toBe('unknown-cat');
  });

  it('test_getCategoryLabel_withEmptyString_returnsEmptyString', () => {
    expect(ContentClassifier.getCategoryLabel('')).toBe('');
  });

  it('test_getCategoryLabel_withUndefined_returnsUndefined', () => {
    // Labels map non ha la chiave undefined → fallback al valore stesso
    expect(ContentClassifier.getCategoryLabel(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// classifyArticle — rami senza API call (manual + fallback)
// ---------------------------------------------------------------------------

describe('ContentClassifier.classifyArticle() — selezione manuale', () => {
  it('test_classifyArticle_withManualSelection_returnsManualMethodWithCategory', async () => {
    // Arrange
    const article = { title: 'Test', content: 'Contenuto di prova' };

    // Act
    const result = await ContentClassifier.classifyArticle(article, 'scientific');

    // Assert
    expect(result).toEqual({ category: 'scientific', method: 'manual' });
  });

  it('test_classifyArticle_withManualNews_returnsNewsCategory', async () => {
    const article = { title: 'Notizia', content: 'Contenuto news' };
    const result = await ContentClassifier.classifyArticle(article, 'news');
    expect(result.category).toBe('news');
    expect(result.method).toBe('manual');
  });

  it('test_classifyArticle_withAllManualCategories_returnsCorrectMethod', async () => {
    const categories = ['scientific', 'news', 'tutorial', 'business', 'opinion', 'general'];
    for (const cat of categories) {
      const result = await ContentClassifier.classifyArticle({ title: 'T', content: 'c' }, cat);
      expect(result.method).toBe('manual');
      expect(result.category).toBe(cat);
    }
  });

  it('test_classifyArticle_withAutoAndNoApiKey_returnsFallbackGeneral', async () => {
    // Arrange: StorageManager restituirà undefined → aiClassification lancia
    // Non mocchiamo StorageManager direttamente: lo importiamo e mocchiamo qui
    const { StorageManager } = await import('@utils/storage/storage-manager.js');
    vi.spyOn(StorageManager, 'getSettings').mockResolvedValue({ selectedProvider: 'groq' });
    vi.spyOn(StorageManager, 'getApiKey').mockResolvedValue(null);

    const article = { title: 'Test', content: 'parola '.repeat(10) };

    // Act
    const result = await ContentClassifier.classifyArticle(article, 'auto');

    // Assert
    expect(result.category).toBe('general');
    expect(result.method).toBe('fallback');
    expect(result.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// classifyArticle — AI classification path
// ---------------------------------------------------------------------------

describe('ContentClassifier.classifyArticle() — AI classification', () => {
  let StorageManager;
  let APIClient;

  beforeEach(async () => {
    const storageModule = await import('@utils/storage/storage-manager.js');
    StorageManager = storageModule.StorageManager;
    vi.spyOn(StorageManager, 'getSettings').mockResolvedValue({ selectedProvider: 'groq' });
    vi.spyOn(StorageManager, 'getApiKey').mockResolvedValue('test-api-key');

    const apiModule = await import('@utils/ai/api-orchestrator.js');
    APIClient = apiModule.APIOrchestrator;
  });

  it('test_classifyArticle_withValidAIResponse_returnsAIMethod', async () => {
    vi.spyOn(APIClient, 'generateCompletion').mockResolvedValue('scientific');

    const article = { title: 'Research Paper', content: 'methodology results p-value '.repeat(20) };
    const result = await ContentClassifier.classifyArticle(article, 'auto');

    expect(result.method).toBe('ai');
    expect(result.category).toBe('scientific');
  });

  it('test_classifyArticle_withInvalidAICategory_returnsFallback', async () => {
    vi.spyOn(APIClient, 'generateCompletion').mockResolvedValue('invalid-category-xyz');

    const article = { title: 'Article', content: 'some content '.repeat(10) };
    const result = await ContentClassifier.classifyArticle(article, 'auto');

    expect(result.method).toBe('fallback');
    expect(result.category).toBe('general');
    expect(result.error).toContain('invalid-category-xyz');
  });

  it('test_classifyArticle_withNetworkError_returnsFallbackWithError', async () => {
    vi.spyOn(APIClient, 'generateCompletion').mockRejectedValue(
      new Error('fetch failed: Network error'),
    );

    const article = { title: 'Net Fail', content: 'content '.repeat(10) };
    const result = await ContentClassifier.classifyArticle(article, 'auto');

    expect(result.method).toBe('fallback');
    expect(result.category).toBe('general');
    expect(result.error).toContain('fetch failed');
  });

  it('test_classifyArticle_withAPIError401_returnsFallback', async () => {
    vi.spyOn(APIClient, 'generateCompletion').mockRejectedValue(new Error('401 Unauthorized'));

    const article = { title: 'Auth Fail', content: 'content '.repeat(10) };
    const result = await ContentClassifier.classifyArticle(article, 'auto');

    expect(result.method).toBe('fallback');
    expect(result.category).toBe('general');
  });

  it('test_classifyArticle_withRateLimitError429_returnsFallback', async () => {
    vi.spyOn(APIClient, 'generateCompletion').mockRejectedValue(
      new Error('429 rate limit exceeded'),
    );

    const article = { title: 'Rate Limit', content: 'content '.repeat(10) };
    const result = await ContentClassifier.classifyArticle(article, 'auto');

    expect(result.method).toBe('fallback');
    expect(result.category).toBe('general');
  });

  it('test_classifyArticle_withTimeoutError_returnsFallback', async () => {
    vi.spyOn(APIClient, 'generateCompletion').mockRejectedValue(
      new Error('Request timeout after 60 seconds'),
    );

    const article = { title: 'Timeout', content: 'content '.repeat(10) };
    const result = await ContentClassifier.classifyArticle(article, 'auto');

    expect(result.method).toBe('fallback');
    expect(result.category).toBe('general');
  });

  it('test_classifyArticle_withInternalError_returnsFallback', async () => {
    vi.spyOn(APIClient, 'generateCompletion').mockRejectedValue(
      new Error('TypeError: cannot read property of undefined'),
    );

    const article = { title: 'Internal', content: 'content '.repeat(10) };
    const result = await ContentClassifier.classifyArticle(article, 'auto');

    expect(result.method).toBe('fallback');
    expect(result.category).toBe('general');
  });

  it('test_aiClassification_samplesFirst500Words', async () => {
    let capturedUserPrompt = '';
    const { PromptRegistry } = await import('@utils/ai/prompt-registry.js');
    vi.spyOn(PromptRegistry, 'getClassificationUserPrompt').mockImplementation((art, sample) => {
      capturedUserPrompt = sample;
      return 'mocked-user-prompt';
    });
    vi.spyOn(PromptRegistry, 'getClassificationSystemPrompt').mockReturnValue('mocked-sys');
    vi.spyOn(APIClient, 'generateCompletion').mockResolvedValue('news');

    // Create article with more than 500 words
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`);
    const article = { title: 'Long Article', content: words.join(' ') };

    await ContentClassifier.classifyArticle(article, 'auto');

    // The sample should contain only ~500 words (joined by spaces)
    const sampleWords = capturedUserPrompt.split(/\s+/);
    expect(sampleWords.length).toBeLessThanOrEqual(500);
  });
});

// ---------------------------------------------------------------------------
// saveUserCorrection — verifica interazione con browser.storage
// ---------------------------------------------------------------------------

describe('ContentClassifier.saveUserCorrection()', () => {
  it('test_saveUserCorrection_withEmptyStorage_savesFirstCorrection', async () => {
    // Arrange
    browser.storage.local.get.mockResolvedValue({ classificationCorrections: [] });
    browser.storage.local.set.mockResolvedValue(undefined);

    // Act
    await ContentClassifier.saveUserCorrection('https://example.com', 'general', 'scientific');

    // Assert
    expect(browser.storage.local.set).toHaveBeenCalledOnce();
    const [savedData] = browser.storage.local.set.mock.calls[0];
    const corrections = savedData.classificationCorrections;
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({
      url: 'https://example.com',
      detected: 'general',
      corrected: 'scientific',
    });
    expect(corrections[0].timestamp).toBeTypeOf('number');
  });

  it('test_saveUserCorrection_withMissingStorageKey_initializesArray', async () => {
    // Arrange: nessuna chiave in storage
    browser.storage.local.get.mockResolvedValue({});
    browser.storage.local.set.mockResolvedValue(undefined);

    // Act
    await ContentClassifier.saveUserCorrection('https://test.com', 'news', 'opinion');

    // Assert
    const [savedData] = browser.storage.local.set.mock.calls[0];
    expect(savedData.classificationCorrections).toHaveLength(1);
  });

  it('test_saveUserCorrection_withFullStorage_keepsLast100Corrections', async () => {
    // Arrange: 100 correzioni già presenti
    const existing = Array.from({ length: 100 }, (_, i) => ({
      url: `https://example.com/${i}`,
      detected: 'general',
      corrected: 'news',
      timestamp: Date.now() - i * 1000,
    }));
    browser.storage.local.get.mockResolvedValue({ classificationCorrections: existing });
    browser.storage.local.set.mockResolvedValue(undefined);

    // Act
    await ContentClassifier.saveUserCorrection('https://new.com', 'tutorial', 'scientific');

    // Assert
    const [savedData] = browser.storage.local.set.mock.calls[0];
    const corrections = savedData.classificationCorrections;
    expect(corrections).toHaveLength(100);
    // La nuova correzione è l'ultima
    expect(corrections[corrections.length - 1].url).toBe('https://new.com');
    // La prima (più vecchia) è stata rimossa
    expect(corrections[0].url).toBe('https://example.com/1');
  });
});
