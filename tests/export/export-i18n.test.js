import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn() }));
import { I18n } from '@utils/i18n/i18n.js';
import { EmailManager } from '@utils/export/email-manager.js';
import { CitationFormatter } from '@utils/ai/citation-formatter.js';
import { formatQAText, formatSummaryWithKeyPointsText } from '@shared/export-formatters.js';
import { formatQAForSpeech } from '@shared/speech-text.js';
import { buildMultiAnalysisCopyText } from '@pages/multi-analysis/export-text.js';
import { PDFAnalyzer } from '@utils/pdf/pdf-analyzer.js';

const article = { title: 'T', url: 'https://x', wordCount: 300, readingTimeMinutes: 2 };

// Exported documents used to be written in Italian whatever the interface language
describe('exported documents follow the interface language', () => {
  afterEach(() => {
    I18n.currentLanguage = 'it';
  });

  it('email subject and sections in English', () => {
    I18n.currentLanguage = 'en';
    const { subject, body } = EmailManager.formatEmailContent(article, 'S', [], null, [
      { question: 'q', answer: 'a' },
    ]);
    expect(subject).toBe('Summary: T');
    expect(body).toContain('ARTICLE SUMMARY');
    expect(body).toContain('300 words • 2 min read');
    expect(body).toContain('QUESTIONS AND ANSWERS');
    expect(body).toContain('A1: a');
    expect(body).not.toContain('RIASSUNTO');
  });

  it('email keeps the Italian wording for Italian users', () => {
    const { subject, body } = EmailManager.formatEmailContent(article, 'S', []);
    expect(subject).toBe('Riassunto: T');
    expect(body).toContain('RIASSUNTO ARTICOLO');
  });

  it('plain-text sections, speech and multi-analysis copy in English', () => {
    I18n.currentLanguage = 'en';
    expect(formatSummaryWithKeyPointsText('S', [])).toBe('SUMMARY:\nS\n\nKEY POINTS:\n');
    expect(formatQAText([{ question: 'q', answer: 'a' }])).toContain('A1: a');
    expect(formatQAForSpeech([{ question: 'q', answer: 'a' }])).toBe('Question: q. Answer: a');
    expect(buildMultiAnalysisCopyText({ globalSummary: 'g' }, [])).toBe('GLOBAL SUMMARY:\n\ng\n\n');
  });

  it('bibliography and citation types in English, unknown types as Other', () => {
    I18n.currentLanguage = 'en';
    const bib = CitationFormatter.generateBibliography(article, [
      { author: 'N/A', type: 'statistic', source: 'S' },
    ]);
    expect(bib).toContain('# Bibliography');
    expect(bib).toContain('**Unspecified source**');
    expect(bib).toContain('Type: Statistic');
    expect(CitationFormatter.getCitationTypeLabel('nonsense')).toBe('Other');
  });

  it('PDF analyzer messages are read in the language active when they are used', () => {
    const analyzer = new PDFAnalyzer();
    I18n.currentLanguage = 'en';
    expect(analyzer.ERROR_MESSAGES.PASSWORD_PROTECTED).toBe(
      'The PDF is password protected. Remove the protection and try again.',
    );
    I18n.currentLanguage = 'it';
    expect(analyzer.ERROR_MESSAGES.PASSWORD_PROTECTED).toContain('protetto da password');
  });
});
