import { describe, it, expect } from 'vitest';
import {
  splitPdfTextSegments,
  renderPdfPagesHtml,
  describePdfMeta,
  renderQuotesHtml,
} from '../../src/pages/reading-mode/pdf-text.js';

describe('PDF text helpers', () => {
  it('test_splitPdfTextSegments_twoPages_preservesPageAndContentOrder', () => {
    expect(splitPdfTextSegments('--- Pagina 1 ---First page\n--- Pagina 2 ---Second page')).toEqual(
      [
        { kind: 'page', value: '1' },
        { kind: 'content', value: 'First page\n' },
        { kind: 'page', value: '2' },
        { kind: 'content', value: 'Second page' },
      ],
    );
  });
  it('test_splitPdfTextSegments_empty_returnsEmptySegments', () => {
    expect(splitPdfTextSegments('')).toEqual([]);
    expect(splitPdfTextSegments('   \n')).toEqual([]);
  });
  it('test_describePdfMeta_flatData_takesPrecedenceOverNestedData', () => {
    expect(
      describePdfMeta({
        pageCount: 3,
        filename: 'flat.pdf',
        apiProvider: 'groq',
        pdf: { pages: 7, name: 'nested.pdf' },
        metadata: { provider: 'openai', language: 'en' },
      }),
    ).toEqual({
      pageCount: 3,
      filename: 'flat.pdf',
      provider: 'groq',
      languageLabel: 'EN',
    });
  });
  it('test_describePdfMeta_nestedData_usesMetadataAndItalianLabel', () => {
    expect(
      describePdfMeta({
        pdf: { pages: 7, name: 'nested.pdf' },
        metadata: { provider: 'openai', language: 'it' },
      }),
    ).toEqual({
      pageCount: 7,
      filename: 'nested.pdf',
      provider: 'openai',
      languageLabel: 'Italiano',
    });
  });
  it('test_describePdfMeta_missingData_usesDefaults', () => {
    expect(describePdfMeta({})).toEqual({
      pageCount: 0,
      filename: 'PDF',
      provider: 'AI',
      languageLabel: 'Italiano',
    });
  });
  it('test_renderQuotesHtml_quotes_rendersNumberedEscapedContent', () => {
    const container = document.createElement('div');
    container.innerHTML = renderQuotesHtml(['First quote', '<em>Second & quote</em>']);
    expect(container.querySelector('h3').textContent).toBe('💬 Citazioni Importanti');
    expect(
      [...container.querySelectorAll('.quote-number')].map((node) => node.textContent),
    ).toEqual(['1', '2']);
    expect([...container.querySelectorAll('.quote-text')].map((node) => node.textContent)).toEqual([
      '"First quote"',
      '"<em>Second & quote</em>"',
    ]);
    expect(container.querySelector('.quote-text em')).toBeNull();
  });
  it('test_renderQuotesHtml_empty_rendersEmptyQuotesContainer', () => {
    const container = document.createElement('div');
    container.innerHTML = renderQuotesHtml([]);
    expect(container.querySelector('h3').textContent).toBe('💬 Citazioni Importanti');
    expect(container.querySelectorAll('.quote-item')).toHaveLength(0);
  });
});

describe('PDF page markers (F10)', () => {
  const MALICIOUS = '<img src=x onerror=alert(1)>';

  it('test_splitPdfTextSegments_textBeforeFirstMarker_isContentNotPageLabel', () => {
    expect(splitPdfTextSegments(`${MALICIOUS}--- Pagina 1 ---Uno`)).toEqual([
      { kind: 'content', value: MALICIOUS },
      { kind: 'page', value: '1' },
      { kind: 'content', value: 'Uno' },
    ]);
  });

  it('test_splitPdfTextSegments_emptyPage_keepsFollowingPagesLabelledCorrectly', () => {
    expect(splitPdfTextSegments('--- Pagina 1 ---A--- Pagina 2 ------ Pagina 3 ---C')).toEqual([
      { kind: 'page', value: '1' },
      { kind: 'content', value: 'A' },
      { kind: 'page', value: '2' },
      { kind: 'page', value: '3' },
      { kind: 'content', value: 'C' },
    ]);
  });

  it('test_renderPdfPagesHtml_maliciousTextBeforeMarker_isEscapedAndNotAPageLabel', () => {
    const host = document.createElement('div');
    host.innerHTML = renderPdfPagesHtml(`${MALICIOUS}--- Pagina 1 ---Uno`);
    expect(host.querySelector('img')).toBeNull();
    expect([...host.children].map((el) => el.className)).toEqual([
      'page-content',
      'page-marker',
      'page-content',
    ]);
    expect(host.querySelector('.page-content').textContent).toBe(MALICIOUS);
    expect(host.querySelector('.page-marker').textContent).toBe('📄 Pagina 1');
  });

  it('test_renderPdfPagesHtml_emptyPage_rendersMarkerWithoutContent', () => {
    const host = document.createElement('div');
    host.innerHTML = renderPdfPagesHtml('--- Pagina 1 ------ Pagina 2 ---B');
    expect([...host.children].map((el) => el.textContent)).toEqual([
      '📄 Pagina 1',
      '📄 Pagina 2',
      'B',
    ]);
  });
});
