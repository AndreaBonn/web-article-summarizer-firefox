import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock delle dipendenze esterne che richiedono fetch o storage Chrome
vi.mock('@utils/storage/cache-manager.js', () => ({ CacheManager: class {} }));
vi.mock('@utils/ai/prompt-registry.js', () => ({
  PromptRegistry: {
    getSummarySystemPrompt: () => 'system prompt',
    getKeyPointsSystemPrompt: () => 'keypoints prompt',
    getTranslationSystemPrompt: () => 'translation prompt',
    getCitationSystemPrompt: () => 'citation prompt',
  },
}));
vi.mock('@utils/security/input-sanitizer.js', () => ({
  InputSanitizer: {
    sanitizeForAI: (text) => text,
  },
}));

import { ResponseParser } from '@utils/ai/response-parser.js';
import { ContentDetector } from '@utils/ai/content-detector.js';
import { ProviderCaller } from '@utils/ai/provider-caller.js';

describe('ResponseParser.parseResponse()', () => {
  it('parsa risposta ben formattata con ## RIASSUNTO e ## PUNTI CHIAVE', () => {
    const responseText = `## RIASSUNTO

Questo è un riassunto abbastanza lungo da superare il limite minimo di cinquanta caratteri totali.

## PUNTI CHIAVE

1. **Titolo Punto Uno** (§1)
   Descrizione del primo punto chiave con dettagli.

2. **Titolo Punto Due** (§2-3)
   Descrizione del secondo punto chiave con ulteriori dettagli.`;

    const result = ResponseParser.parseResponse(responseText);
    expect(result.summary).toContain('riassunto abbastanza lungo');
    expect(result.keyPoints).toHaveLength(2);
    expect(result.keyPoints[0].title).toBe('Titolo Punto Uno');
    expect(result.keyPoints[0].paragraphs).toBe('1');
    expect(result.keyPoints[1].title).toBe('Titolo Punto Due');
    expect(result.keyPoints[1].paragraphs).toBe('2-3');
  });

  it('lancia errore per risposta senza separatore ## PUNTI CHIAVE con summary troppo corto', () => {
    const malformattata = 'Risposta malformata senza sezioni corrette';
    expect(() => ResponseParser.parseResponse(malformattata)).toThrow();
  });

  it('lancia errore per risposta troppo corta (sotto 50 caratteri)', () => {
    const corta = '## RIASSUNTO\n\nBreve.\n\n## PUNTI CHIAVE\n\n';
    expect(() => ResponseParser.parseResponse(corta)).toThrow('formato non valido');
  });

  it('restituisce keyPoints vuoti se la sezione punti chiave non ha pattern validi', () => {
    const responseText = `## RIASSUNTO

Questo riassunto è abbastanza lungo da superare il minimo di cinquanta caratteri necessari.

## PUNTI CHIAVE

Nessun punto in formato standard qui.`;

    const result = ResponseParser.parseResponse(responseText);
    expect(result.summary).toBeTruthy();
    expect(result.keyPoints).toHaveLength(0);
  });

  it('preserva il contenuto del summary senza ## RIASSUNTO nel testo risultante', () => {
    const responseText = `## RIASSUNTO

Il contenuto del riassunto è qui e deve essere abbastanza lungo per superare il controllo di lunghezza minima.

## PUNTI CHIAVE

1. **Punto** (§1)
   Descrizione.`;

    const result = ResponseParser.parseResponse(responseText);
    expect(result.summary).not.toContain('## RIASSUNTO');
  });
});

describe('ContentDetector.detectContentType()', () => {
  const makeArticle = (title, content) => ({ title, content });

  it('rileva articolo scientifico con terminology accademica', () => {
    const article = makeArticle(
      'New Study Results',
      'The methodology used in this study involved participants from multiple groups. The hypothesis was tested with p < 0.05 significance.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('scientific');
  });

  it('rileva articolo news con riferimenti temporali', () => {
    const article = makeArticle(
      'Breaking News',
      'According to sources, today the government announced a new policy that will affect millions.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('news');
  });

  it('rileva tutorial dal titolo', () => {
    const article = makeArticle(
      'How to install Node.js on Ubuntu',
      'In this guide we will go through step by step installation. First install the dependencies, then configure the environment.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('tutorial');
  });

  it('restituisce "general" per contenuto generico senza pattern specifici', () => {
    const article = makeArticle(
      'Un articolo qualunque',
      'Questo è un testo generico che non contiene termini specifici di nessuna categoria particolare.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('general');
  });
});

describe('ContentDetector.detectLanguage()', () => {
  it('rileva italiano da testo con parole comuni italiane', () => {
    const text =
      'Questo articolo parla della situazione economica italiana. La situazione della economia è che questo e quello sono diversi.';
    expect(ContentDetector.detectLanguage(text)).toBe('it');
  });

  it('rileva inglese da testo con parole comuni inglesi', () => {
    const text =
      'This article discusses the current economic situation. The government have been working with their international partners from which the results have been positive.';
    expect(ContentDetector.detectLanguage(text)).toBe('en');
  });

  it('rileva spagnolo da testo con parole comuni spagnole', () => {
    const text =
      'Este artículo habla de la situación económica actual. Los datos que tenemos para este análisis son los siguientes por las razones que mencionamos.';
    expect(ContentDetector.detectLanguage(text)).toBe('es');
  });

  it('restituisce "en" come fallback per testo senza pattern riconoscibili', () => {
    // Testo con poche parole ambigue
    const text = '12345 67890 xyzxyz';
    // Il fallback è "en" (maxScore = 0 → detectedLang resta "en")
    expect(ContentDetector.detectLanguage(text)).toBe('en');
  });
});

describe('ProviderCaller._validateChoicesResponse()', () => {
  it('restituisce il content per risposta valida', () => {
    const data = {
      choices: [{ message: { content: 'Risposta valida dal modello.' } }],
    };
    const result = ProviderCaller._validateChoicesResponse(data, 'Groq');
    expect(result).toBe('Risposta valida dal modello.');
  });

  it('lancia errore se choices è un array vuoto', () => {
    const data = { choices: [] };
    expect(() => ProviderCaller._validateChoicesResponse(data, 'OpenAI')).toThrow(
      'OpenAI ha restituito una risposta vuota',
    );
  });

  it('lancia errore se choices[0].message.content è vuoto', () => {
    const data = {
      choices: [{ message: { content: '' } }],
    };
    expect(() => ProviderCaller._validateChoicesResponse(data, 'Groq')).toThrow('risposta vuota');
  });

  it('lancia errore se choices[0].message.content è solo spazi', () => {
    const data = {
      choices: [{ message: { content: '   ' } }],
    };
    expect(() => ProviderCaller._validateChoicesResponse(data, 'Groq')).toThrow();
  });

  it('include il nome del provider nel messaggio di errore', () => {
    const data = { choices: [] };
    expect(() => ProviderCaller._validateChoicesResponse(data, 'Anthropic')).toThrow('Anthropic');
  });
});
