import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock deps before importing module under test
// ---------------------------------------------------------------------------

vi.mock('@utils/ai/completion-client.js', () => ({
  requestCompletion: vi.fn(),
}));

vi.mock('@utils/ai/json-repair.js', () => ({
  parseLLMJson: vi.fn(),
}));

vi.mock('@utils/core/logger.js', () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@utils/ai/prompts/multi-analysis-prompts.js', () => ({
  getGlobalSummaryPrompt: vi.fn(() => 'global-summary-system-prompt'),
  getComparisonPrompt: vi.fn(() => 'comparison-system-prompt'),
  getQAPrompt: vi.fn(() => 'qa-system-prompt'),
}));

import {
  generateGlobalSummary,
  generateComparison,
  generateQA,
  parseQAFromText,
} from '@utils/core/multi-analysis-generators.js';

import { requestCompletion } from '@utils/ai/completion-client.js';
import { parseLLMJson } from '@utils/ai/json-repair.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const makeArticle = (overrides = {}) => ({
  article: { title: 'Article Title', url: 'https://example.com', wordCount: 500 },
  summary: 'Summary text for the article.',
  keyPoints: [{ title: 'Point A', description: 'Description A' }],
  translation: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// generateGlobalSummary
// ---------------------------------------------------------------------------

describe('generateGlobalSummary()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestCompletion.mockResolvedValue('Global summary result');
  });

  it('asks the service worker for the completion with the provider and system prompt', async () => {
    const articles = [makeArticle()];
    await generateGlobalSummary(articles, 'groq');

    expect(requestCompletion).toHaveBeenCalledOnce();
    const [provider, systemPrompt] = requestCompletion.mock.calls[0];
    expect(provider).toBe('groq');
    expect(systemPrompt).toBe('global-summary-system-prompt');
  });

  it('returns the value from requestCompletion', async () => {
    const articles = [makeArticle()];
    const result = await generateGlobalSummary(articles, 'groq');

    expect(result).toBe('Global summary result');
  });

  it('uses article summary when no translation present', async () => {
    const articles = [makeArticle({ translation: null, summary: 'My summary text' })];
    await generateGlobalSummary(articles, 'groq');

    const userPrompt = requestCompletion.mock.calls[0][2];
    expect(userPrompt).toContain('My summary text');
  });

  it('uses a translation stored as a plain string', async () => {
    const articles = [makeArticle({ translation: 'Stringa tradotta', summary: 'Original' })];
    await generateGlobalSummary(articles, 'groq');

    const userPrompt = requestCompletion.mock.calls[0][2];
    expect(userPrompt).toContain('Stringa tradotta');
    expect(userPrompt).not.toContain('Original');
  });

  it('uses translation text when translation is present', async () => {
    const articles = [
      makeArticle({ translation: { text: 'Translated content' }, summary: 'Original' }),
    ];
    await generateGlobalSummary(articles, 'groq');

    const userPrompt = requestCompletion.mock.calls[0][2];
    expect(userPrompt).toContain('Translated content');
    expect(userPrompt).not.toContain('Original');
  });

  it('includes article title and URL in user prompt', async () => {
    const articles = [makeArticle()];
    await generateGlobalSummary(articles, 'groq');

    const userPrompt = requestCompletion.mock.calls[0][2];
    expect(userPrompt).toContain('Article Title');
    expect(userPrompt).toContain('https://example.com');
  });

  it('includes key points in user prompt when present', async () => {
    const articles = [
      makeArticle({
        keyPoints: [{ title: 'KP1', description: 'Desc1' }],
      }),
    ];
    await generateGlobalSummary(articles, 'groq');

    const userPrompt = requestCompletion.mock.calls[0][2];
    expect(userPrompt).toContain('KP1');
    expect(userPrompt).toContain('Desc1');
  });

  it('omits key points section when keyPoints is empty', async () => {
    const articles = [makeArticle({ keyPoints: [] })];
    await generateGlobalSummary(articles, 'groq');

    const userPrompt = requestCompletion.mock.calls[0][2];
    expect(userPrompt).not.toContain('Punti Chiave');
  });

  it('sets maxTokens to 8192 for gemini provider', async () => {
    const articles = [makeArticle()];
    await generateGlobalSummary(articles, 'gemini');

    const options = requestCompletion.mock.calls[0][3];
    expect(options.maxTokens).toBe(8192);
  });

  it('sets maxTokens to 4000 for non-gemini providers', async () => {
    const articles = [makeArticle()];
    await generateGlobalSummary(articles, 'openai');

    const options = requestCompletion.mock.calls[0][3];
    expect(options.maxTokens).toBe(4000);
  });

  it('handles multiple articles correctly', async () => {
    const articles = [
      makeArticle(),
      makeArticle({ article: { title: 'Second', url: 'https://b.com', wordCount: 200 } }),
    ];
    await generateGlobalSummary(articles, 'groq');

    const userPrompt = requestCompletion.mock.calls[0][2];
    expect(userPrompt).toContain('ARTICOLO 1');
    expect(userPrompt).toContain('ARTICOLO 2');
  });
});

// ---------------------------------------------------------------------------
// generateComparison
// ---------------------------------------------------------------------------

describe('generateComparison()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestCompletion.mockResolvedValue('Comparison result');
  });

  it('calls requestCompletion once', async () => {
    const articles = [makeArticle(), makeArticle()];
    await generateComparison(articles, 'groq');

    expect(requestCompletion).toHaveBeenCalledOnce();
  });

  it('returns the value from requestCompletion', async () => {
    const articles = [makeArticle()];
    const result = await generateComparison(articles, 'groq');

    expect(result).toBe('Comparison result');
  });

  it('sets gemini-specific maxTokens and leaves the model to the provider default', async () => {
    const articles = [makeArticle()];
    await generateComparison(articles, 'gemini');

    const options = requestCompletion.mock.calls[0][3];
    expect(options.maxTokens).toBe(8000);
    expect(options).not.toHaveProperty('model');
  });

  it('uses default maxTokens 4000 for non-gemini providers', async () => {
    const articles = [makeArticle()];
    await generateComparison(articles, 'anthropic');

    const options = requestCompletion.mock.calls[0][3];
    expect(options.maxTokens).toBe(4000);
    expect(options.model).toBeUndefined();
  });

  it('uses translation text when available', async () => {
    const articles = [makeArticle({ translation: { text: 'Translated' }, summary: 'Original' })];
    await generateComparison(articles, 'groq');

    const userPrompt = requestCompletion.mock.calls[0][2];
    expect(userPrompt).toContain('Translated');
    expect(userPrompt).not.toContain('Original');
  });

  it('includes article titles in user prompt', async () => {
    const articles = [
      makeArticle({ article: { title: 'First Article', url: 'https://a.com', wordCount: 100 } }),
    ];
    await generateComparison(articles, 'groq');

    const userPrompt = requestCompletion.mock.calls[0][2];
    expect(userPrompt).toContain('First Article');
  });
});

// ---------------------------------------------------------------------------
// generateQA
// ---------------------------------------------------------------------------

describe('generateQA()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed JSON when parseLLMJson succeeds', async () => {
    const parsedData = [{ question: 'Q?', answer: 'A.' }];
    requestCompletion.mockResolvedValue('```json\n[{"question":"Q?","answer":"A."}]\n```');
    parseLLMJson.mockReturnValue(parsedData);

    const result = await generateQA([makeArticle()], 'groq', 'key');

    expect(result).toEqual(parsedData);
  });

  it('falls back to parseQAFromText when parseLLMJson throws', async () => {
    requestCompletion.mockResolvedValue('Q1: Question?\nR1: Answer.');
    parseLLMJson.mockImplementation(() => {
      throw new Error('parse failed');
    });

    const result = await generateQA([makeArticle()], 'groq', 'key');

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('question');
    expect(result[0]).toHaveProperty('answer');
  });

  it('strips markdown code fences before parsing', async () => {
    requestCompletion.mockResolvedValue('```json\n{"qa": []}\n```');
    const parsed = { qa: [] };
    parseLLMJson.mockReturnValue(parsed);

    await generateQA([makeArticle()], 'groq', 'key');

    const passedText = parseLLMJson.mock.calls[0][0];
    expect(passedText).not.toContain('```');
  });

  it('sets maxTokens to 4096 for gemini provider', async () => {
    requestCompletion.mockResolvedValue('Q1: Q?\nR1: A.');
    parseLLMJson.mockImplementation(() => {
      throw new Error('x');
    });

    await generateQA([makeArticle()], 'gemini', 'key');

    const options = requestCompletion.mock.calls[0][3];
    expect(options.maxTokens).toBe(4096);
  });

  it('sets maxTokens to 3000 for non-gemini providers', async () => {
    requestCompletion.mockResolvedValue('Q1: Q?\nR1: A.');
    parseLLMJson.mockImplementation(() => {
      throw new Error('x');
    });

    await generateQA([makeArticle()], 'groq', 'key');

    const options = requestCompletion.mock.calls[0][3];
    expect(options.maxTokens).toBe(3000);
  });

  it('returns default QA when response has no Q/R pattern and parsing fails', async () => {
    requestCompletion.mockResolvedValue('plain text without any pattern');
    parseLLMJson.mockImplementation(() => {
      throw new Error('x');
    });

    const result = await generateQA([makeArticle()], 'groq', 'key');

    expect(result).toHaveLength(1);
    expect(result[0].question).toContain('temi principali');
  });
});

// Risposta di default attesa quando non ci sono coppie Q/R valide
const DEFAULT_QA = [
  {
    question: 'Quali sono i temi principali trattati negli articoli?',
    answer:
      "Gli articoli trattano diversi temi interconnessi che richiedono un'analisi approfondita.",
  },
];

// ---------------------------------------------------------------------------
// Formato standard: Q1: / R1:
// ---------------------------------------------------------------------------

describe('parseQAFromText() — formato standard Q/R con due punti', () => {
  it('test_parseQAFromText_withSinglePairColonFormat_returnsOnePair', () => {
    // Arrange
    const text = 'Q1: Qual è il tema principale?\nR1: Il tema è la sostenibilità.';

    // Act
    const result = parseQAFromText(text);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe('Qual è il tema principale?');
    expect(result[0].answer).toBe('Il tema è la sostenibilità.');
  });

  it('test_parseQAFromText_withMultiplePairsColonFormat_returnsAllPairs', () => {
    // Arrange
    const text = [
      'Q1: Prima domanda?',
      'R1: Prima risposta.',
      'Q2: Seconda domanda?',
      'R2: Seconda risposta.',
    ].join('\n');

    // Act
    const result = parseQAFromText(text);

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].question).toBe('Prima domanda?');
    expect(result[0].answer).toBe('Prima risposta.');
    expect(result[1].question).toBe('Seconda domanda?');
    expect(result[1].answer).toBe('Seconda risposta.');
  });
});

// ---------------------------------------------------------------------------
// Formato alternativo: Q1. / R1.
// ---------------------------------------------------------------------------

describe('parseQAFromText() — formato con punto Q1./R1.', () => {
  it('test_parseQAFromText_withDotFormatSinglePair_returnsOnePair', () => {
    // Arrange
    const text = "Q1. Cosa afferma l'articolo?\nR1. Afferma che il cambiamento è necessario.";

    // Act
    const result = parseQAFromText(text);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe("Cosa afferma l'articolo?");
    expect(result[0].answer).toBe('Afferma che il cambiamento è necessario.');
  });

  it('test_parseQAFromText_withDotFormatMultiplePairs_returnsAllPairs', () => {
    // Arrange
    const text = [
      'Q1. Domanda uno?',
      'R1. Risposta uno.',
      'Q2. Domanda due?',
      'R2. Risposta due.',
      'Q3. Domanda tre?',
      'R3. Risposta tre.',
    ].join('\n');

    // Act
    const result = parseQAFromText(text);

    // Assert
    expect(result).toHaveLength(3);
    expect(result[2].question).toBe('Domanda tre?');
    expect(result[2].answer).toBe('Risposta tre.');
  });
});

// ---------------------------------------------------------------------------
// Risposte multi-riga
// ---------------------------------------------------------------------------

describe('parseQAFromText() — risposte su più righe', () => {
  it('test_parseQAFromText_withMultilineAnswer_concatenatesLines', () => {
    // Arrange
    const text = [
      "Q1: Qual è l'impatto?",
      "R1: L'impatto è significativo.",
      'Ha conseguenze su più settori.',
      'Inclusi quello economico e sociale.',
    ].join('\n');

    // Act
    const result = parseQAFromText(text);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].answer).toContain("L'impatto è significativo.");
    expect(result[0].answer).toContain('Ha conseguenze su più settori.');
    expect(result[0].answer).toContain('Inclusi quello economico e sociale.');
  });

  it('test_parseQAFromText_withMultilineAnswerAndNextQuestion_separatesCorrectly', () => {
    // Arrange
    const text = [
      'Q1: Prima domanda?',
      'R1: Prima riga risposta.',
      'Seconda riga risposta.',
      'Q2: Seconda domanda?',
      'R2: Risposta breve.',
    ].join('\n');

    // Act
    const result = parseQAFromText(text);

    // Assert
    expect(result).toHaveLength(2);
    // La prima risposta deve contenere entrambe le righe
    expect(result[0].answer).toContain('Prima riga risposta.');
    expect(result[0].answer).toContain('Seconda riga risposta.');
    // La seconda risposta non deve essere contaminata dalla prima
    expect(result[1].answer).toBe('Risposta breve.');
  });

  it('test_parseQAFromText_withBlankLinesInAnswer_ignoresBlanks', () => {
    // Righe vuote non vengono concatenate (la guard `line.trim()` le esclude)
    const text = ['Q1: Domanda?', 'R1: Prima riga.', '', 'Seconda riga.'].join('\n');

    const result = parseQAFromText(text);

    expect(result).toHaveLength(1);
    // La riga vuota non aggiunge contenuto
    expect(result[0].answer).toContain('Prima riga.');
  });
});

// ---------------------------------------------------------------------------
// Testo vuoto → default
// ---------------------------------------------------------------------------

describe('parseQAFromText() — testo vuoto', () => {
  it('test_parseQAFromText_withEmptyString_returnsDefaultQA', () => {
    const result = parseQAFromText('');
    expect(result).toEqual(DEFAULT_QA);
  });

  it('test_parseQAFromText_withWhitespaceOnly_returnsDefaultQA', () => {
    const result = parseQAFromText('   \n\n\t  ');
    expect(result).toEqual(DEFAULT_QA);
  });
});

// ---------------------------------------------------------------------------
// Testo senza pattern Q/R → default
// ---------------------------------------------------------------------------

describe('parseQAFromText() — testo senza pattern Q/R', () => {
  it('test_parseQAFromText_withPlainText_returnsDefaultQA', () => {
    const text = 'Questo è un testo normale senza domande e risposte.';
    const result = parseQAFromText(text);
    expect(result).toEqual(DEFAULT_QA);
  });

  it('test_parseQAFromText_withJsonLikeText_returnsDefaultQA', () => {
    // Testo strutturato ma senza il pattern Q/R
    const text = '{ "domanda": "testo", "risposta": "altro testo" }';
    const result = parseQAFromText(text);
    expect(result).toEqual(DEFAULT_QA);
  });

  it('test_parseQAFromText_withQuestionButNoAnswer_returnsDefaultQA', () => {
    // C'è un Q ma nessuna R corrispondente: la coppia non viene salvata
    const text = 'Q1: Domanda senza risposta?';
    const result = parseQAFromText(text);
    expect(result).toEqual(DEFAULT_QA);
  });

  it('test_parseQAFromText_withAnswerButNoQuestion_returnsDefaultQA', () => {
    // C'è un R ma nessuna Q: currentQ è null → la coppia non viene accumulata
    const text = 'R1: Risposta senza domanda.';
    const result = parseQAFromText(text);
    expect(result).toEqual(DEFAULT_QA);
  });
});

// ---------------------------------------------------------------------------
// Struttura delle coppie restituite
// ---------------------------------------------------------------------------

describe('parseQAFromText() — struttura output', () => {
  it('test_parseQAFromText_withValidPair_returnsObjectWithQuestionAndAnswer', () => {
    const text = 'Q1: Test?\nR1: Risposta test.';
    const result = parseQAFromText(text);

    expect(result[0]).toHaveProperty('question');
    expect(result[0]).toHaveProperty('answer');
  });

  it('test_parseQAFromText_returnedPairsAreNotEmpty', () => {
    const text = 'Q1: Domanda valida?\nR1: Risposta valida.';
    const result = parseQAFromText(text);

    expect(result[0].question.length).toBeGreaterThan(0);
    expect(result[0].answer.length).toBeGreaterThan(0);
  });

  it('test_parseQAFromText_defaultQA_hasExactlyOneItem', () => {
    const result = parseQAFromText('');
    expect(result).toHaveLength(1);
  });
});
