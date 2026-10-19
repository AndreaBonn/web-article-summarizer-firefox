import { afterEach, expect, it, vi } from 'vitest';

const cache = vi.hoisted(() => ({
  checkCache: vi.fn(),
  saveAnalysis: vi.fn(),
}));

vi.mock('@utils/pdf/pdf-cache-manager.js', () => ({
  PDFCacheManager: class {
    checkCache(...args) {
      return cache.checkCache(...args);
    }
    saveAnalysis(...args) {
      return cache.saveAnalysis(...args);
    }
  },
}));
vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn() }));
vi.mock('@utils/ai/api-orchestrator.js', () => ({
  APIOrchestrator: { generateCompletion: vi.fn() },
}));

import { PDFAnalyzer } from '@utils/pdf/pdf-analyzer.js';
import { APIOrchestrator } from '@utils/ai/api-orchestrator.js';
import { getDocument } from 'pdfjs-dist';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it('test_analyzePDF_cacheMiss_savesExtractedTextAndAnalysis', async () => {
  const text =
    'The annual report describes revenue growth, lower operating costs, and investment in ' +
    'renewable energy across all regional offices.';
  const file = {
    name: 'annual-report.pdf',
    type: 'application/pdf',
    size: 512,
    arrayBuffer: async () => new ArrayBuffer(1),
  };
  vi.stubGlobal('browser', {
    storage: { local: { get: vi.fn().mockResolvedValue({ apiKeys: { openai: 'test-key' } }) } },
  });
  cache.checkCache.mockResolvedValue({ found: false, fileHash: 'report-hash' });
  cache.saveAnalysis.mockResolvedValue({ id: 'saved-report' });
  getDocument.mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({ getTextContent: async () => ({ items: [{ str: text }] }) }),
    }),
  });
  APIOrchestrator.generateCompletion.mockResolvedValue(
    JSON.stringify({
      summary: 'Revenue grew and operating costs fell.',
      keyPoints: [{ title: 'Energy', description: 'Investment in renewables.' }],
      quotes: [],
    }),
  );

  const result = await new PDFAnalyzer().analyzePDF(file, 'openai', { outputLanguage: 'en' });

  expect(result).toMatchObject({
    summary: 'Revenue grew and operating costs fell.',
    keyPoints: [{ title: 'Energy', description: 'Investment in renewables.' }],
    pageCount: 1,
    isFromCache: false,
    filename: 'annual-report.pdf',
  });
  expect(result.extractedText).toContain(text);
  expect(cache.saveAnalysis).toHaveBeenCalledExactlyOnceWith(
    file,
    expect.stringContaining(text),
    {
      summary: 'Revenue grew and operating costs fell.',
      keyPoints: [{ title: 'Energy', description: 'Investment in renewables.' }],
      quotes: [],
      pageCount: 1,
    },
    'openai',
    'report-hash',
  );
});
