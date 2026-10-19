import { describe, it, expect } from 'vitest';
import {
  buildMultiAnalysisEmailContent,
  buildMultiAnalysisCopyText,
} from '@pages/multi-analysis/export-text.js';

function email(options, analysis = {}) {
  return buildMultiAnalysisEmailContent({
    analysis: { timestamp: new Date(2025, 0, 2).getTime(), ...analysis },
    selectedIds: ['b', 'missing', 'a'],
    allArticles: [
      { id: 'a', article: { title: 'Solar' } },
      { id: 'b', article: { title: 'Wind' } },
    ],
    options,
    dateLocale: 'it-IT',
  });
}

describe('multi-analysis export text', () => {
  it('test_email_lists_selected_articles_in_order_and_numbers_saved_questions', () => {
    expect(
      email(
        { includeComparison: true, includeQA: true },
        {
          comparison: 'Common ground',
          qa: {
            questions: [
              { question: 'Why?', answer: 'Because.' },
              { question: 'When?', answer: 'Tomorrow.' },
            ],
          },
        },
      ),
    ).toBe(
      '# Analisi Multi Articolo\n\n**Data:** 02/01/2025\n\n**Articoli analizzati:** 3\n\n---\n\n## Articoli\n\n1. Wind\n3. Solar\n\n---\n\n## Confronto Idee\n\nCommon ground\n\n---\n\n## Domande e Risposte\n\n**Q1:** Why?\n\n**R1:** Because.\n\n**Q2:** When?\n\n**R2:** Tomorrow.\n\n---\n\n',
    );
  });

  it('test_email_includes_global_summary_when_selected', () => {
    const text = email({ includeSummary: true }, { globalSummary: 'Overview text' });
    expect(text).toContain('## Riassunto Globale\n\nOverview text\n\n---\n\n');
  });

  it('test_email_omits_unselected_sections_and_handles_missing_or_empty_questions', () => {
    const base = email({});
    expect(base).toContain('1. Wind\n3. Solar');
    expect(
      email(
        { includeComparison: false, includeQA: false },
        { comparison: 'Hidden', qa: { questions: [{ question: 'Why?', answer: 'Yes' }] } },
      ),
    ).toBe(base);
    expect(email({ includeComparison: true, includeQA: true }, { qa: {} })).toBe(base);
    expect(email({ includeQA: true }, { qa: { questions: [] } })).toBe(base);
    expect(email({ includeQA: true })).toBe(base);
  });

  it('test_copy_formats_analysis_and_visible_conversation_in_order', () => {
    expect(
      buildMultiAnalysisCopyText(
        { globalSummary: 'Overview', comparison: 'Different', qa: { interactive: true } },
        ['Tu: Why?', 'Assistente: Yes.'],
      ),
    ).toBe(
      'RIASSUNTO GLOBALE:\n\nOverview\n\n' +
        '='.repeat(50) +
        '\n\nCONFRONTO IDEE:\n\nDifferent\n\n' +
        '='.repeat(50) +
        '\n\nCONVERSAZIONE Q&A:\n\nTu: Why?\n\nAssistente: Yes.\n\n',
    );
    expect(buildMultiAnalysisCopyText({}, [])).toBe('');
    expect(buildMultiAnalysisCopyText({ qa: { interactive: true } }, [])).toBe('');
    expect(buildMultiAnalysisCopyText({ qa: { interactive: false } }, ['ignored'])).toBe('');
  });
});
