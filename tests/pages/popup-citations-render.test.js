import { describe, expect, it, vi } from 'vitest';
import {
  highlightCitation,
  renderCitationsHtml,
  resolveTotalCitations,
} from '../../src/pages/popup/citations-render.js';

const citation = (overrides = {}) => ({
  id: 1,
  type: 'direct_quote',
  quote_text: 'Testo citato',
  author: 'Mario Rossi',
  source: 'Nature',
  year: 2021,
  paragraph: 4,
  context: 'Contesto della frase',
  ...overrides,
});

function render(citationsData) {
  const host = document.createElement('div');
  host.innerHTML = renderCitationsHtml(citationsData);
  return host;
}

describe('resolveTotalCitations', () => {
  it('test_resolveTotalCitations_totalCitationsSet_usesIt', () => {
    expect(resolveTotalCitations({ total_citations: 7, totalCount: 3, citations: [1] })).toBe(7);
  });

  it('test_resolveTotalCitations_totalCitationsZero_fallsBackToTotalCount', () => {
    expect(resolveTotalCitations({ total_citations: 0, totalCount: 3, citations: [1] })).toBe(3);
  });

  it('test_resolveTotalCitations_noCounts_fallsBackToListLength', () => {
    expect(resolveTotalCitations({ total_citations: 0, citations: [1, 2] })).toBe(2);
  });
});

describe('renderCitationsHtml', () => {
  it('test_renderCitationsHtml_citationItem_carriesBothClassesInOneAttribute', () => {
    const item = render({ citations: [citation()] }).querySelector('.citation-item');
    expect(item.classList.contains('citation-item-clickable')).toBe(true);
    expect(item.getAttribute('class')).toBe('citation-item citation-item-clickable');
  });

  it('test_renderCitationsHtml_totalCitationsZero_headerShowsFallbackCount', () => {
    const host = render({ total_citations: 0, totalCount: 5, citations: [citation()] });
    expect(host.querySelector('.citations-info').textContent).toContain('5 citazioni trovate');
  });

  it('test_renderCitationsHtml_always_includesStyleSelectAndCopyButton', () => {
    const host = render({ citations: [citation()] });
    const values = [...host.querySelectorAll('#citationStyleSelect option')].map((o) => o.value);
    expect(values).toEqual(['apa', 'mla', 'chicago', 'ieee', 'harvard']);
    expect(host.querySelector('#copyCitationsBtn')).not.toBeNull();
    expect(host.querySelector('#mainCitationText')).not.toBeNull();
  });

  it('test_renderCitationsHtml_fullCitation_rendersAllFields', () => {
    const item = render({ citations: [citation()] }).querySelector('.citation-item');
    expect(item.dataset.citationId).toBe('1');
    expect(item.dataset.citationText).toBe('Testo citato');
    expect(item.dataset.paragraph).toBe('4');
    expect(item.querySelector('.citation-icon').textContent).toBe('💬');
    expect(item.querySelector('.citation-number').textContent).toBe('#1');
    expect(item.querySelector('.citation-author').textContent).toBe('Mario Rossi');
    expect(item.querySelector('.citation-paragraph').textContent).toBe('§4');
    expect(item.querySelector('.citation-text').textContent).toBe('"Testo citato"');
    expect(item.querySelector('.citation-context').textContent).toBe('Contesto della frase');
    expect(item.querySelector('.citation-type').textContent).toBe('Citazione Diretta');
    expect(item.querySelector('.citation-source').textContent).toBe('📚 Nature');
    expect(item.querySelector('.citation-year').textContent).toBe('📅 2021');
  });

  it('test_renderCitationsHtml_unknownType_usesPinIconAndAltroLabel', () => {
    const item = render({ citations: [citation({ type: 'weird' })] }).querySelector(
      '.citation-item',
    );
    expect(item.querySelector('.citation-icon').textContent).toBe('📌');
    expect(item.querySelector('.citation-type').textContent).toBe('Altro');
  });

  it('test_renderCitationsHtml_textOver200_truncatedWithEllipsis', () => {
    const long = 'a'.repeat(201);
    const item = render({ citations: [citation({ quote_text: long })] }).querySelector(
      '.citation-item',
    );
    expect(item.querySelector('.citation-text').textContent).toBe(`"${'a'.repeat(200)}..."`);
    expect(item.dataset.citationText).toBe(long);
  });

  it('test_renderCitationsHtml_textExactly200_notTruncated', () => {
    const exact = 'b'.repeat(200);
    const item = render({ citations: [citation({ quote_text: exact })] }).querySelector(
      '.citation-item',
    );
    expect(item.querySelector('.citation-text').textContent).toBe(`"${exact}"`);
  });

  it('test_renderCitationsHtml_textFallbackField_usedWhenQuoteTextMissing', () => {
    const item = render({
      citations: [citation({ quote_text: undefined, text: 'Da text' })],
    }).querySelector('.citation-item');
    expect(item.dataset.citationText).toBe('Da text');
  });

  it('test_renderCitationsHtml_noText_omitsTextBlock', () => {
    const item = render({
      citations: [citation({ quote_text: undefined })],
    }).querySelector('.citation-item');
    expect(item.querySelector('.citation-text')).toBeNull();
  });

  it('test_renderCitationsHtml_optionalFieldsMissing_omitsTheirElements', () => {
    const item = render({
      citations: [{ id: 2, type: 'statistic', quote_text: 'x' }],
    }).querySelector('.citation-item');
    expect(item.querySelector('.citation-author')).toBeNull();
    expect(item.querySelector('.citation-paragraph')).toBeNull();
    expect(item.querySelector('.citation-context')).toBeNull();
    expect(item.querySelector('.citation-source')).toBeNull();
    expect(item.querySelector('.citation-year')).toBeNull();
  });

  it('test_renderCitationsHtml_htmlInFields_isEscaped', () => {
    const host = render({
      citations: [
        citation({
          quote_text: '<img src=x onerror=alert(1)>',
          author: '<b>A</b>',
          source: '<i>S</i>',
          context: '<u>C</u>',
        }),
      ],
    });
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.citation-author b')).toBeNull();
    expect(host.querySelector('.citation-author').textContent).toBe('<b>A</b>');
    expect(host.querySelector('.citation-source').textContent).toBe('📚 <i>S</i>');
    expect(host.querySelector('.citation-context').textContent).toBe('<u>C</u>');
  });

  it('test_renderCitationsHtml_multipleCitations_keepsOrder', () => {
    const host = render({
      citations: [citation({ id: 'a' }), citation({ id: 'b' }), citation({ id: 'c' })],
    });
    const ids = [...host.querySelectorAll('.citation-item')].map((el) => el.dataset.citationId);
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

describe('highlightCitation', () => {
  const deps = (textResult) => ({
    highlightText: vi.fn().mockResolvedValue(textResult),
    highlightParagraph: vi.fn().mockResolvedValue(true),
  });

  it('test_highlightCitation_textSucceeds_paragraphNeverCalled', async () => {
    const d = deps(true);
    await highlightCitation({ citationText: 'abc', paragraph: '3' }, d);
    expect(d.highlightText).toHaveBeenCalledWith('abc');
    expect(d.highlightParagraph).not.toHaveBeenCalled();
  });

  it('test_highlightCitation_textFails_fallsBackToParagraph', async () => {
    const d = deps(false);
    await highlightCitation({ citationText: 'abc', paragraph: '3' }, d);
    expect(d.highlightText).toHaveBeenCalledWith('abc');
    expect(d.highlightParagraph).toHaveBeenCalledWith('3');
  });

  it('test_highlightCitation_textFailsNoParagraph_noFallback', async () => {
    const d = deps(false);
    await highlightCitation({ citationText: 'abc', paragraph: '' }, d);
    expect(d.highlightParagraph).not.toHaveBeenCalled();
  });

  it('test_highlightCitation_onlyParagraph_textNeverCalled', async () => {
    const d = deps(true);
    await highlightCitation({ citationText: '', paragraph: '3' }, d);
    expect(d.highlightText).not.toHaveBeenCalled();
    expect(d.highlightParagraph).toHaveBeenCalledWith('3');
  });

  it('test_highlightCitation_neitherTextNorParagraph_doesNothing', async () => {
    const d = deps(true);
    await highlightCitation({ citationText: undefined, paragraph: undefined }, d);
    expect(d.highlightText).not.toHaveBeenCalled();
    expect(d.highlightParagraph).not.toHaveBeenCalled();
  });
});
