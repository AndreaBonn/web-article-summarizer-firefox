import { afterEach, describe, expect, it } from 'vitest';
import { I18n } from '@utils/i18n/i18n.js';
import { buildClearConfirmMessage } from '@pages/history/history-filters.js';
import { buildImportConfirmMessage, validateImportFile } from '@pages/history/backup-rules.js';
import { renderPDFCardHtml } from '@pages/history/collections-render.js';

// The history page used to hardcode Italian: these pin that its copy follows the UI language
describe('history copy follows the interface language', () => {
  afterEach(() => {
    I18n.currentLanguage = 'it';
  });

  it('clear-history confirmation in English', () => {
    I18n.currentLanguage = 'en';
    const { message, title } = buildClearConfirmMessage('pdf', 2);
    expect(title).toBe('Clear PDF History');
    expect(message).toBe(
      'Are you sure you want to clear the whole history of analyzed PDFs?\n\n' +
        '⭐ 2 favorite PDFs will NOT be deleted.\n\nThis action cannot be undone.',
    );
  });

  it('clear-history confirmation in Italian', () => {
    const { title } = buildClearConfirmMessage('pdf', 0);
    expect(title).toBe('Elimina Cronologia PDF');
  });

  it('backup import confirmation and errors in English', () => {
    I18n.currentLanguage = 'en';
    const message = buildImportConfirmMessage({
      exportDate: '2026-01-01',
      data: { pdfAnalysis: [{}] },
    });
    expect(message).toContain('Do you want to import this backup?');
    expect(message).toContain('📑 PDF analyses: 1');
    expect(() => validateImportFile({ name: 'b.json', size: 60 * 1024 * 1024 })).toThrow(
      'File too large (max 50 MB)',
    );
  });

  it('PDF history card labels in English', () => {
    I18n.currentLanguage = 'en';
    const html = renderPDFCardHtml({
      id: 'p',
      timestamp: 1,
      pdf: { name: 'a.pdf', size: 10, pages: 1 },
      summary: 's',
      keyPoints: [{ title: 'k' }],
      translation: { text: 't' },
      notes: 'n',
      metadata: { provider: 'groq', language: 'en' },
    });
    expect(html).toContain('Translated');
    expect(html).toContain('Key Points:');
    expect(html).toContain('Delete');
    expect(html).not.toContain('Elimina');
  });
});
