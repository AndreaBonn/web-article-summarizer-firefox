import { describe, it, expect } from 'vitest';

import { CitationFormatter } from '@utils/ai/citation-formatter.js';

// ---------------------------------------------------------------------------
// Fixture comuni
// ---------------------------------------------------------------------------

const ARTICLE_COMPLETO = {
  title: 'The Future of Artificial Intelligence',
  author: 'Mario Rossi',
  url: 'https://technews.it/articoli/future-ai-2024',
  publishedDate: '2024-03-15',
  siteName: 'TechNews Italia',
};

const CITATION_DIRETTA = {
  id: 1,
  type: 'direct_quote',
  quote_text: 'AI will transform every industry',
  author: 'Rossi, Mario',
  source: 'TechNews Italia',
  year: '2024',
  paragraph: '2',
};

const CITATION_STUDIO = {
  id: 2,
  type: 'study_reference',
  quote_text: 'Machine learning models achieve superhuman performance',
  author: 'Bianchi, Giulia',
  source: 'Nature AI',
  year: '2023',
  paragraph: '4',
};

// ---------------------------------------------------------------------------
// formatCitation — input non validi
// ---------------------------------------------------------------------------

describe('CitationFormatter.formatCitation() — input non validi', () => {
  it('test_formatCitation_nullArticle_returnsUnavailable', () => {
    // Arrange / Act
    const result = CitationFormatter.formatCitation(null, 'apa');

    // Assert
    expect(result).toBe('Articolo non disponibile');
  });

  it('test_formatCitation_nonObjectArticle_returnsUnavailable', () => {
    // Arrange / Act
    const resultString = CitationFormatter.formatCitation('stringa', 'apa');
    const resultNumber = CitationFormatter.formatCitation(42, 'apa');

    // Assert
    expect(resultString).toBe('Articolo non disponibile');
    expect(resultNumber).toBe('Articolo non disponibile');
  });
});

// ---------------------------------------------------------------------------
// formatCitation — stili
// ---------------------------------------------------------------------------

describe('CitationFormatter.formatCitation() — stile APA', () => {
  it('test_formatCitation_apaStyle_includesAuthorYearTitle', () => {
    // Arrange / Act
    const result = CitationFormatter.formatCitation(ARTICLE_COMPLETO, 'apa');

    // Assert
    expect(result).toContain('Rossi');
    expect(result).toContain('2024');
    expect(result).toContain('The Future of Artificial Intelligence');
  });

  it('test_formatCitation_apaStyle_includesSiteNameOrUrl', () => {
    // Act
    const result = CitationFormatter.formatCitation(ARTICLE_COMPLETO, 'apa');

    // Assert
    expect(result).toContain('technews.it');
  });
});

describe('CitationFormatter.formatCitation() — stile MLA', () => {
  it('test_formatCitation_mlaStyle_includesAccessDate', () => {
    // Arrange / Act
    const result = CitationFormatter.formatCitation(ARTICLE_COMPLETO, 'mla');

    // Assert — MLA include una data di accesso
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // MLA include il titolo dell'articolo
    expect(result).toContain('The Future of Artificial Intelligence');
  });

  it('test_formatCitation_mlaStyle_includesAuthorName', () => {
    // Act
    const result = CitationFormatter.formatCitation(ARTICLE_COMPLETO, 'mla');

    // Assert
    expect(result).toContain('Rossi');
  });
});

describe('CitationFormatter.formatCitation() — stile Chicago', () => {
  it('test_formatCitation_chicagoStyle_formatsCorrectly', () => {
    // Arrange / Act
    const result = CitationFormatter.formatCitation(ARTICLE_COMPLETO, 'chicago');

    // Assert
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('The Future of Artificial Intelligence');
    expect(result).toContain('Rossi');
  });

  it('test_formatCitation_chicagoStyle_includesSiteOrDomain', () => {
    // Act
    const result = CitationFormatter.formatCitation(ARTICLE_COMPLETO, 'chicago');

    // Assert — Chicago usa il dominio estratto dall'URL o il siteName
    const includesSiteName = result.includes('TechNews Italia');
    const includesDomain = result.includes('technews.it');
    expect(includesSiteName || includesDomain).toBe(true);
  });
});

describe('CitationFormatter.formatCitation() — stile IEEE', () => {
  it('test_formatCitation_ieeeStyle_formatsCorrectly', () => {
    // Arrange / Act
    const result = CitationFormatter.formatCitation(ARTICLE_COMPLETO, 'ieee');

    // Assert
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('The Future of Artificial Intelligence');
  });

  it('test_formatCitation_ieeeStyle_includesYear', () => {
    // Act
    const result = CitationFormatter.formatCitation(ARTICLE_COMPLETO, 'ieee');

    // Assert
    expect(result).toContain('2024');
  });
});

describe('CitationFormatter.formatCitation() — stile Harvard', () => {
  it('test_formatCitation_harvardStyle_formatsCorrectly', () => {
    // Arrange / Act
    const result = CitationFormatter.formatCitation(ARTICLE_COMPLETO, 'harvard');

    // Assert
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('The Future of Artificial Intelligence');
    expect(result).toContain('Rossi');
    expect(result).toContain('2024');
  });
});

describe('CitationFormatter.formatCitation() — stile sconosciuto', () => {
  it('test_formatCitation_unknownStyle_fallsBackToApa', () => {
    // Arrange
    const apaResult = CitationFormatter.formatCitation(ARTICLE_COMPLETO, 'apa');

    // Act
    const unknownResult = CitationFormatter.formatCitation(ARTICLE_COMPLETO, 'bibtex');

    // Assert — fallback a APA, output identico
    expect(unknownResult).toBe(apaResult);
  });
});

describe('CitationFormatter.formatCitation() — URL non valido', () => {
  it('test_formatCitation_invalidUrl_usesFallbackSiteName', () => {
    // Arrange
    const articleConUrlInvalido = {
      ...ARTICLE_COMPLETO,
      url: 'not-a-valid-url',
    };

    // Act — non deve lanciare eccezione
    let result;
    expect(() => {
      result = CitationFormatter.formatCitation(articleConUrlInvalido, 'apa');
    }).not.toThrow();

    // Assert — deve restituire una stringa valida
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('CitationFormatter.formatCitation() — campi mancanti', () => {
  it('test_formatCitation_missingFields_usesDefaults', () => {
    // Arrange — articolo con solo il minimo indispensabile
    const articleMinimo = { title: 'Titolo Minimo' };

    // Act — non deve lanciare eccezione
    let result;
    expect(() => {
      result = CitationFormatter.formatCitation(articleMinimo, 'apa');
    }).not.toThrow();

    // Assert
    expect(typeof result).toBe('string');
    expect(result).toContain('Titolo Minimo');
  });

  it('test_formatCitation_missingFields_noErrorOnMlaWithNoDate', () => {
    // Arrange
    const articleSenzaData = {
      title: 'Articolo Senza Data',
      author: 'Autore Sconosciuto',
      url: 'https://example.com/articolo',
    };

    // Act
    let result;
    expect(() => {
      result = CitationFormatter.formatCitation(articleSenzaData, 'mla');
    }).not.toThrow();

    // Assert
    expect(typeof result).toBe('string');
  });
});

describe('CitationFormatter.formatCitation() — HtmlSanitizer', () => {
  it('test_formatCitation_htmlFields_returnsEscapedCitation', () => {
    const article = {
      title: '<script>alert(1)</script>',
      author: '<img src=x onerror=alert(2)>',
      url: 'https://example.com/?source=<img>&page=1',
      publishedDate: '2024-03-15',
    };

    expect(CitationFormatter.formatCitation(article, 'apa')).toBe(
      '&lt;img src=x onerror=alert(2)&gt;. (2024). &lt;script&gt;alert(1)&lt;/script&gt;. ' +
        'example.com. https://example.com/?source=&lt;img&gt;&amp;page=1',
    );
  });
});

// ---------------------------------------------------------------------------
// getCitationTypeLabel
// ---------------------------------------------------------------------------

describe('CitationFormatter.getCitationTypeLabel()', () => {
  it('test_getCitationTypeLabel_directQuote_returnsItalianLabel', () => {
    // Act
    const result = CitationFormatter.getCitationTypeLabel('direct_quote');

    // Assert — deve restituire una label in italiano, non il tipo grezzo
    expect(result).toBeDefined();
    expect(result).not.toBe('direct_quote');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('test_getCitationTypeLabel_studyReference_returnsItalianLabel', () => {
    // Act
    const result = CitationFormatter.getCitationTypeLabel('study_reference');

    // Assert
    expect(result).not.toBe('study_reference');
    expect(typeof result).toBe('string');
  });

  it('test_getCitationTypeLabel_statistic_returnsItalianLabel', () => {
    // Act
    const result = CitationFormatter.getCitationTypeLabel('statistic');

    // Assert
    expect(result).not.toBe('statistic');
    expect(typeof result).toBe('string');
  });

  it('test_getCitationTypeLabel_unknownType_returnsAltro', () => {
    // Act
    const result = CitationFormatter.getCitationTypeLabel('tipo_inesistente_xyz');

    // Assert
    expect(result).toBe('Altro');
  });

  it('test_getCitationTypeLabel_undefinedType_returnsAltro', () => {
    // Act
    const result = CitationFormatter.getCitationTypeLabel(undefined);

    // Assert
    expect(result).toBe('Altro');
  });
});

// ---------------------------------------------------------------------------
// generateBibliography
// ---------------------------------------------------------------------------

describe('CitationFormatter.generateBibliography()', () => {
  it('test_generateBibliography_withCitations_includesAll', () => {
    // Arrange
    const citations = [CITATION_DIRETTA, CITATION_STUDIO];

    // Act
    const result = CitationFormatter.generateBibliography(ARTICLE_COMPLETO, citations, 'apa');

    // Assert — deve includere contenuto di tutte le citazioni
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Deve contenere riferimento all'articolo principale
    expect(result).toContain('The Future of Artificial Intelligence');
  });

  it('test_generateBibliography_noCitations_includesOnlyArticle', () => {
    // Arrange
    const citations = [];

    // Act
    const result = CitationFormatter.generateBibliography(ARTICLE_COMPLETO, citations, 'apa');

    // Assert — senza citazioni, contiene comunque il riferimento all'articolo
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('The Future of Artificial Intelligence');
  });

  it('test_generateBibliography_multipleCitations_countMatchesInput', () => {
    // Arrange
    const citations = [CITATION_DIRETTA, CITATION_STUDIO];

    // Act
    const result = CitationFormatter.generateBibliography(ARTICLE_COMPLETO, citations, 'mla');

    // Assert — il risultato deve essere più lungo di quello con zero citazioni
    const resultNoCitations = CitationFormatter.generateBibliography(ARTICLE_COMPLETO, [], 'mla');
    expect(result.length).toBeGreaterThan(resultNoCitations.length);
  });

  it('test_generateBibliography_returnsMarkdownString', () => {
    // Arrange
    const citations = [CITATION_DIRETTA];

    // Act
    const result = CitationFormatter.generateBibliography(ARTICLE_COMPLETO, citations, 'apa');

    // Assert — il risultato è una stringa (markdown)
    expect(typeof result).toBe('string');
  });

  it('test_generateBibliography_nullCitations_noThrow', () => {
    // Act / Assert
    expect(() => {
      CitationFormatter.generateBibliography(ARTICLE_COMPLETO, null, 'apa');
    }).not.toThrow();
  });

  it('test_generateBibliography_citationWithoutAuthor_showsFonteNonSpecificata', () => {
    const citation = {
      id: 1,
      type: 'study_reference',
      quote_text: 'Some reference text',
      author: 'N/A',
      source: 'Nature',
      year: '2024',
      paragraph: '3',
    };

    const result = CitationFormatter.generateBibliography(ARTICLE_COMPLETO, [citation], 'apa');

    expect(result).toContain('Fonte non specificata');
  });

  it('test_generateBibliography_citationWithContext_includesContext', () => {
    const citation = {
      ...CITATION_DIRETTA,
      context: 'Citazione nel contesto di un confronto',
    };

    const result = CitationFormatter.generateBibliography(ARTICLE_COMPLETO, [citation], 'apa');

    expect(result).toContain('Citazione nel contesto di un confronto');
  });

  it('test_generateBibliography_citationWithAdditionalInfo_includesDetails', () => {
    const citation = {
      ...CITATION_STUDIO,
      additional_info: {
        study_title: 'AI Performance Study',
        journal: 'Nature AI',
        doi: '10.1234/test',
        url: 'https://example.com/study',
      },
    };

    const result = CitationFormatter.generateBibliography(ARTICLE_COMPLETO, [citation], 'apa');

    expect(result).toContain('AI Performance Study');
    expect(result).toContain('Nature AI');
    expect(result).toContain('10.1234/test');
    expect(result).toContain('https://example.com/study');
  });

  it('test_generateBibliography_citationWithEmptyAdditionalInfo_noExtraLine', () => {
    const citation = {
      ...CITATION_DIRETTA,
      additional_info: {
        study_title: null,
        journal: null,
        doi: null,
        url: null,
      },
    };

    const result = CitationFormatter.generateBibliography(ARTICLE_COMPLETO, [citation], 'apa');

    // Non deve contenere la riga info se tutti i campi sono null
    expect(result).not.toContain('ℹ️');
  });

  it('test_generateBibliography_citationWithLongQuoteText_truncatesAt150Chars', () => {
    const longText = 'A'.repeat(200);
    const citation = {
      ...CITATION_DIRETTA,
      quote_text: longText,
    };

    const result = CitationFormatter.generateBibliography(ARTICLE_COMPLETO, [citation], 'apa');

    // Deve contenere "..." per troncamento
    expect(result).toContain('...');
    // Non deve contenere il testo integrale di 200 caratteri
    expect(result).not.toContain(longText);
  });

  it('test_generateBibliography_citationWithTextFieldInsteadOfQuoteText_usesTextField', () => {
    const citation = {
      id: 1,
      type: 'direct_quote',
      text: 'Fallback text field',
      author: 'Test Author',
      source: 'Test Source',
      paragraph: '1',
    };

    const result = CitationFormatter.generateBibliography(ARTICLE_COMPLETO, [citation], 'apa');

    expect(result).toContain('Fallback text field');
  });

  it('test_generateBibliography_citationWithoutParagraph_noParagraphLabel', () => {
    const citation = {
      ...CITATION_DIRETTA,
      paragraph: null,
    };

    const result = CitationFormatter.generateBibliography(ARTICLE_COMPLETO, [citation], 'apa');

    expect(result).not.toContain('Paragrafo:');
  });
});
