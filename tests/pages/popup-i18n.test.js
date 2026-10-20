import { afterEach, describe, expect, it } from 'vitest';
import { I18n } from '@utils/i18n/i18n.js';
import { describeReadingModeStorageError } from '@pages/popup/popup-data.js';
import { renderCitationsHtml } from '@pages/popup/citations-render.js';

// The popup used to hardcode Italian: these pin that its copy follows the UI language
describe('popup copy follows the interface language', () => {
  afterEach(() => {
    I18n.currentLanguage = 'it';
  });

  it('reading-mode storage errors in English and Italian', () => {
    I18n.currentLanguage = 'en';
    expect(describeReadingModeStorageError(new Error('QUOTA_BYTES exceeded'))).toBe(
      'Cannot open reading mode: not enough storage space.',
    );
    expect(describeReadingModeStorageError(new Error('boom'))).toBe(
      'Cannot open reading mode: boom',
    );
    I18n.currentLanguage = 'it';
    expect(describeReadingModeStorageError(new Error('boom'))).toBe(
      'Impossibile aprire la modalità lettura: boom',
    );
  });

  it('citations panel labels in English', () => {
    I18n.currentLanguage = 'en';
    const html = renderCitationsHtml({ citations: [{ id: 1, text: 'quote' }], total_citations: 1 });
    expect(html).toContain('📚 1 citations found');
    expect(html).toContain('Copy Bibliography');
    expect(html).toContain('APA (Author. (Year). Title.)');
    expect(html).not.toContain('citazioni trovate');
  });
});
