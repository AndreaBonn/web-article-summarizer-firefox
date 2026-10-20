import { afterEach, describe, expect, it } from 'vitest';
import { I18n } from '../../src/utils/i18n/i18n.js';
import { CitationExtractor } from '../../src/utils/ai/citation-extractor.js';
import {
  renderDetailKeypointsHtml,
  renderTranslationHtml,
  renderQAHtml,
  renderCitationsHtml,
  buildDetailCopyText,
  prepareNotes,
} from '../../src/pages/history/detail-render.js';

afterEach(() => {
  I18n.currentLanguage = 'it';
});

const article = { title: 'Article', url: 'https://example.com', author: 'Ada', date: '2026-01-01' };

describe('detail rendering', () => {
  it('renders numbered key points and escapes their content', () => {
    document.body.innerHTML = renderDetailKeypointsHtml([
      { title: '<Title>', paragraphs: [1, 2], description: '<Details>' },
      { title: 'Second', paragraphs: 3, description: 'Next' },
    ]);
    expect(
      [...document.querySelectorAll('.keypoint-modal-title')].map((el) => el.textContent),
    ).toEqual(['1. <Title>', '2. Second']);
    expect(document.querySelector('.keypoint-modal-ref').textContent).toBe('§1,2');
    expect(document.querySelector('.keypoint-modal-desc').textContent).toBe('<Details>');
    expect(renderDetailKeypointsHtml([])).toBe('');
  });

  it('renders a translation object and the empty state', () => {
    document.body.innerHTML = renderTranslationHtml({
      originalLanguage: 'en',
      targetLanguage: 'it',
      text: '<Ciao>',
    });
    expect(document.querySelector('.translation-info-modal').textContent.trim()).toBe(
      'Tradotto da en a it',
    );
    expect(document.querySelector('.translation-text').textContent).toBe('<Ciao>');
    document.body.innerHTML = renderTranslationHtml(null);
    expect(document.querySelector('.modal-empty-state').textContent.trim()).toBe(
      'Nessuna traduzione disponibile per questo riassunto',
    );
  });

  it('renders questions and answers and handles missing or empty lists', () => {
    document.body.innerHTML = renderQAHtml([{ question: '<Why?>', answer: '<Because>' }]);
    expect(document.querySelector('.qa-question').textContent.trim()).toBe('Q1: <Why?>');
    expect(document.querySelector('.qa-answer').textContent.trim()).toBe('R1: <Because>');
    for (const qa of [[], null]) {
      document.body.innerHTML = renderQAHtml(qa);
      expect(document.querySelector('.modal-empty-state').textContent.trim()).toBe(
        'Nessuna domanda e risposta disponibile per questo riassunto',
      );
    }
  });

  it('renders citation counts, icons, context and the article reference', () => {
    const citations = ['direct_quote', 'reference', 'statistic', 'source', 'other'].map(
      (type, index) => ({
        type,
        id: index + 1,
        context: '<Context>',
        author: index === 0 ? 'Ada' : '',
      }),
    );
    document.body.innerHTML = renderCitationsHtml({
      article,
      citations: { total_citations: 7, citations },
    });
    expect(document.querySelector('.citations-info').textContent.trim()).toBe(
      '7 citazioni trovate',
    );
    expect(
      [...document.querySelectorAll('.citation-type-icon')].map((el) => el.textContent),
    ).toEqual(['›', '§', '#', '→', '•']);
    expect(document.querySelector('.citation-context-text').textContent).toBe('<Context>');
    expect(document.querySelector('.citation-id-badge').textContent).toBe('#1');
    expect(document.querySelector('.citation-author').textContent).toBe('Ada');
    expect(document.querySelector('.article-citation-monospace').textContent.trim()).toBe(
      CitationExtractor.formatCitation(article, 'apa'),
    );
    document.body.innerHTML = renderCitationsHtml({ article, citations: { citations } });
    expect(document.querySelector('.citations-info').textContent.trim()).toBe(
      '5 citazioni trovate',
    );
  });

  it('escapes the article citation so a hostile title creates no elements', () => {
    const hostile = {
      title: '<img src=x onerror=1>',
      author: "L'Autore & co",
      url: 'https://example.com',
      date: '2026-01-01',
    };
    document.body.innerHTML = renderCitationsHtml({
      article: hostile,
      citations: { citations: [{ type: 'source', id: 1 }] },
    });
    const box = document.querySelector('.article-citation-monospace');
    expect(box.querySelector('img')).toBeNull();
    expect(box.textContent).toContain('<img src=x onerror=1>');
    expect(box.textContent).toContain("L'Autore & co");
  });

  it.each([undefined, {}, { citations: [] }])('renders empty citations for %s', (citations) => {
    document.body.innerHTML = renderCitationsHtml({ citations });
    expect(document.querySelector('.modal-empty-state').textContent.trim()).toBe(
      'Nessuna citazione disponibile per questo riassunto',
    );
  });

  it('copies summary, key points, object translation, questions and bibliography in order', () => {
    const entry = {
      article,
      summary: 'Summary',
      keyPoints: [{ title: 'Point', paragraphs: 2, description: 'Detail' }],
      translation: { text: 'Traduzione' },
      qa: [{ question: 'Why?', answer: 'Because' }],
      citations: {
        citations: [{ type: 'reference', id: 1, author: 'Ada', year: '2026', source: 'Source' }],
      },
    };
    const separator = '\n' + '='.repeat(50) + '\n\n';
    expect(buildDetailCopyText(entry)).toBe(
      'RIASSUNTO:\nSummary\n\nPUNTI CHIAVE:\n1. Point (§2)\n   Detail\n\n' +
        separator +
        'TRADUZIONE:\nTraduzione\n' +
        separator +
        'DOMANDE E RISPOSTE:\n\nQ1: Why?\nR1: Because\n\n' +
        separator +
        'CITAZIONI E BIBLIOGRAFIA:\n\n' +
        CitationExtractor.generateBibliography(article, entry.citations.citations, 'apa'),
    );
    expect(
      buildDetailCopyText({ summary: 'Only', keyPoints: [], qa: [], citations: { citations: [] } }),
    ).toBe('RIASSUNTO:\nOnly\n\nPUNTI CHIAVE:\n');
  });

  it('truncates notes before trimming and keeps the textarea value', () => {
    expect(prepareNotes('x'.repeat(10005))).toEqual({
      textareaValue: 'x'.repeat(10000),
      notes: 'x'.repeat(10000),
    });
    expect(prepareNotes('x'.repeat(10001)).notes).toBe('x'.repeat(10000));
    expect(prepareNotes('x'.repeat(10000)).textareaValue).toBe('x'.repeat(10000));
    expect(prepareNotes('  Note  ')).toEqual({ textareaValue: '  Note  ', notes: 'Note' });
    expect(prepareNotes('   ')).toEqual({ textareaValue: '   ', notes: null });
    expect(prepareNotes('')).toEqual({ textareaValue: '', notes: null });
  });
});

describe('translation stored as a plain string (written by reading mode)', () => {
  it('test_renderTranslationHtml_stringTranslation_showsTheText', () => {
    document.body.innerHTML = renderTranslationHtml('<Ciao> dal reading mode');
    expect(document.querySelector('.translation-text').textContent).toBe('<Ciao> dal reading mode');
    expect(document.querySelector('.translation-info-modal')).toBeNull();
  });

  it('test_buildDetailCopyText_stringTranslation_copiesTheText', () => {
    const text = buildDetailCopyText({
      summary: 'Sintesi',
      keyPoints: [],
      translation: 'Testo tradotto',
    });
    expect(text).toContain('TRADUZIONE:\nTesto tradotto\n');
    expect(text).not.toContain('undefined');
  });

  it('test_buildDetailCopyText_objectTranslationWithoutText_omitsTheSection', () => {
    const text = buildDetailCopyText({ summary: 'S', keyPoints: [], translation: {} });
    expect(text).not.toContain('TRADUZIONE');
    expect(text).not.toContain('undefined');
  });
});
