import { describe, it, expect } from 'vitest';
import { buildMultiArticleQAPrompts } from '@utils/ai/prompts/multi-qa-prompts.js';

describe('multi-article QA prompts', () => {
  it('test_buildMultiArticleQAPrompts_numbers_articles_and_separates_their_content', () => {
    const { systemPrompt, userPrompt } = buildMultiArticleQAPrompts(
      [
        { title: 'Solar', content: 'Sun power' },
        { title: 'Wind', content: 'Air power' },
      ],
      'What differs?',
    );
    expect(userPrompt).toBe(
      '# ARTICOLI DI RIFERIMENTO\n\n\nARTICOLO 1: Solar\n\nSun power\n\n\n' +
        '='.repeat(80) +
        "\n\n\nARTICOLO 2: Wind\n\nAir power\n\n\n---\n\n# DOMANDA DELL'UTENTE\n\nWhat differs?\n\n---\n\nRispondi basandoti esclusivamente sugli articoli sopra. Cita gli articoli di riferimento.",
    );
    expect(systemPrompt).toContain(
      'Rispondi SOLO sulla base degli articoli forniti - non usare conoscenze esterne',
    );
    expect(systemPrompt).toContain('Mai inventare informazioni');
  });

  it('test_buildMultiArticleQAPrompts_handles_empty_articles_and_preserves_question_text', () => {
    const result = buildMultiArticleQAPrompts([], '<img> & why?');
    expect(result.userPrompt).toContain(
      "# ARTICOLI DI RIFERIMENTO\n\n\n\n---\n\n# DOMANDA DELL'UTENTE\n\n<img> & why?",
    );
    expect(result.systemPrompt).toContain('Cita sempre gli articoli di riferimento');
  });
});
