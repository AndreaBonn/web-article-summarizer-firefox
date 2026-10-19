import { describe, it, expect } from 'vitest';
import {
  validatePdfFile,
  buildPdfHistoryRecord,
  buildPdfReadingModeData,
  selectProvider,
} from '../../src/pages/pdf-analysis/pdf-intake.js';

const MB = 1024 * 1024;

describe('validatePdfFile', () => {
  it('accepts a PDF under the limit', () => {
    expect(validatePdfFile({ type: 'application/pdf', size: 1000 })).toBeNull();
  });

  it('accepts a PDF of exactly 20MB', () => {
    expect(validatePdfFile({ type: 'application/pdf', size: 20 * MB })).toBeNull();
  });

  it('rejects a PDF of 20MB + 1 byte', () => {
    expect(validatePdfFile({ type: 'application/pdf', size: 20 * MB + 1 })).toBe(
      'File troppo grande. Massimo 20MB.',
    );
  });

  it('rejects a non-PDF type', () => {
    expect(validatePdfFile({ type: 'image/png', size: 10 })).toBe(
      'File non valido. Carica un file PDF.',
    );
  });

  it('reports the type error before the size error', () => {
    expect(validatePdfFile({ type: 'image/png', size: 30 * MB })).toBe(
      'File non valido. Carica un file PDF.',
    );
  });
});

describe('buildPdfHistoryRecord', () => {
  const file = { name: 'doc.pdf', size: 2048 };
  const settings = { outputLanguage: 'it', summaryLength: 'medium' };

  it('maps a fresh analysis result (pageCount, extractedText)', () => {
    const result = { pageCount: 7, extractedText: 'testo', isFromCache: false };
    const { pdfInfo, metadata } = buildPdfHistoryRecord({
      file,
      result,
      provider: 'groq',
      settings,
    });
    expect(pdfInfo).toEqual({ name: 'doc.pdf', size: 2048, pages: 7, text: 'testo', metadata: {} });
    expect(metadata).toEqual({
      provider: 'groq',
      language: 'it',
      summaryLength: 'medium',
      fromCache: false,
    });
  });

  it('maps a cached result (pdfInfo.pages/text/metadata, fromCache)', () => {
    const result = {
      fromCache: true,
      pdfInfo: { pages: 3, text: 'cached', metadata: { author: 'X' } },
    };
    const { pdfInfo, metadata } = buildPdfHistoryRecord({
      file,
      result,
      provider: 'openai',
      settings,
    });
    expect(pdfInfo.pages).toBe(3);
    expect(pdfInfo.text).toBe('cached');
    expect(pdfInfo.metadata).toEqual({ author: 'X' });
    expect(metadata.fromCache).toBe(true);
  });

  it('uses isFromCache when set', () => {
    const { metadata } = buildPdfHistoryRecord({
      file,
      result: { isFromCache: true },
      provider: 'groq',
      settings,
    });
    expect(metadata.fromCache).toBe(true);
  });

  it('falls back to 0 pages, empty text and empty metadata', () => {
    const { pdfInfo } = buildPdfHistoryRecord({ file, result: {}, provider: 'groq', settings });
    expect(pdfInfo.pages).toBe(0);
    expect(pdfInfo.text).toBe('');
    expect(pdfInfo.metadata).toEqual({});
  });
});

describe('buildPdfReadingModeData', () => {
  it('removes pdfFile, adds the timestamp and keeps other fields', () => {
    const input = { summary: 's', historyId: 'h1', pdfFile: new Blob(['x']) };
    const out = buildPdfReadingModeData(input, 1234);
    expect(out).toEqual({ summary: 's', historyId: 'h1', timestamp: 1234 });
    expect('pdfFile' in out).toBe(false);
  });

  it('does not mutate the input', () => {
    const file = new Blob(['x']);
    const input = { summary: 's', pdfFile: file };
    buildPdfReadingModeData(input, 1);
    expect(input.pdfFile).toBe(file);
    expect('timestamp' in input).toBe(false);
  });
});

describe('selectProvider', () => {
  const makeSelect = () => {
    const select = document.createElement('select');
    for (const [value, label] of [
      ['groq', 'Groq'],
      ['openai', 'OpenAI'],
      ['anthropic', 'Claude'],
      ['gemini', 'Gemini'],
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    return select;
  };

  it('selects the saved provider and returns its label', () => {
    const select = makeSelect();
    expect(selectProvider(select, 'anthropic')).toBe('Claude');
    expect(select.value).toBe('anthropic');
  });

  it.each([undefined, '', 'claude'])('falls back to groq for saved provider %j', (saved) => {
    const select = makeSelect();
    expect(selectProvider(select, saved)).toBe('Groq');
    expect(select.value).toBe('groq');
  });
});
