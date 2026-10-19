import { describe, expect, it } from 'vitest';
import {
  computeSyncedScrollTop,
  isSafeIframeUrl,
  renderArticleTextHtml,
  renderKeypointsTabHtml,
  findKeypointParagraphs,
  renderReadingCitationsHtml,
} from '../../src/pages/reading-mode/render.js';

function toDom(html) {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

const cit = (overrides = {}) => ({
  id: 1,
  type: 'statistic',
  quote_text: 'Testo',
  author: 'Anna',
  source: 'ISTAT',
  year: 2020,
  paragraph: 2,
  context: 'Ctx',
  ...overrides,
});

describe('renderReadingCitationsHtml', () => {
  it('test_renderReadingCitationsHtml_missingOrEmpty_returnsNull', () => {
    expect(renderReadingCitationsHtml(undefined)).toBeNull();
    expect(renderReadingCitationsHtml(null)).toBeNull();
    expect(renderReadingCitationsHtml([])).toBeNull();
    expect(renderReadingCitationsHtml({ citations: [] })).toBeNull();
  });

  it('test_renderReadingCitationsHtml_objectWithoutList_returnsNull', () => {
    expect(renderReadingCitationsHtml({})).toBeNull();
    expect(renderReadingCitationsHtml({ citations: null, total_citations: 0 })).toBeNull();
  });

  it('test_renderReadingCitationsHtml_directArray_headerCountsList', () => {
    const host = toDom(renderReadingCitationsHtml([cit(), cit({ id: 2 })]));
    expect(host.querySelector('h3').textContent).toBe('📚 2 Citazioni Trovate');
  });

  it('test_renderReadingCitationsHtml_nestedObject_totalCitationsZeroFallsBackToTotalCount', () => {
    const host = toDom(
      renderReadingCitationsHtml({ total_citations: 0, totalCount: 9, citations: [cit()] }),
    );
    expect(host.querySelector('h3').textContent).toBe('📚 9 Citazioni Trovate');
  });

  it('test_renderReadingCitationsHtml_nestedObject_noCounts_fallsBackToLength', () => {
    const host = toDom(renderReadingCitationsHtml({ citations: [cit(), cit(), cit()] }));
    expect(host.querySelector('h3').textContent).toBe('📚 3 Citazioni Trovate');
  });

  it('test_renderReadingCitationsHtml_fullCitation_rendersAllFields', () => {
    const item = toDom(renderReadingCitationsHtml([cit()])).querySelector('.citation-item');
    expect(item.querySelector('.citation-icon').textContent).toBe('📊');
    expect(item.querySelector('.citation-number').textContent).toBe('#1');
    expect(item.querySelector('.citation-author-badge').textContent).toBe('Anna');
    expect(item.querySelector('.citation-ref').textContent).toBe('§2');
    expect(item.querySelector('.citation-text').textContent).toBe('"Testo"');
    expect(item.querySelector('.citation-context').textContent).toBe('📝 Ctx');
    expect(item.querySelector('.citation-type').textContent).toBe('Statistica');
    expect(item.querySelector('.citation-source').textContent).toBe('📚 ISTAT');
    expect(item.querySelector('.citation-year').textContent).toBe('📅 2020');
  });

  it('test_renderReadingCitationsHtml_noId_numbersByIndexPlusOne', () => {
    const host = toDom(
      renderReadingCitationsHtml([cit({ id: undefined }), cit({ id: undefined })]),
    );
    const numbers = [...host.querySelectorAll('.citation-number')].map((n) => n.textContent);
    expect(numbers).toEqual(['#1', '#2']);
  });

  it('test_renderReadingCitationsHtml_textFieldPriority_quoteTextThenTextThenQuote', () => {
    const html = (c) =>
      toDom(renderReadingCitationsHtml([c])).querySelector('.citation-text').textContent;
    expect(html(cit({ quote_text: 'Q', text: 'T', quote: 'U' }))).toBe('"Q"');
    expect(html(cit({ quote_text: undefined, text: 'T', quote: 'U' }))).toBe('"T"');
    expect(html(cit({ quote_text: undefined, text: undefined, quote: 'U' }))).toBe('"U"');
  });

  it('test_renderReadingCitationsHtml_textOver300_truncatedWithEllipsis', () => {
    const long = 'x'.repeat(301);
    const text = toDom(renderReadingCitationsHtml([cit({ quote_text: long })])).querySelector(
      '.citation-text',
    ).textContent;
    expect(text).toBe(`"${'x'.repeat(300)}..."`);
  });

  it('test_renderReadingCitationsHtml_text250_notTruncatedAtPopupLimit', () => {
    const mid = 'y'.repeat(250);
    const text = toDom(renderReadingCitationsHtml([cit({ quote_text: mid })])).querySelector(
      '.citation-text',
    ).textContent;
    expect(text).toBe(`"${mid}"`);
  });

  it('test_renderReadingCitationsHtml_noTextButAuthor_showsPlaceholder', () => {
    const el = toDom(renderReadingCitationsHtml([cit({ quote_text: undefined })])).querySelector(
      '.citation-text',
    );
    expect(el.classList.contains('citation-no-text')).toBe(true);
    expect(el.textContent).toBe('Riferimento senza testo citato');
  });

  it('test_renderReadingCitationsHtml_noTextAuthorNorSource_skipped', () => {
    const host = toDom(
      renderReadingCitationsHtml([{ id: 1, type: 'statistic', year: 2000 }, cit({ id: 2 })]),
    );
    expect(host.querySelectorAll('.citation-item')).toHaveLength(1);
    expect(host.querySelector('.citation-number').textContent).toBe('#2');
  });

  it('test_renderReadingCitationsHtml_allSkipped_stillReturnsHeaderOnly', () => {
    const host = toDom(renderReadingCitationsHtml([{ id: 1 }]));
    expect(host.querySelector('h3').textContent).toBe('📚 1 Citazioni Trovate');
    expect(host.querySelectorAll('.citation-item')).toHaveLength(0);
  });

  it('test_renderReadingCitationsHtml_unknownType_pinIconAndAltro', () => {
    const item = toDom(renderReadingCitationsHtml([cit({ type: 'zzz' })])).querySelector(
      '.citation-item',
    );
    expect(item.querySelector('.citation-icon').textContent).toBe('📌');
    expect(item.querySelector('.citation-type').textContent).toBe('Altro');
  });

  it('test_renderReadingCitationsHtml_htmlInTextAuthorSource_isEscaped', () => {
    const host = toDom(
      renderReadingCitationsHtml([
        cit({ quote_text: '<img src=x>', author: '<b>a</b>', source: '<s>z</s>' }),
      ]),
    );
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.citation-author-badge b')).toBeNull();
    expect(host.querySelector('.citation-source s')).toBeNull();
    expect(host.querySelector('.citation-text').textContent).toBe('"<img src=x>"');
  });
});

describe('renderReadingCitationsHtml id escaping (F13)', () => {
  it('test_renderReadingCitationsHtml_htmlInCitationId_isEscaped', () => {
    const host = toDom(renderReadingCitationsHtml([cit({ id: '<img src=x onerror=alert(1)>' })]));
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.citation-number').textContent).toBe(
      '#<img src=x onerror=alert(1)>',
    );
  });
});

describe('findKeypointParagraphs (F18)', () => {
  const container = () =>
    toDom(renderArticleTextHtml({ title: 'T', content: 'a\n\nb\n\nc\n\nd\n\ne\n\nf' }));
  const numbers = (els) => els.map((el) => el.dataset.paragraph);

  it('test_findKeypointParagraphs_range_returnsEveryParagraphInRange', () => {
    expect(numbers(findKeypointParagraphs(container(), '3-5'))).toEqual(['3', '4', '5']);
  });
  it('test_findKeypointParagraphs_singleNumberOrString_returnsThatParagraph', () => {
    expect(numbers(findKeypointParagraphs(container(), 2))).toEqual(['2']);
    expect(numbers(findKeypointParagraphs(container(), '6'))).toEqual(['6']);
  });
  it('test_findKeypointParagraphs_absurdUpperBound_stopsAtLastParagraph', () => {
    expect(numbers(findKeypointParagraphs(container(), '5-99999999999'))).toEqual(['5', '6']);
  });
  it('test_findKeypointParagraphs_unknownOrGarbageRef_returnsEmpty', () => {
    expect(findKeypointParagraphs(container(), '40')).toEqual([]);
    expect(findKeypointParagraphs(container(), 'abc')).toEqual([]);
    expect(findKeypointParagraphs(container(), undefined)).toEqual([]);
  });
});

describe('renderArticleTextHtml', () => {
  it('test_renderArticleTextHtml_paragraphs_numberedFromOneBlankSkippedIndexKept', () => {
    const host = toDom(renderArticleTextHtml({ title: 'T', content: 'uno\n\n   \n\ndue' }));
    const paras = [...host.querySelectorAll('p[data-paragraph]')];
    // "uno", "   ", "due" -> il blocco vuoto salta ma l'indice avanza
    expect(paras.map((p) => [p.dataset.paragraph, p.textContent])).toEqual([
      ['1', 'uno'],
      ['3', 'due'],
    ]);
  });

  it('test_renderArticleTextHtml_title_defaultsToArticolo', () => {
    expect(toDom(renderArticleTextHtml({ content: 'a' })).querySelector('h1').textContent).toBe(
      'Articolo',
    );
    expect(
      toDom(renderArticleTextHtml({ title: 'Mio', content: 'a' })).querySelector('h1').textContent,
    ).toBe('Mio');
  });

  it('test_renderArticleTextHtml_excerpt_renderedOnlyWhenPresent', () => {
    expect(
      toDom(renderArticleTextHtml({ excerpt: 'Estratto', content: 'a' })).querySelector(
        '.article-excerpt em',
      ).textContent,
    ).toBe('Estratto');
    expect(
      toDom(renderArticleTextHtml({ content: 'a' })).querySelector('.article-excerpt'),
    ).toBeNull();
  });

  it('test_renderArticleTextHtml_noContent_showsUnavailableMessage', () => {
    const host = toDom(renderArticleTextHtml({ title: 'T' }));
    expect(host.querySelector('.content-unavailable').textContent).toBe(
      'Contenuto non disponibile.',
    );
    expect(host.querySelector('p[data-paragraph]')).toBeNull();
  });

  it('test_renderArticleTextHtml_htmlInContentAndTitle_isEscaped', () => {
    const host = toDom(
      renderArticleTextHtml({ title: '<script>x</script>', content: '<img src=x onerror=1>' }),
    );
    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('p[data-paragraph]').textContent).toBe('<img src=x onerror=1>');
  });
});

describe('isSafeIframeUrl', () => {
  it.each([
    ['https://example.com/a', true],
    ['http://example.com/a', true],
    ['javascript:alert(1)', false],
    ['data:text/html,<b>x</b>', false],
    ['ftp://example.com', false],
    ['not a url', false],
    ['', false],
    [undefined, false],
  ])('test_isSafeIframeUrl_%s_returns%s', (url, expected) => {
    expect(isSafeIframeUrl(url)).toBe(expected);
  });
});

describe('computeSyncedScrollTop', () => {
  it('test_computeSyncedScrollTop_midScroll_keepsProportion', () => {
    const source = { scrollTop: 250, scrollHeight: 1000, clientHeight: 500 };
    const target = { scrollTop: 0, scrollHeight: 2000, clientHeight: 1000 };
    // 250/500 = 50% di (2000-1000)
    expect(computeSyncedScrollTop(source, target)).toBe(500);
  });

  it('test_computeSyncedScrollTop_atTop_returnsZero', () => {
    const source = { scrollTop: 0, scrollHeight: 1000, clientHeight: 500 };
    const target = { scrollTop: 77, scrollHeight: 3000, clientHeight: 1000 };
    expect(computeSyncedScrollTop(source, target)).toBe(0);
  });

  it('test_computeSyncedScrollTop_atBottom_returnsTargetMax', () => {
    const source = { scrollTop: 500, scrollHeight: 1000, clientHeight: 500 };
    const target = { scrollTop: 0, scrollHeight: 3000, clientHeight: 1000 };
    expect(computeSyncedScrollTop(source, target)).toBe(2000);
  });

  it('test_computeSyncedScrollTop_doesNotMutateArguments', () => {
    const source = { scrollTop: 100, scrollHeight: 1000, clientHeight: 500 };
    const target = { scrollTop: 5, scrollHeight: 2000, clientHeight: 1000 };
    computeSyncedScrollTop(source, target);
    expect(target.scrollTop).toBe(5);
  });
});

describe('renderKeypointsTabHtml', () => {
  it.each([[undefined], [null], [[]]])(
    'test_renderKeypointsTabHtml_empty_showsEmptyState (%s)',
    (kp) => {
      const host = toDom(renderKeypointsTabHtml(kp));
      expect(host.querySelector('.empty-state p').textContent).toBe(
        'Nessun punto chiave disponibile',
      );
    },
  );

  it('test_renderKeypointsTabHtml_points_numberedWithRefAndDescription', () => {
    const host = toDom(
      renderKeypointsTabHtml([
        { title: 'Primo', description: 'D1', paragraphs: 3 },
        { title: 'Secondo', description: 'D2', paragraphs: '4-5' },
      ]),
    );
    const items = [...host.querySelectorAll('.keypoint')];
    expect(items).toHaveLength(2);
    expect(items[0].dataset.paragraph).toBe('3');
    expect(items[0].querySelector('.keypoint-title').textContent).toBe('1. Primo');
    expect(items[0].querySelector('.keypoint-ref').textContent).toBe('§3');
    expect(items[0].querySelector('.keypoint-desc').textContent).toBe('D1');
    expect(items[1].querySelector('.keypoint-title').textContent).toBe('2. Secondo');
    expect(items[1].querySelector('.keypoint-ref').textContent).toBe('§4-5');
  });

  it('test_renderKeypointsTabHtml_htmlInFields_isEscaped', () => {
    const host = toDom(
      renderKeypointsTabHtml([{ title: '<b>t</b>', description: '<i>d</i>', paragraphs: 1 }]),
    );
    expect(host.querySelector('.keypoint-title b')).toBeNull();
    expect(host.querySelector('.keypoint-desc i')).toBeNull();
    expect(host.querySelector('.keypoint-desc').textContent).toBe('<i>d</i>');
  });
});
