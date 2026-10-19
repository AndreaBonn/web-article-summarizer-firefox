import { describe, it, expect } from 'vitest';
import {
  buildReadingModeCopyText,
  buildPdfExportArgs,
  toArticleWithParagraphs,
} from '../../src/pages/reading-mode/copy-text.js';

const SEP = '='.repeat(60);

describe('buildReadingModeCopyText', () => {
  it('test_buildReadingModeCopyText_article_headerSummaryAndKeyPointsWithParagraphs', () => {
    const text = buildReadingModeCopyText({
      article: { title: 'Titolo', url: 'https://x.test' },
      summary: 'Sintesi',
      keyPoints: [{ title: 'KP', paragraphs: '1-2', description: 'desc' }],
    });
    expect(text).toBe(
      `ARTICOLO: Titolo\nURL: https://x.test\n\n${SEP}\n\nRIASSUNTO:\nSintesi\n\nPUNTI CHIAVE:\n1. KP (§1-2)\n   desc\n\n`,
    );
  });
  it('test_buildReadingModeCopyText_pdf_keyPointsWithoutParagraphRefs', () => {
    const text = buildReadingModeCopyText({
      isPDF: true,
      pdf: { name: 'doc.pdf', pages: 3 },
      summary: 'S',
      keyPoints: [{ title: 'KP', paragraphs: '1-2', description: 'desc' }],
    });
    expect(text).toBe(
      `PDF: doc.pdf\nPagine: 3\n\n${SEP}\n\nRIASSUNTO:\nS\n\nPUNTI CHIAVE:\n1. KP\n   desc\n\n`,
    );
  });
  it('test_buildReadingModeCopyText_pdfWithoutNameAndPages_usesFallbacks', () => {
    const text = buildReadingModeCopyText({ isPDF: true, summary: 'S' });
    expect(text.startsWith('PDF: Documento\nPagine: N/A\n\n')).toBe(true);
  });
  it('test_buildReadingModeCopyText_pdfFlatFields_usedWhenNoPdfObject', () => {
    const text = buildReadingModeCopyText({
      isPDF: true,
      filename: 'flat.pdf',
      pageCount: 9,
      summary: 'S',
    });
    expect(text.startsWith('PDF: flat.pdf\nPagine: 9\n\n')).toBe(true);
  });
  it('test_buildReadingModeCopyText_pdfObjectWithoutIsPdfFlag_treatedAsPdf', () => {
    const text = buildReadingModeCopyText({ pdf: { name: 'n.pdf', pages: 1 }, summary: 'S' });
    expect(text.startsWith('PDF: n.pdf\n')).toBe(true);
  });
  it('test_buildReadingModeCopyText_allSections_inOrderTranslationQaCitationsNotes', () => {
    const text = buildReadingModeCopyText({
      article: { title: 'T', url: 'u' },
      summary: 'S',
      translation: 'Tradotto',
      qa: [{ question: 'D?', answer: 'R!' }],
      citations: {
        citations: [{ author: 'Rossi', year: 2020, source: 'Libro', quote_text: 'cit' }],
      },
      notes: 'mie note',
    });
    const iTr = text.indexOf(`TRADUZIONE:\nTradotto`);
    const iQa = text.indexOf('DOMANDE E RISPOSTE:\n\nQ1: D?\nR1: R!');
    const iCit = text.indexOf('CITAZIONI (1):\n\n[1] Rossi (2020) - Libro\n   "cit"');
    const iNotes = text.indexOf(`${SEP}\n\nNOTE PERSONALI:\nmie note\n\n`);
    expect(iTr).toBeGreaterThan(-1);
    expect(iQa).toBeGreaterThan(iTr);
    expect(iCit).toBeGreaterThan(iQa);
    expect(iNotes).toBeGreaterThan(iCit);
  });
  it('test_buildReadingModeCopyText_noOptionalSections_omitsThem', () => {
    const text = buildReadingModeCopyText({ article: { title: 'T', url: 'u' }, summary: 'S' });
    for (const label of ['TRADUZIONE', 'DOMANDE E RISPOSTE', 'CITAZIONI', 'NOTE PERSONALI']) {
      expect(text).not.toContain(label);
    }
    expect(text).toContain('RIASSUNTO:\nS');
  });
});

describe('buildPdfExportArgs', () => {
  it('test_buildPdfExportArgs_article_passedThroughWithMetadata', () => {
    const article = { title: 'T', url: 'u', content: 'c' };
    const metadata = { provider: 'groq', language: 'en', contentType: 'news' };
    const { articleData, metadataData } = buildPdfExportArgs({ article, metadata });
    expect(articleData).toBe(article);
    expect(metadataData).toBe(metadata);
  });
  it('test_buildPdfExportArgs_pdfWithoutName_titleIsDocumentoPdf', () => {
    const { articleData } = buildPdfExportArgs({ isPDF: true, extractedText: 'testo' });
    expect(articleData).toEqual({
      title: 'Documento PDF',
      url: 'PDF Document',
      content: 'testo',
      wordCount: 0,
      readingTimeMinutes: 0,
    });
  });
  it('test_buildPdfExportArgs_pdfNameOrder_pdfNameThenFilename', () => {
    expect(
      buildPdfExportArgs({ pdf: { name: 'a.pdf' }, filename: 'b.pdf' }).articleData.title,
    ).toBe('a.pdf');
    expect(buildPdfExportArgs({ isPDF: true, filename: 'b.pdf' }).articleData.title).toBe('b.pdf');
  });
  it('test_buildPdfExportArgs_pdfContent_extractedTextThenPdfTextThenEmpty', () => {
    expect(
      buildPdfExportArgs({ isPDF: true, extractedText: 'E', pdf: { text: 'P' } }).articleData
        .content,
    ).toBe('E');
    expect(buildPdfExportArgs({ pdf: { text: 'P' } }).articleData.content).toBe('P');
    expect(buildPdfExportArgs({ isPDF: true }).articleData.content).toBe('');
  });
  it('test_buildPdfExportArgs_noMetadata_defaultsToPdfMetadata', () => {
    expect(buildPdfExportArgs({ isPDF: true }).metadataData).toEqual({
      provider: 'AI',
      language: 'it',
      contentType: 'pdf',
    });
  });
  it('test_buildPdfExportArgs_noMetadataWithApiProvider_usesProvider', () => {
    expect(buildPdfExportArgs({ isPDF: true, apiProvider: 'openai' }).metadataData.provider).toBe(
      'openai',
    );
  });
});

describe('toArticleWithParagraphs', () => {
  it('test_toArticleWithParagraphs_contentOnly_numbersParagraphsFromOneSkippingBlanks', () => {
    const result = toArticleWithParagraphs({ title: 'T', content: ' uno \n\n\n\n  \n\ndue ' });
    expect(result.paragraphs).toEqual([
      { id: 1, text: 'uno' },
      { id: 2, text: 'due' },
    ]);
    expect(result.title).toBe('T');
  });
  it('test_toArticleWithParagraphs_existingParagraphs_keptAsIs', () => {
    const paragraphs = [{ id: 1, text: 'p' }];
    const result = toArticleWithParagraphs({ content: 'ignored\n\nignored', paragraphs });
    expect(result.paragraphs).toBe(paragraphs);
  });
  it('test_toArticleWithParagraphs_neitherContentNorParagraphs_emptyArray', () => {
    expect(toArticleWithParagraphs({ title: 'T' }).paragraphs).toEqual([]);
  });
  it('test_toArticleWithParagraphs_input_isNotMutated', () => {
    const article = { content: 'a\n\nb' };
    const result = toArticleWithParagraphs(article);
    expect(article).toEqual({ content: 'a\n\nb' });
    expect(result).not.toBe(article);
  });
});
