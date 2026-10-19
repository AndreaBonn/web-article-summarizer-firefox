import { describe, it, expect } from 'vitest';
import {
  formatCitationsText,
  formatQAText,
  formatTranslationText,
  formatKeyPointsText,
  formatSummaryWithKeyPointsText,
} from '@shared/export-formatters.js';

describe('formatSummaryWithKeyPointsText()', () => {
  it('formats a summary and two numbered key points with paragraph references', () => {
    const points = [
      { title: 'First point', paragraphs: '1', description: 'First description.' },
      { title: 'Second point', paragraphs: '2-3', description: 'Second description.' },
    ];

    expect(formatSummaryWithKeyPointsText('A summary.', points)).toBe(
      'RIASSUNTO:\nA summary.\n\nPUNTI CHIAVE:\n' +
        '1. First point (§1)\n   First description.\n\n' +
        '2. Second point (§2-3)\n   Second description.\n\n',
    );
  });

  it('retains the undefined paragraph reference when paragraphs are absent', () => {
    expect(
      formatSummaryWithKeyPointsText('Summary', [{ title: 'Point', description: 'Details' }]),
    ).toBe('RIASSUNTO:\nSummary\n\nPUNTI CHIAVE:\n1. Point (§undefined)\n   Details\n\n');
  });

  it('retains both headings for an empty summary and empty key points', () => {
    expect(formatSummaryWithKeyPointsText('', [])).toBe('RIASSUNTO:\n\n\nPUNTI CHIAVE:\n');
  });
});

// ---------------------------------------------------------------------------
// formatCitationsText()
// ---------------------------------------------------------------------------
describe('formatCitationsText()', () => {
  it('test_formatCitationsText_arrayCompleto_contieneAutoreAnnoSorgente', () => {
    const citations = [
      {
        author: 'Rossi M.',
        year: '2023',
        source: 'Nature',
        quote_text: 'La scoperta è rivoluzionaria.',
      },
    ];
    const result = formatCitationsText(citations);

    expect(result).toContain('Rossi M.');
    expect(result).toContain('(2023)');
    expect(result).toContain('Nature');
    expect(result).toContain('La scoperta è rivoluzionaria.');
  });

  it('test_formatCitationsText_arrayCompleto_contieneContatoreCitazioni', () => {
    const citations = [
      { author: 'A', year: '2020', source: 'S1', quote_text: 'Q1' },
      { author: 'B', year: '2021', source: 'S2', quote_text: 'Q2' },
    ];
    const result = formatCitationsText(citations);

    expect(result).toContain('CITAZIONI (2)');
    expect(result).toContain('[1]');
    expect(result).toContain('[2]');
  });

  it('test_formatCitationsText_campoParziale_ometteCampiMancanti', () => {
    // Solo source, senza author/year/quote_text
    const citations = [{ source: 'Wikipedia' }];
    const result = formatCitationsText(citations);

    expect(result).toContain('Wikipedia');
    expect(result).not.toContain('undefined');
  });

  it('test_formatCitationsText_arrayVuoto_restittuisceStringaVuota', () => {
    expect(formatCitationsText([])).toBe('');
  });

  it('test_formatCitationsText_null_restittuisceStringaVuota', () => {
    expect(formatCitationsText(null)).toBe('');
  });

  it('test_formatCitationsText_undefined_restittuisceStringaVuota', () => {
    expect(formatCitationsText(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatQAText()
// ---------------------------------------------------------------------------
describe('formatQAText()', () => {
  it('test_formatQAText_arrayCoppieQA_contieneQeR', () => {
    const qa = [
      { question: "Cos'è il TDD?", answer: 'Test-Driven Development.' },
      { question: 'Perché usarlo?', answer: 'Migliora la qualità del codice.' },
    ];
    const result = formatQAText(qa);

    expect(result).toContain('Q1:');
    expect(result).toContain('R1:');
    expect(result).toContain('Q2:');
    expect(result).toContain('R2:');
    expect(result).toContain("Cos'è il TDD?");
    expect(result).toContain('Test-Driven Development.');
  });

  it('test_formatQAText_arrayVuoto_restittuisceStringaVuota', () => {
    expect(formatQAText([])).toBe('');
  });

  it('test_formatQAText_null_restittuisceStringaVuota', () => {
    expect(formatQAText(null)).toBe('');
  });

  it('test_formatQAText_arrayConElemento_contieneHeaderSezione', () => {
    const qa = [{ question: 'Domanda?', answer: 'Risposta.' }];
    const result = formatQAText(qa);

    expect(result).toContain('DOMANDE E RISPOSTE');
  });
});

// ---------------------------------------------------------------------------
// formatTranslationText()
// ---------------------------------------------------------------------------
describe('formatTranslationText()', () => {
  it('test_formatTranslationText_stringaSemplice_contieneTestoTraduzione', () => {
    const result = formatTranslationText('Il testo tradotto in italiano.');

    expect(result).toContain('TRADUZIONE:');
    expect(result).toContain('Il testo tradotto in italiano.');
  });

  it('test_formatTranslationText_oggettoConProprietaText_parsaCorrettamente', () => {
    const result = formatTranslationText({ text: 'Testo estratto da oggetto.' });

    expect(result).toContain('TRADUZIONE:');
    expect(result).toContain('Testo estratto da oggetto.');
  });

  it('test_formatTranslationText_null_restittuisceStringaVuota', () => {
    expect(formatTranslationText(null)).toBe('');
  });

  it('test_formatTranslationText_undefined_restittuisceStringaVuota', () => {
    expect(formatTranslationText(undefined)).toBe('');
  });

  it('test_formatTranslationText_oggettoSenzaText_restituisceStringaVuota', () => {
    // Oggetto senza .text → stringa vuota (non [object Object])
    const result = formatTranslationText({});
    expect(result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatKeyPointsText()
// ---------------------------------------------------------------------------
describe('formatKeyPointsText()', () => {
  const keyPoints = [
    { title: 'Punto A', paragraphs: '1', description: 'Descrizione del punto A.' },
    { title: 'Punto B', paragraphs: '2-3', description: 'Descrizione del punto B.' },
  ];

  it('test_formatKeyPointsText_senzaParagrafi_contieneNumerazioneETitolo', () => {
    const result = formatKeyPointsText(keyPoints);

    expect(result).toContain('1. Punto A');
    expect(result).toContain('2. Punto B');
    expect(result).not.toContain('§');
  });

  it('test_formatKeyPointsText_conIncludeParagrafs_contieneRiferimentoParagrafi', () => {
    const result = formatKeyPointsText(keyPoints, true);

    expect(result).toContain('§1');
    expect(result).toContain('§2-3');
  });

  it('test_formatKeyPointsText_conDescrizione_contieneDescrizione', () => {
    const result = formatKeyPointsText(keyPoints);

    expect(result).toContain('Descrizione del punto A.');
    expect(result).toContain('Descrizione del punto B.');
  });

  it('test_formatKeyPointsText_arrayVuoto_restittuisceStringaVuota', () => {
    expect(formatKeyPointsText([])).toBe('');
  });

  it('test_formatKeyPointsText_null_restittuisceStringaVuota', () => {
    expect(formatKeyPointsText(null)).toBe('');
  });

  it('test_formatKeyPointsText_puntoCheHaTitle_contieneHeaderSezione', () => {
    const result = formatKeyPointsText(keyPoints);
    expect(result).toContain('PUNTI CHIAVE:');
  });
});
