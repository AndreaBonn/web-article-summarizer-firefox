import { describe, it, expect } from 'vitest';
import {
  resolvePdfText,
  mergeHistoryEntryUpdate,
  applyArticleUpdate,
  renderTranslationHtml,
  renderExtractedCitationsHtml,
} from '../../src/pages/reading-mode/reading-mode-history.js';

describe('resolvePdfText', () => {
  it('test_resolvePdfText_extractedTextPresent_winsOverPdfText', () => {
    expect(resolvePdfText({ extractedText: 'top', pdf: { text: 'nested' } })).toBe('top');
  });
  it('test_resolvePdfText_onlyPdfText_usesNested', () => {
    expect(resolvePdfText({ pdf: { text: 'nested' } })).toBe('nested');
  });
  it('test_resolvePdfText_emptyExtractedText_fallsBackToNested', () => {
    expect(resolvePdfText({ extractedText: '', pdf: { text: 'nested' } })).toBe('nested');
  });
  it('test_resolvePdfText_noText_returnsUndefined', () => {
    expect(resolvePdfText({})).toBeUndefined();
    expect(resolvePdfText({ pdf: {} })).toBeUndefined();
  });
});

describe('mergeHistoryEntryUpdate', () => {
  const oldQa = [{ question: 'old' }];
  const newQa = [{ question: 'new' }];
  const oldTr = { marker: 'old-translation' };
  const newTr = { marker: 'new-translation' };
  const oldCit = { marker: 'old-citations' };
  const newCit = { marker: 'new-citations' };

  it('test_mergeHistoryEntryUpdate_dataQaUndefined_keepsExistingQa', () => {
    const existing = { id: 'a', qa: oldQa, translation: oldTr };
    const merged = mergeHistoryEntryUpdate(existing, { qa: undefined }, 1000);
    expect(merged.qa).toBe(oldQa);
    expect(merged.translation).toBe(oldTr);
  });
  it('test_mergeHistoryEntryUpdate_newValues_overwriteExisting', () => {
    const existing = { qa: oldQa, translation: oldTr, citations: oldCit };
    const merged = mergeHistoryEntryUpdate(
      existing,
      { qa: newQa, translation: newTr, citations: newCit },
      1000,
    );
    expect(merged.qa).toBe(newQa);
    expect(merged.translation).toBe(newTr);
    expect(merged.citations).toBe(newCit);
  });
  it('test_mergeHistoryEntryUpdate_always_setsTimestampToNow', () => {
    expect(mergeHistoryEntryUpdate({ timestamp: 5 }, {}, 1234).timestamp).toBe(1234);
  });
  it('test_mergeHistoryEntryUpdate_otherFields_arePreserved', () => {
    const merged = mergeHistoryEntryUpdate({ id: 'x', summary: 's', article: { url: 'u' } }, {}, 1);
    expect(merged).toMatchObject({ id: 'x', summary: 's', article: { url: 'u' } });
  });
  it('test_mergeHistoryEntryUpdate_existing_isNotMutated', () => {
    const existing = { qa: oldQa, timestamp: 5 };
    mergeHistoryEntryUpdate(existing, { qa: newQa }, 99);
    expect(existing).toEqual({ qa: oldQa, timestamp: 5 });
  });
});

describe('applyArticleUpdate', () => {
  const makeHistory = () => [
    { article: { url: 'https://a.test' }, summary: 'A', timestamp: 1 },
    { article: { url: 'https://b.test' }, summary: 'B', timestamp: 2 },
  ];

  it('test_applyArticleUpdate_matchingUrl_updatesOnlyThatEntryInNewArray', () => {
    const history = makeHistory();
    const citations = { marker: 'c' };
    const { history: updated, found } = applyArticleUpdate(
      history,
      { article: { url: 'https://b.test' }, citations },
      777,
    );
    expect(found).toBe(true);
    expect(updated).not.toBe(history);
    expect(updated[1]).toMatchObject({ summary: 'B', citations, timestamp: 777 });
    expect(updated[0]).toBe(history[0]);
  });
  it('test_applyArticleUpdate_matchingUrl_doesNotMutateInputHistory', () => {
    const history = makeHistory();
    applyArticleUpdate(history, { article: { url: 'https://a.test' }, qa: [{}] }, 777);
    expect(history).toEqual(makeHistory());
  });
  it('test_applyArticleUpdate_unknownUrl_returnsSameHistoryNotFound', () => {
    const history = makeHistory();
    const result = applyArticleUpdate(history, { article: { url: 'https://zzz.test' } }, 1);
    expect(result.found).toBe(false);
    expect(result.history).toBe(history);
    expect(history).toEqual(makeHistory());
  });
  it('test_applyArticleUpdate_emptyHistory_notFound', () => {
    const result = applyArticleUpdate([], { article: { url: 'https://a.test' } }, 1);
    expect(result).toEqual({ history: [], found: false });
  });
  it('test_applyArticleUpdate_entryWithoutArticle_isSkipped', () => {
    const history = [{ summary: 'no article' }, { article: { url: 'https://a.test' } }];
    const { history: updated, found } = applyArticleUpdate(
      history,
      { article: { url: 'https://a.test' } },
      9,
    );
    expect(found).toBe(true);
    expect(updated[0]).toBe(history[0]);
    expect(updated[1].timestamp).toBe(9);
  });
});

describe('renderTranslationHtml', () => {
  it('test_renderTranslationHtml_newlines_becomeBrAfterEscape', () => {
    const html = renderTranslationHtml('Titolo', 'riga uno\nriga <b>due</b>');
    expect(html).toContain(
      '<div class="translation-text">riga uno<br>riga &lt;b&gt;due&lt;/b&gt;</div>',
    );
  });
  it('test_renderTranslationHtml_title_isEscaped', () => {
    const html = renderTranslationHtml('<img src=x onerror=1>', 'testo');
    expect(html).toContain('<h3>&lt;img src=x onerror=1&gt;</h3>');
    expect(html).not.toContain('<img');
  });
  it('test_renderTranslationHtml_wrapsInTranslationContent', () => {
    const html = renderTranslationHtml('T', 'x');
    expect(html).toContain('<div class="translation-content">');
    expect(html).toContain('<h3>T</h3>');
  });
});

describe('renderExtractedCitationsHtml', () => {
  const EMPTY =
    '<div class="citations-content"><p>Nessuna citazione trovata in questo articolo</p></div>';

  it('test_renderExtractedCitationsHtml_nullOrEmpty_showsEmptyMessage', () => {
    expect(renderExtractedCitationsHtml(null)).toBe(EMPTY);
    expect(renderExtractedCitationsHtml(undefined)).toBe(EMPTY);
    expect(renderExtractedCitationsHtml({ citations: [] })).toBe(EMPTY);
  });
  it('test_renderExtractedCitationsHtml_two_numbersAndCountsFromLength', () => {
    const html = renderExtractedCitationsHtml({
      citations: [{ quote_text: 'uno' }, { quote_text: 'due' }],
    });
    expect(html).toContain('<h3>2 Citazioni Trovate</h3>');
    expect(html).toContain('<div class="citation-number">[1]</div>');
    expect(html).toContain('<div class="citation-number">[2]</div>');
    expect(html).not.toContain('Nessuna citazione');
  });
  it('test_renderExtractedCitationsHtml_totalCitations_winsOverLength', () => {
    const html = renderExtractedCitationsHtml({ total_citations: 7, citations: [{ text: 'x' }] });
    expect(html).toContain('<h3>7 Citazioni Trovate</h3>');
  });
  it('test_renderExtractedCitationsHtml_totalCount_usedWhenNoTotalCitations', () => {
    const html = renderExtractedCitationsHtml({ totalCount: 4, citations: [{ text: 'x' }] });
    expect(html).toContain('<h3>4 Citazioni Trovate</h3>');
  });
  it('test_renderExtractedCitationsHtml_textFields_followPriorityOrder', () => {
    const html = renderExtractedCitationsHtml({
      citations: [
        { quote_text: 'Q', text: 'T', quote: 'U' },
        { text: 'T2', quote: 'U2' },
        { quote: 'U3' },
      ],
    });
    expect(html).toContain('<div class="citation-text">Q</div>');
    expect(html).toContain('<div class="citation-text">T2</div>');
    expect(html).toContain('<div class="citation-text">U3</div>');
  });
  it('test_renderExtractedCitationsHtml_noText_usesPlaceholder', () => {
    const html = renderExtractedCitationsHtml({ citations: [{ author: 'A' }] });
    expect(html).toContain('<div class="citation-text">Testo citazione non disponibile</div>');
  });
  it('test_renderExtractedCitationsHtml_authorAndParagraph_renderedEscaped', () => {
    const html = renderExtractedCitationsHtml({
      citations: [{ quote_text: 'q', author: 'A <b>B</b>', paragraph: 12 }],
    });
    expect(html).toContain('<div class="citation-author">— A &lt;b&gt;B&lt;/b&gt;</div>');
    expect(html).toContain('<div class="citation-ref">§12</div>');
  });
  it('test_renderExtractedCitationsHtml_noAuthorNoParagraph_omitsThoseDivs', () => {
    const html = renderExtractedCitationsHtml({ citations: [{ quote_text: 'q' }] });
    expect(html).not.toContain('citation-author');
    expect(html).not.toContain('citation-ref');
  });
  it('test_renderExtractedCitationsHtml_quoteText_isEscaped', () => {
    const html = renderExtractedCitationsHtml({
      citations: [{ quote_text: '<script>x</script>' }],
    });
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});
