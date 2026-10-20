import { afterEach, describe, expect, it } from 'vitest';
import { I18n } from '@utils/i18n/i18n.js';
import { renderKeypointsTabHtml, renderReadingCitationsHtml } from '@pages/reading-mode/render.js';
import { renderPdfPagesHtml, renderQuotesHtml } from '@pages/reading-mode/pdf-text.js';
import { renderExtractedCitationsHtml } from '@pages/reading-mode/reading-mode-history.js';

// The reading mode used to hardcode Italian: these pin that its copy follows the UI language
describe('reading mode copy follows the interface language', () => {
  afterEach(() => {
    I18n.currentLanguage = 'it';
  });

  it('empty states and headings in English', () => {
    I18n.currentLanguage = 'en';
    expect(renderKeypointsTabHtml([])).toContain('No key points available');
    expect(renderQuotesHtml(['q'])).toContain('💬 Key Quotes');
    expect(renderExtractedCitationsHtml(null)).toContain('No citations found in this article');
    expect(renderReadingCitationsHtml({ citations: [{ id: 1 }], total_citations: 1 })).toContain(
      '📚 1 Citations Found',
    );
  });

  it('page markers in English and Italian', () => {
    const text = '--- Pagina 2 ---\nbody';
    I18n.currentLanguage = 'en';
    const en = renderPdfPagesHtml(text);
    I18n.currentLanguage = 'it';
    const it = renderPdfPagesHtml(text);
    expect(en).not.toEqual(it);
    expect(it).toContain('Pagina');
  });
});
