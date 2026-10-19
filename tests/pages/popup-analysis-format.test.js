import { describe, expect, it } from 'vitest';
import {
  MAX_CONTENT_LENGTH,
  toExtractionError,
  truncateContent,
  findSavedContentType,
  resolveContentTypeOutcome,
  formatArticleMeta,
  renderKeypointsHtml,
  buildHistoryMetadata,
  buildCopyText,
} from '../../src/pages/popup/analysis-format.js';

describe('toExtractionError', () => {
  it('wraps a missing receiving end into the reload-the-page message, keeping the cause', () => {
    const original = new Error('Could not establish connection. Receiving end does not exist.');
    const result = toExtractionError(original);
    expect(result).not.toBe(original);
    expect(result.message).toBe(
      'Impossibile comunicare con la pagina. Ricarica la pagina (F5) e riprova.',
    );
    expect(result.cause).toBe(original);
  });

  it('recognizes the "Receiving end does not exist" wording alone', () => {
    expect(toExtractionError(new Error('Receiving end does not exist')).message).toContain('F5');
  });

  it('returns any other error untouched', () => {
    const original = new Error('boom');
    expect(toExtractionError(original)).toBe(original);
  });

  it('returns an error without message untouched', () => {
    const original = {};
    expect(toExtractionError(original)).toBe(original);
  });
});

describe('truncateContent', () => {
  it('cuts content longer than the limit to exactly the limit', () => {
    expect(MAX_CONTENT_LENGTH).toBe(50000);
    const result = truncateContent('a'.repeat(50001));
    expect(result).toHaveLength(50000);
  });

  it('keeps content at the limit unchanged', () => {
    const content = 'b'.repeat(50000);
    expect(truncateContent(content)).toBe(content);
  });

  it('honors a custom limit and keeps the leading characters', () => {
    expect(truncateContent('abcdef', 3)).toBe('abc');
  });

  it('passes through missing content', () => {
    expect(truncateContent(undefined)).toBeUndefined();
    expect(truncateContent('')).toBe('');
  });
});

describe('findSavedContentType', () => {
  const history = [
    { article: { url: 'https://a.test/1' }, metadata: { contentType: 'news' } },
    { article: { url: 'https://a.test/2' }, metadata: {} },
    { article: { url: 'https://a.test/3' } },
  ];

  it('returns the content type saved for the same url', () => {
    expect(findSavedContentType(history, 'https://a.test/1')).toBe('news');
  });

  it('returns null for an unknown url', () => {
    expect(findSavedContentType(history, 'https://a.test/x')).toBeNull();
  });

  it('returns null when the entry has no content type or no metadata', () => {
    expect(findSavedContentType(history, 'https://a.test/2')).toBeNull();
    expect(findSavedContentType(history, 'https://a.test/3')).toBeNull();
  });

  it('returns null on an empty history', () => {
    expect(findSavedContentType([], 'https://a.test/1')).toBeNull();
  });
});

describe('resolveContentTypeOutcome', () => {
  it('uses the classified type with method auto when the selection is auto', () => {
    expect(resolveContentTypeOutcome('auto', 'scientific')).toEqual({
      detectedContentType: 'scientific',
      contentTypeMethod: 'auto',
    });
  });

  it('keeps the manual selection and ignores the classified type', () => {
    expect(resolveContentTypeOutcome('news', 'general')).toEqual({
      detectedContentType: 'news',
      contentTypeMethod: 'manual',
    });
  });
});

describe('formatArticleMeta', () => {
  const article = { wordCount: 1200, readingTimeMinutes: 6 };

  it('shows only words and reading time before there are results', () => {
    expect(formatArticleMeta(article, null, 'groq')).toBe('1200 parole · 6 min di lettura');
  });

  it('adds content type label and provider label once results exist', () => {
    const results = { detectedContentType: 'news' };
    expect(formatArticleMeta(article, results, 'anthropic')).toBe(
      '1200 parole · 6 min di lettura · Notizia · Claude',
    );
  });

  it('omits the content type when it is auto or missing but keeps the provider', () => {
    expect(formatArticleMeta(article, { detectedContentType: 'auto' }, 'openai')).toBe(
      '1200 parole · 6 min di lettura · OpenAI',
    );
    expect(formatArticleMeta(article, {}, 'gemini')).toBe(
      '1200 parole · 6 min di lettura · Gemini',
    );
  });
});

describe('renderKeypointsHtml', () => {
  it('starts with the click hint even without key points', () => {
    const html = renderKeypointsHtml([]);
    expect(html).toBe(
      '<p class="keypoints-hint">Clicca un punto per evidenziarlo nell&#39;articolo.</p>',
    );
  });

  it('numbers the points from 1 and exposes the paragraph reference', () => {
    const html = renderKeypointsHtml([
      { title: 'Primo', paragraphs: '3-5', description: 'desc uno' },
      { title: 'Secondo', paragraphs: 7, description: 'desc due' },
    ]);
    const container = document.createElement('div');
    container.innerHTML = html;
    const points = container.querySelectorAll('.keypoint');
    expect(points).toHaveLength(2);
    expect(points[0].dataset.paragraph).toBe('3-5');
    expect(points[0].querySelector('.keypoint-title').textContent).toBe('1. Primo');
    expect(points[0].querySelector('.keypoint-desc').textContent).toBe('desc uno');
    expect(points[0].querySelector('.keypoint-ref').textContent).toBe("Mostra nell'articolo ↗");
    expect(points[1].dataset.paragraph).toBe('7');
    expect(points[1].querySelector('.keypoint-title').textContent).toBe('2. Secondo');
  });

  it('escapes AI-provided markup in title, description and paragraphs', () => {
    const html = renderKeypointsHtml([
      {
        title: '<script>alert(1)</script>',
        paragraphs: '<img src=x onerror=alert(1)>',
        description: '<b>grassetto</b>',
      },
    ]);
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('.keypoint-title').textContent).toBe(
      '1. <script>alert(1)</script>',
    );
    expect(container.querySelector('.keypoint').dataset.paragraph).toBe(
      '<img src=x onerror=alert(1)>',
    );
  });
});

describe('buildHistoryMetadata', () => {
  it('prefers the detected type and records the method and cache flag', () => {
    expect(
      buildHistoryMetadata({
        providerValue: 'groq',
        selectedLanguage: 'it',
        selectedContentType: 'auto',
        results: { detectedContentType: 'news', contentTypeMethod: 'auto', fromCache: true },
      }),
    ).toEqual({
      provider: 'groq',
      language: 'it',
      contentType: 'news',
      contentTypeMethod: 'auto',
      fromCache: true,
    });
  });

  it('falls back to the selected type, manual method and no cache', () => {
    expect(
      buildHistoryMetadata({
        providerValue: 'openai',
        selectedLanguage: 'en',
        selectedContentType: 'tutorial',
        results: {},
      }),
    ).toEqual({
      provider: 'openai',
      language: 'en',
      contentType: 'tutorial',
      contentTypeMethod: 'manual',
      fromCache: false,
    });
  });
});

describe('buildCopyText', () => {
  const article = { title: 'Titolo articolo', url: 'https://a.test/1', author: 'Mario Rossi' };
  const results = {
    summary: 'Il riassunto.',
    keyPoints: [{ title: 'Punto', paragraphs: '2', description: 'Dettaglio' }],
  };

  it('contains only summary and key points when nothing else is present', () => {
    const text = buildCopyText({
      results,
      translation: null,
      qa: [],
      citations: null,
      article,
    });
    expect(text).toBe(
      'RIASSUNTO:\nIl riassunto.\n\nPUNTI CHIAVE:\n1. Punto (§2)\n   Dettaglio\n\n',
    );
    expect(text).not.toContain('TRADUZIONE');
    expect(text).not.toContain('DOMANDE E RISPOSTE');
    expect(text).not.toContain('CITAZIONI');
  });

  it('appends translation, Q&A and citations in that order', () => {
    const text = buildCopyText({
      results,
      translation: { text: 'Translated text' },
      qa: [{ question: 'Perché?', answer: 'Perché sì.' }],
      citations: { citations: [{ author: 'Dante', year: '1320', quote_text: 'Nel mezzo' }] },
      article,
      citationStyle: 'mla',
    });
    const iSummary = text.indexOf('RIASSUNTO:');
    const iTranslation = text.indexOf('TRADUZIONE:\nTranslated text');
    const iQa = text.indexOf('DOMANDE E RISPOSTE:');
    const iCitations = text.indexOf('CITAZIONI E BIBLIOGRAFIA:');
    expect(iSummary).toBe(0);
    expect(iTranslation).toBeGreaterThan(iSummary);
    expect(iQa).toBeGreaterThan(iTranslation);
    expect(iCitations).toBeGreaterThan(iQa);
    expect(text).toContain('Q1: Perché?\nR1: Perché sì.');
    expect(text).toContain('**Stile:** MLA');
    expect(text).toContain('**Dante** (1320)');
  });

  it('defaults the citation style to APA', () => {
    const text = buildCopyText({
      results,
      translation: null,
      qa: null,
      citations: { citations: [{ author: 'Dante' }] },
      article,
    });
    expect(text).toContain('**Stile:** APA');
  });

  it('skips citations whose list is empty or missing', () => {
    const base = { results, translation: null, qa: null, article };
    expect(buildCopyText({ ...base, citations: { citations: [] } })).not.toContain('CITAZIONI');
    expect(buildCopyText({ ...base, citations: {} })).not.toContain('CITAZIONI');
  });
});
