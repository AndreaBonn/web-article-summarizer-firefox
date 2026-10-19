import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIOrchestrator } from '@utils/ai/api-orchestrator.js';
import { translatePDFText, extractPDFCitations, askQuestionPDF } from '@pages/reading-mode/pdf.js';

vi.mock('@utils/ai/api-orchestrator.js', () => ({
  APIOrchestrator: { generateCompletion: vi.fn() },
}));

const PROVIDER = 'groq';
const API_KEY = 'test-key';
const DOCUMENT = 'The research measured twelve samples.';
const SUMMARY = 'Twelve samples were measured.';
const QUESTION = 'How many samples were measured?';

describe('PDF AI helpers', () => {
  beforeEach(() => {
    APIOrchestrator.generateCompletion.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('reports when a translation is already in the requested language', async () => {
    APIOrchestrator.generateCompletion.mockResolvedValue('SAME_LANGUAGE');
    await expect(translatePDFText(DOCUMENT, 'en', PROVIDER, API_KEY)).resolves.toEqual({
      sameLanguage: true,
    });
  });

  it('returns translated text and passes sanitized content to the chosen provider', async () => {
    APIOrchestrator.generateCompletion.mockResolvedValue('La ricerca ha misurato dodici campioni.');
    await expect(translatePDFText(`<b>${DOCUMENT}</b>`, 'it', PROVIDER, API_KEY)).resolves.toEqual({
      sameLanguage: false,
      translation: 'La ricerca ha misurato dodici campioni.',
    });
    expect(APIOrchestrator.generateCompletion).toHaveBeenCalledExactlyOnceWith(
      PROVIDER,
      API_KEY,
      expect.stringContaining('italiano'),
      `Traduci questo testo in italiano:\n\n${DOCUMENT}`,
      { temperature: 0.3, maxTokens: 4000 },
    );
  });

  it('returns the provider response as a translation when forced, including the language marker', async () => {
    APIOrchestrator.generateCompletion.mockResolvedValue('SAME_LANGUAGE');
    await expect(translatePDFText(DOCUMENT, 'en', PROVIDER, API_KEY, true)).resolves.toEqual({
      sameLanguage: false,
      translation: 'SAME_LANGUAGE',
    });
    expect(APIOrchestrator.generateCompletion).toHaveBeenCalledExactlyOnceWith(
      PROVIDER,
      API_KEY,
      expect.stringContaining('riformattare e migliorare'),
      `Riformatta e migliora questo testo in inglese:\n\n${DOCUMENT}`,
      { temperature: 0.3, maxTokens: 4000 },
    );
  });

  it('preserves the API error as the cause of a translation failure', async () => {
    const cause = new Error('Provider unavailable');
    APIOrchestrator.generateCompletion.mockRejectedValue(cause);
    await expect(translatePDFText(DOCUMENT, 'it', PROVIDER, API_KEY)).rejects.toMatchObject({
      message: 'Errore durante la traduzione: Provider unavailable',
      cause,
    });
  });

  it('parses citation JSON into the documented citation structure', async () => {
    APIOrchestrator.generateCompletion.mockResolvedValue(
      JSON.stringify({
        citations: [{ quote_text: 'Twelve samples', author: 'Ada', type: 'direct_quote' }],
        total_citations: 1,
      }),
    );
    await expect(extractPDFCitations(DOCUMENT, 'research.pdf', PROVIDER, API_KEY)).resolves.toEqual(
      {
        citations: [{ quote_text: 'Twelve samples', author: 'Ada', type: 'direct_quote' }],
        total_citations: 1,
      },
    );
    expect(APIOrchestrator.generateCompletion).toHaveBeenCalledExactlyOnceWith(
      PROVIDER,
      API_KEY,
      expect.stringContaining('citazioni'),
      expect.stringContaining(DOCUMENT),
      { temperature: 0.1, maxTokens: 2000 },
    );
  });

  it('accepts a document with no citations', async () => {
    APIOrchestrator.generateCompletion.mockResolvedValue('{"citations":[],"total_citations":0}');
    await expect(extractPDFCitations(DOCUMENT, 'research.pdf', PROVIDER, API_KEY)).resolves.toEqual(
      { citations: [], total_citations: 0 },
    );
  });

  it('reports invalid citation JSON using the user-facing error', async () => {
    APIOrchestrator.generateCompletion.mockResolvedValue('No JSON available');
    await expect(extractPDFCitations(DOCUMENT, 'research.pdf', PROVIDER, API_KEY)).rejects.toThrow(
      'Errore estrazione citazioni: Il provider AI ha restituito un formato di citazioni non valido. Riprova.',
    );
  });

  it('preserves the API error when citation extraction fails', async () => {
    const cause = new Error('Rate limit');
    APIOrchestrator.generateCompletion.mockRejectedValue(cause);
    await expect(
      extractPDFCitations(DOCUMENT, 'research.pdf', PROVIDER, API_KEY),
    ).rejects.toMatchObject({ message: 'Errore estrazione citazioni: Rate limit', cause });
  });

  it('answers from the sanitized document, summary and question', async () => {
    APIOrchestrator.generateCompletion.mockResolvedValue('Twelve samples.');
    await expect(
      askQuestionPDF(QUESTION, `<b>${DOCUMENT}</b>`, SUMMARY, PROVIDER, API_KEY),
    ).resolves.toBe('Twelve samples.');
    expect(APIOrchestrator.generateCompletion).toHaveBeenCalledExactlyOnceWith(
      PROVIDER,
      API_KEY,
      expect.stringContaining('ESCLUSIVAMENTE'),
      `DOCUMENTO:\n${DOCUMENT}\n\nRIASSUNTO:\n${SUMMARY}\n\nDOMANDA:\n${QUESTION}\n\nRispondi alla domanda basandoti sul documento sopra.`,
      { temperature: 0.3, maxTokens: 1000 },
    );
  });

  it('reports API answer failures with the expected prefix and cause', async () => {
    const cause = new Error('Connection lost');
    APIOrchestrator.generateCompletion.mockRejectedValue(cause);
    await expect(
      askQuestionPDF(QUESTION, DOCUMENT, SUMMARY, PROVIDER, API_KEY),
    ).rejects.toMatchObject({ message: 'Errore durante la risposta: Connection lost', cause });
  });
});
