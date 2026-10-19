import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderPDFCardHtml,
  renderMultiAnalysisCardHtml,
  buildPDFReadingData,
  isValidMultiAnalysisEntry,
} from '../../src/pages/history/collections-render.js';
import { I18n } from '../../src/utils/i18n/i18n.js';
import itTranslations from '../../src/utils/i18n/locales/it.json';

function pdfEntry(overrides = {}) {
  return {
    id: 'pdf-7',
    timestamp: Date.UTC(2026, 0, 2),
    pdf: { name: '<img src=x onerror=alert(1)>.pdf', size: 1024, pages: 3, text: 'Page text' },
    summary: 'PDF summary',
    keyPoints: [{ title: 'First' }, { title: 'Second' }],
    metadata: { provider: 'groq', language: 'it' },
    ...overrides,
  };
}

function render(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

let previousLanguage;
beforeEach(() => {
  previousLanguage = I18n.currentLanguage;
  I18n.currentLanguage = 'it';
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-10T12:00:00Z'));
});
afterEach(() => {
  I18n.currentLanguage = previousLanguage;
  vi.useRealTimers();
});

describe('renderPDFCardHtml', () => {
  it('renders escaped filename, metadata, summary and key points', () => {
    const entry = pdfEntry();
    const card = render(renderPDFCardHtml(entry));
    expect(card.querySelector('.card-title').textContent).toBe(entry.pdf.name);
    expect(card.querySelectorAll('img')).toHaveLength(0);
    expect(card.querySelector('.pdf-card').dataset.id).toBe('pdf-7');
    expect([...card.querySelectorAll('.meta-item')].map((item) => item.textContent)).toEqual([
      '02/01/2026',
      '1.0 KB',
      '3 pagine',
      'Groq',
      'Italiano',
    ]);
    expect(card.querySelector('.summary-preview').textContent.trim()).toBe('PDF summary');
    expect([...card.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'First',
      'Second',
    ]);
    expect(card.querySelector('.btn-favorite').textContent.trim()).toBe('☆');
    expect(card.querySelectorAll('.badge')).toHaveLength(0);
  });

  it('renders all optional badges, favorite state, truncated summary and remaining points', () => {
    const card = render(
      renderPDFCardHtml(
        pdfEntry({
          favorite: true,
          translation: 'Traduzione',
          qa: [{}, {}],
          citations: { citations: [{}] },
          notes: 'Note',
          metadata: { provider: 'anthropic', language: 'en', fromCache: true },
          summary: 'a'.repeat(201),
          keyPoints: ['A', 'B', 'C', 'D', 'E'].map((title) => ({ title })),
        }),
      ),
    );
    expect([...card.querySelectorAll('.badge')].map((item) => item.textContent)).toEqual([
      'Tradotto',
      '2 Q&A',
      '1 Citazioni',
      'Note',
      'Cache',
    ]);
    expect(card.querySelector('.btn-favorite.active').textContent.trim()).toBe('★');
    expect(card.querySelector('.btn-favorite').title).toBe('Rimuovi dai preferiti');
    expect(card.querySelector('.summary-preview').textContent.trim()).toBe('a'.repeat(200) + '...');
    expect([...card.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'A',
      'B',
      'C',
      '+2 altri...',
    ]);
  });

  it('renders empty optional arrays without badges', () => {
    const card = render(
      renderPDFCardHtml(pdfEntry({ keyPoints: [], qa: [], citations: { citations: [] } })),
    );
    expect(card.querySelector('.summary-preview').textContent.trim()).toBe('PDF summary');
    expect(card.querySelectorAll('li, .badge')).toHaveLength(0);
  });
});

describe('renderMultiAnalysisCardHtml', () => {
  it('renders localized empty articles and add-favorite text', () => {
    const card = render(
      renderMultiAnalysisCardHtml({ id: 'multi-1', timestamp: Date.UTC(2026, 0, 2) }),
    );
    expect(card.querySelector('.multi-analysis-title').textContent.trim()).toBe(
      `${itTranslations['multi.analysisOf']} 0 ${itTranslations['multi.articles']}`,
    );
    expect(card.querySelector('.multi-analysis-article-item').textContent).toBe(
      itTranslations['multi.noArticles'],
    );
    expect(card.querySelector('.btn-favorite-multi').title).toBe(
      itTranslations['history.addFavorite'],
    );
    expect(card.querySelector('.multi-analysis-badge.provider').textContent).toBe('unknown');
  });

  it('renders escaped article titles, localized fallback, Q&A, favorites and remaining articles', () => {
    const card = render(
      renderMultiAnalysisCardHtml({
        id: 'multi-2',
        timestamp: Date.UTC(2026, 0, 2),
        favorite: true,
        metadata: { provider: 'openai' },
        analysis: { qa: { questions: ['One', 'Two'] } },
        articles: [{ title: '<b>Title</b>' }, {}, { title: 'Third' }, { title: 'Fourth' }],
      }),
    );
    expect(
      [...card.querySelectorAll('.multi-analysis-article-item')].map((item) => item.textContent),
    ).toEqual([
      '<b>Title</b>',
      itTranslations['common.titleUnavailable'],
      'Third',
      '... e altri 1',
    ]);
    expect(card.querySelectorAll('b')).toHaveLength(0);
    expect(card.querySelector('.multi-analysis-badge.qa').textContent).toBe('2 Q&A');
    expect(card.querySelector('.multi-analysis-badge.provider').textContent).toBe('OpenAI');
    expect(card.querySelector('.btn-favorite-multi.active').title).toBe(
      itTranslations['history.removeFavorite'],
    );
  });

  it('renders exactly three articles without a remainder', () => {
    const card = render(
      renderMultiAnalysisCardHtml({
        id: 'multi-3',
        timestamp: Date.UTC(2026, 0, 2),
        articles: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
      }),
    );
    expect(
      [...card.querySelectorAll('.multi-analysis-article-item')].map((item) => item.textContent),
    ).toEqual(['A', 'B', 'C']);
    expect(card.querySelector('.btn-favorite-multi').textContent.trim()).toBe('☆');
  });
});

describe('buildPDFReadingData', () => {
  it('carries PDF analysis and historyId into the reading mode handoff', () => {
    const entry = pdfEntry({
      translation: 'Translated',
      citations: { citations: [] },
      qa: [],
      notes: 'Notes',
    });
    expect(buildPDFReadingData(entry)).toEqual({
      pdf: entry.pdf,
      summary: 'PDF summary',
      keyPoints: [{ title: 'First' }, { title: 'Second' }],
      translation: 'Translated',
      citations: { citations: [] },
      qa: [],
      notes: 'Notes',
      metadata: { provider: 'groq', language: 'it' },
      historyId: 'pdf-7',
      source: 'pdf',
      isPDF: true,
      extractedText: 'Page text',
      pageCount: 3,
      filename: '<img src=x onerror=alert(1)>.pdf',
      apiProvider: 'groq',
    });
  });
});

describe('isValidMultiAnalysisEntry', () => {
  it('accepts an entry with analysis and articles, including empty collections', () => {
    expect(isValidMultiAnalysisEntry({ analysis: {}, articles: [] })).toBe(true);
  });

  it.each([{}, { analysis: {} }, { articles: [] }, { analysis: null, articles: [] }])(
    'rejects entries with missing analysis or articles: %j',
    (entry) => {
      expect(isValidMultiAnalysisEntry(entry)).toBe(false);
    },
  );
});
