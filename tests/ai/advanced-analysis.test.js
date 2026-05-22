import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Chrome APIs
global.browser = {
  storage: { local: { get: vi.fn(), set: vi.fn() } },
  runtime: { id: 'test-id' },
};

// Mock APIOrchestrator (used as APIClient in advanced-analysis.js)
vi.mock('@utils/ai/api-orchestrator.js', () => ({
  APIOrchestrator: {
    generateCompletion: vi.fn(),
  },
}));

const { AdvancedAnalysis } = await import('@utils/ai/advanced-analysis.js');
const { APIOrchestrator } = await import('@utils/ai/api-orchestrator.js');

describe('AdvancedAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // askQuestion — lines 7-17
  // ---------------------------------------------------------------------------

  describe('askQuestion', () => {
    const article = {
      title: 'Test Article',
      paragraphs: [
        { id: 1, text: 'First paragraph.' },
        { id: 2, text: 'Second paragraph.' },
      ],
    };
    const summary = 'Test summary.';
    const settings = { outputLanguage: 'it' };

    it('test_askQuestion_returnsGeneratedCompletion', async () => {
      APIOrchestrator.generateCompletion.mockResolvedValue('La risposta è nel §1.');

      const result = await AdvancedAnalysis.askQuestion(
        'Qual è il tema?',
        article,
        summary,
        'groq',
        'api-key',
        settings,
      );

      expect(result).toBe('La risposta è nel §1.');
    });

    it('test_askQuestion_callsGenerateCompletionWithCorrectProvider', async () => {
      APIOrchestrator.generateCompletion.mockResolvedValue('answer');

      await AdvancedAnalysis.askQuestion('Q?', article, summary, 'anthropic', 'key', settings);

      expect(APIOrchestrator.generateCompletion).toHaveBeenCalledWith(
        'anthropic',
        'key',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ temperature: 0.4 }),
      );
    });

    it('test_askQuestion_usesMaxTokens8000ForGemini', async () => {
      APIOrchestrator.generateCompletion.mockResolvedValue('gemini answer');

      await AdvancedAnalysis.askQuestion('Q?', article, summary, 'gemini', 'key', settings);

      const [, , , , opts] = APIOrchestrator.generateCompletion.mock.calls[0];
      expect(opts.maxTokens).toBe(8000);
    });

    it('test_askQuestion_usesMaxTokens1500ForNonGemini', async () => {
      APIOrchestrator.generateCompletion.mockResolvedValue('openai answer');

      await AdvancedAnalysis.askQuestion('Q?', article, summary, 'openai', 'key', settings);

      const [, , , , opts] = APIOrchestrator.generateCompletion.mock.calls[0];
      expect(opts.maxTokens).toBe(1500);
    });

    it('test_askQuestion_usesDefaultLanguageItWhenNotSpecified', async () => {
      APIOrchestrator.generateCompletion.mockResolvedValue('ok');

      await AdvancedAnalysis.askQuestion('Q?', article, summary, 'groq', 'key', {});

      // System prompt should contain italian instruction (default 'it')
      const [, , systemPrompt] = APIOrchestrator.generateCompletion.mock.calls[0];
      expect(systemPrompt).toContain('italiano');
    });

    it('test_askQuestion_wrapsAPIErrorWithQAPrefix', async () => {
      APIOrchestrator.generateCompletion.mockRejectedValue(new Error('API unavailable'));

      await expect(
        AdvancedAnalysis.askQuestion('Q?', article, summary, 'groq', 'key', settings),
      ).rejects.toThrow('Errore Q&A: API unavailable');
    });

    it('test_askQuestion_preservesOriginalErrorAsCause', async () => {
      const originalError = new Error('Network failure');
      APIOrchestrator.generateCompletion.mockRejectedValue(originalError);

      try {
        await AdvancedAnalysis.askQuestion('Q?', article, summary, 'groq', 'key', settings);
      } catch (err) {
        expect(err.cause).toBe(originalError);
      }
    });

    it('test_askQuestion_englishSettingProducesEnglishSystemPrompt', async () => {
      APIOrchestrator.generateCompletion.mockResolvedValue('ok');

      await AdvancedAnalysis.askQuestion('Q?', article, summary, 'groq', 'key', {
        outputLanguage: 'en',
      });

      const [, , systemPrompt] = APIOrchestrator.generateCompletion.mock.calls[0];
      expect(systemPrompt).toContain('English');
    });
  });

  const mockArticle = {
    title: 'Test Article',
    paragraphs: [
      { id: 1, text: 'First paragraph content.' },
      { id: 2, text: 'Second paragraph content.' },
      { id: 3, text: 'Third paragraph content.' },
    ],
  };
  const mockSummary = 'This is a test summary.';

  describe('buildQAPrompt', () => {
    it('test_buildQAPrompt_italian_contains_correct_labels', () => {
      const result = AdvancedAnalysis.buildQAPrompt('Domanda?', mockArticle, mockSummary, 'it');

      expect(result).toContain('# ARTICOLO');
      expect(result).toContain('# RIASSUNTO');
      expect(result).toContain('# DOMANDA');
      expect(result).toContain('Domanda?');
      expect(result).toContain('This is a test summary.');
    });

    it('test_buildQAPrompt_english_contains_correct_labels', () => {
      const result = AdvancedAnalysis.buildQAPrompt('Question?', mockArticle, mockSummary, 'en');

      expect(result).toContain('# ARTICLE');
      expect(result).toContain('# SUMMARY');
      expect(result).toContain('# QUESTION');
      expect(result).toContain('Question?');
    });

    it('test_buildQAPrompt_spanish_contains_correct_labels', () => {
      const result = AdvancedAnalysis.buildQAPrompt('Pregunta?', mockArticle, mockSummary, 'es');
      expect(result).toContain('# ARTÍCULO');
      expect(result).toContain('# RESUMEN');
    });

    it('test_buildQAPrompt_french_contains_correct_labels', () => {
      const result = AdvancedAnalysis.buildQAPrompt('Question?', mockArticle, mockSummary, 'fr');
      expect(result).toContain('# RÉSUMÉ');
    });

    it('test_buildQAPrompt_german_contains_correct_labels', () => {
      const result = AdvancedAnalysis.buildQAPrompt('Frage?', mockArticle, mockSummary, 'de');
      expect(result).toContain('# ARTIKEL');
      expect(result).toContain('# ZUSAMMENFASSUNG');
      expect(result).toContain('# FRAGE');
    });

    it('test_buildQAPrompt_unknown_language_falls_back_to_italian', () => {
      const result = AdvancedAnalysis.buildQAPrompt('Q?', mockArticle, mockSummary, 'zh');
      expect(result).toContain('# ARTICOLO');
      expect(result).toContain('# RIASSUNTO');
    });

    it('test_buildQAPrompt_includes_numbered_paragraphs', () => {
      const result = AdvancedAnalysis.buildQAPrompt('Q?', mockArticle, mockSummary, 'it');

      expect(result).toContain('§1: First paragraph content.');
      expect(result).toContain('§2: Second paragraph content.');
      expect(result).toContain('§3: Third paragraph content.');
    });

    it('test_buildQAPrompt_includes_article_title', () => {
      const result = AdvancedAnalysis.buildQAPrompt('Q?', mockArticle, mockSummary, 'it');
      expect(result).toContain('**Titolo:** Test Article');
    });

    it('test_buildQAPrompt_includes_instruction', () => {
      const result = AdvancedAnalysis.buildQAPrompt('Q?', mockArticle, mockSummary, 'en');
      expect(result).toContain('Answer the question based on the article content');
      expect(result).toContain('§N');
    });
  });

  describe('getQASystemPrompt', () => {
    it('test_getQASystemPrompt_returns_string_for_each_provider', () => {
      for (const provider of ['groq', 'openai', 'anthropic', 'gemini']) {
        const prompt = AdvancedAnalysis.getQASystemPrompt(provider, 'it');
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(100);
      }
    });

    it('test_getQASystemPrompt_italian_contains_italian_instructions', () => {
      const prompt = AdvancedAnalysis.getQASystemPrompt('groq', 'it');
      expect(prompt).toContain('italiano');
    });

    it('test_getQASystemPrompt_english_contains_english_instructions', () => {
      const prompt = AdvancedAnalysis.getQASystemPrompt('openai', 'en');
      expect(prompt).toContain('English');
    });

    it('test_getQASystemPrompt_unknown_provider_falls_back_to_groq', () => {
      const prompt = AdvancedAnalysis.getQASystemPrompt('unknown', 'it');
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(50);
    });

    it('test_getQASystemPrompt_generates_es_fr_de_from_en', () => {
      const esPrompt = AdvancedAnalysis.getQASystemPrompt('groq', 'es');
      expect(esPrompt).toContain('español');

      const frPrompt = AdvancedAnalysis.getQASystemPrompt('groq', 'fr');
      expect(frPrompt).toContain('français');

      const dePrompt = AdvancedAnalysis.getQASystemPrompt('groq', 'de');
      expect(dePrompt).toContain('Deutsch');
    });
  });
});
