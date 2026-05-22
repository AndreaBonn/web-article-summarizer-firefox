import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Chrome APIs
global.browser = {
  storage: { local: { get: vi.fn(), set: vi.fn() } },
  runtime: { id: 'test-id' },
};

// Mock dependencies
vi.mock('../src/utils/ai/citation-extractor.js', () => ({
  CitationExtractor: {
    formatCitation: vi.fn(() => 'Author (2024). Title. Source.'),
  },
}));

vi.mock('../src/utils/ai/citation-formatter.js', () => ({
  CitationFormatter: {
    getCitationTypeLabel: vi.fn((type) => {
      const labels = {
        direct_quote: 'Citazione Diretta',
        study_reference: 'Studio/Ricerca',
      };
      return labels[type] || 'Altro';
    }),
  },
}));

const { MarkdownExporter } = await import('../../src/utils/export/markdown-exporter.js');

const mockArticle = {
  title: 'Test Article Title',
  url: 'https://example.com/article',
  wordCount: 1500,
  readingTimeMinutes: 7,
};

const mockMetadata = {
  provider: 'groq',
  language: 'it',
  contentType: 'general',
};

describe('MarkdownExporter', () => {
  let capturedMarkdown;

  beforeEach(() => {
    capturedMarkdown = null;
    // Mock downloadMarkdown to capture the generated markdown instead of downloading
    vi.spyOn(MarkdownExporter, 'downloadMarkdown').mockImplementation((content) => {
      capturedMarkdown = content;
    });
  });

  describe('exportToMarkdown', () => {
    it('test_exportToMarkdown_basic_includes_header_and_summary', () => {
      MarkdownExporter.exportToMarkdown(mockArticle, 'This is the summary.', [], mockMetadata);

      expect(capturedMarkdown).toContain('# Test Article Title');
      expect(capturedMarkdown).toContain('**URL:** https://example.com/article');
      expect(capturedMarkdown).toContain('1500 parole');
      expect(capturedMarkdown).toContain('groq');
      expect(capturedMarkdown).toContain('## 📝 Riassunto');
      expect(capturedMarkdown).toContain('This is the summary.');
    });

    it('test_exportToMarkdown_with_keypoints_renders_numbered_list', () => {
      const keyPoints = [
        { title: 'Point 1', paragraphs: '1-2', description: 'Description 1' },
        { title: 'Point 2', paragraphs: '3', description: 'Description 2' },
      ];

      MarkdownExporter.exportToMarkdown(mockArticle, 'Summary', keyPoints, mockMetadata);

      expect(capturedMarkdown).toContain('## 🔑 Punti Chiave');
      expect(capturedMarkdown).toContain('### 1. Point 1');
      expect(capturedMarkdown).toContain('§1-2');
      expect(capturedMarkdown).toContain('Description 1');
      expect(capturedMarkdown).toContain('### 2. Point 2');
    });

    it('test_exportToMarkdown_with_translation_includes_section', () => {
      MarkdownExporter.exportToMarkdown(
        mockArticle,
        'Summary',
        [],
        mockMetadata,
        'Translated text here',
      );

      expect(capturedMarkdown).toContain('## 🌍 Traduzione');
      expect(capturedMarkdown).toContain('Translated text here');
    });

    it('test_exportToMarkdown_with_qa_includes_qa_section', () => {
      const qa = [
        { question: 'What is it?', answer: 'It is a test.' },
        { question: 'Why?', answer: 'Because.' },
      ];

      MarkdownExporter.exportToMarkdown(mockArticle, 'Summary', [], mockMetadata, null, qa);

      expect(capturedMarkdown).toContain('Domande e Risposte');
      expect(capturedMarkdown).toContain('What is it?');
      expect(capturedMarkdown).toContain('It is a test.');
    });

    it('test_exportToMarkdown_with_notes_includes_notes_section', () => {
      MarkdownExporter.exportToMarkdown(
        mockArticle,
        'Summary',
        [],
        mockMetadata,
        null,
        null,
        'My personal notes here',
      );

      expect(capturedMarkdown).toContain('📌 Note Personali');
      expect(capturedMarkdown).toContain('My personal notes here');
    });

    it('test_exportToMarkdown_without_summary_skips_section', () => {
      MarkdownExporter.exportToMarkdown(mockArticle, null, [], mockMetadata);

      expect(capturedMarkdown).not.toContain('## 📝 Riassunto');
    });
  });

  describe('getCitationTypeLabel', () => {
    it('test_getCitationTypeLabel_delegates_to_CitationFormatter', () => {
      const result = MarkdownExporter.getCitationTypeLabel('direct_quote');
      expect(result).toBe('Citazione Diretta');
    });

    it('test_getCitationTypeLabel_unknown_returns_altro', () => {
      const result = MarkdownExporter.getCitationTypeLabel('unknown_type');
      expect(result).toBe('Altro');
    });
  });

  describe('exportToMarkdown with citations', () => {
    it('test_exportToMarkdown_with_citations_includes_bibliography_section', () => {
      // Arrange
      const citations = {
        article: { title: 'Test', url: 'https://example.com', author: 'Author' },
        citations: [
          {
            id: 1,
            author: 'Smith, J.',
            source: 'Nature',
            year: 2023,
            quote_text: 'This is the quote text.',
            context: 'Context of the citation.',
            type: 'direct_quote',
            paragraph: 2,
          },
        ],
        total_citations: 1,
      };

      // Act
      MarkdownExporter.exportToMarkdown(
        mockArticle,
        'Summary',
        [],
        mockMetadata,
        null,
        null,
        null,
        citations,
      );

      // Assert
      expect(capturedMarkdown).toContain('## 📚 Citazioni e Bibliografia');
      expect(capturedMarkdown).toContain('### Articolo Principale');
      expect(capturedMarkdown).toContain('### Citazioni Trovate (1)');
      expect(capturedMarkdown).toContain('#### #1 - Smith, J.');
      expect(capturedMarkdown).toContain('📚 Nature (2023)');
      expect(capturedMarkdown).toContain('> "This is the quote text."');
      expect(capturedMarkdown).toContain('Context of the citation.');
      expect(capturedMarkdown).toContain('*Tipo:* Citazione Diretta');
      expect(capturedMarkdown).toContain('*Paragrafo:* §2');
    });

    it('test_exportToMarkdown_citation_with_additional_info', () => {
      // Arrange
      const citations = {
        article: { title: 'T', url: 'u' },
        citations: [
          {
            id: 1,
            author: 'Doe, J.',
            type: 'study_reference',
            additional_info: {
              study_title: 'A Study on Things',
              journal: 'Science',
              doi: '10.1234/test',
              url: 'https://doi.org/10.1234',
            },
          },
        ],
      };

      // Act
      MarkdownExporter.exportToMarkdown(
        mockArticle,
        'Summary',
        [],
        mockMetadata,
        null,
        null,
        null,
        citations,
      );

      // Assert
      expect(capturedMarkdown).toContain('**Studio:** "A Study on Things"');
      expect(capturedMarkdown).toContain('**Journal:** Science');
      expect(capturedMarkdown).toContain('**DOI:** 10.1234/test');
      expect(capturedMarkdown).toContain('**URL:** https://doi.org/10.1234');
    });

    it('test_exportToMarkdown_citation_unknown_author_shows_fallback', () => {
      // Arrange
      const citations = {
        article: {},
        citations: [{ id: 1, author: 'N/A', type: 'other' }],
      };

      // Act
      MarkdownExporter.exportToMarkdown(
        mockArticle,
        'Summary',
        [],
        mockMetadata,
        null,
        null,
        null,
        citations,
      );

      // Assert
      expect(capturedMarkdown).toContain('Fonte non specificata');
    });

    it('test_exportToMarkdown_citation_without_author_shows_fallback', () => {
      // Arrange
      const citations = {
        article: {},
        citations: [{ id: 1, type: 'other' }],
      };

      // Act
      MarkdownExporter.exportToMarkdown(
        mockArticle,
        'Summary',
        [],
        mockMetadata,
        null,
        null,
        null,
        citations,
      );

      // Assert
      expect(capturedMarkdown).toContain('Fonte non specificata');
    });

    it('test_exportToMarkdown_citation_uses_totalCount_fallback', () => {
      // Arrange
      const citations = {
        article: {},
        citations: [{ id: 1, author: 'Auth', type: 'other' }],
        totalCount: 5,
      };

      // Act
      MarkdownExporter.exportToMarkdown(
        mockArticle,
        'Summary',
        [],
        mockMetadata,
        null,
        null,
        null,
        citations,
      );

      // Assert
      expect(capturedMarkdown).toContain('### Citazioni Trovate (5)');
    });

    it('test_exportToMarkdown_citation_uses_array_length_when_no_count', () => {
      // Arrange
      const citations = {
        article: {},
        citations: [
          { id: 1, author: 'A', type: 'other' },
          { id: 2, author: 'B', type: 'other' },
        ],
      };

      // Act
      MarkdownExporter.exportToMarkdown(
        mockArticle,
        'Summary',
        [],
        mockMetadata,
        null,
        null,
        null,
        citations,
      );

      // Assert
      expect(capturedMarkdown).toContain('### Citazioni Trovate (2)');
    });

    it('test_exportToMarkdown_empty_citations_array_skips_section', () => {
      // Arrange
      const citations = { article: {}, citations: [] };

      // Act
      MarkdownExporter.exportToMarkdown(
        mockArticle,
        'Summary',
        [],
        mockMetadata,
        null,
        null,
        null,
        citations,
      );

      // Assert
      expect(capturedMarkdown).not.toContain('## 📚 Citazioni e Bibliografia');
    });

    it('test_exportToMarkdown_null_citations_skips_section', () => {
      // Act
      MarkdownExporter.exportToMarkdown(mockArticle, 'Summary', [], mockMetadata);

      // Assert
      expect(capturedMarkdown).not.toContain('## 📚 Citazioni e Bibliografia');
    });

    it('test_exportToMarkdown_citation_source_only_year_optional', () => {
      // Arrange — citation with source but no year
      const citations = {
        article: {},
        citations: [{ id: 1, author: 'Auth', source: 'Journal X', type: 'other' }],
      };

      // Act
      MarkdownExporter.exportToMarkdown(
        mockArticle,
        'Summary',
        [],
        mockMetadata,
        null,
        null,
        null,
        citations,
      );

      // Assert
      expect(capturedMarkdown).toContain('📚 Journal X');
    });

    it('test_exportToMarkdown_citation_uses_text_field_as_fallback_for_quote', () => {
      // Arrange — uses .text instead of .quote_text
      const citations = {
        article: {},
        citations: [{ id: 1, author: 'Auth', text: 'Alt quote text.', type: 'other' }],
      };

      // Act
      MarkdownExporter.exportToMarkdown(
        mockArticle,
        'Summary',
        [],
        mockMetadata,
        null,
        null,
        null,
        citations,
      );

      // Assert
      expect(capturedMarkdown).toContain('> "Alt quote text."');
    });
  });

  describe('exportToMarkdown metadata edge cases', () => {
    it('test_exportToMarkdown_missing_provider_shows_NA', () => {
      // Act
      MarkdownExporter.exportToMarkdown(mockArticle, 'Summary', [], {});

      // Assert
      expect(capturedMarkdown).toContain('**Provider:** N/A');
    });

    it('test_exportToMarkdown_missing_language_shows_NA', () => {
      // Act
      MarkdownExporter.exportToMarkdown(mockArticle, 'Summary', [], {});

      // Assert
      expect(capturedMarkdown).toContain('**Lingua:** N/A');
    });

    it('test_exportToMarkdown_missing_contentType_shows_NA', () => {
      // Act
      MarkdownExporter.exportToMarkdown(mockArticle, 'Summary', [], {});

      // Assert
      expect(capturedMarkdown).toContain('**Tipo:** N/A');
    });

    it('test_exportToMarkdown_includes_footer', () => {
      // Act
      MarkdownExporter.exportToMarkdown(mockArticle, 'Summary', [], mockMetadata);

      // Assert
      expect(capturedMarkdown).toContain('Generato con AI Article Summarizer');
    });

    it('test_exportToMarkdown_empty_keypoints_skips_section', () => {
      // Act
      MarkdownExporter.exportToMarkdown(mockArticle, 'Summary', [], mockMetadata);

      // Assert
      expect(capturedMarkdown).not.toContain('## 🔑 Punti Chiave');
    });

    it('test_exportToMarkdown_null_translation_skips_section', () => {
      // Act
      MarkdownExporter.exportToMarkdown(mockArticle, 'Summary', [], mockMetadata, null);

      // Assert
      expect(capturedMarkdown).not.toContain('## 🌍 Traduzione');
    });

    it('test_exportToMarkdown_empty_qa_skips_section', () => {
      // Act
      MarkdownExporter.exportToMarkdown(mockArticle, 'Summary', [], mockMetadata, null, []);

      // Assert
      expect(capturedMarkdown).not.toContain('## 💬 Domande e Risposte');
    });
  });

  describe('exportMultiAnalysisToMarkdown', () => {
    const mockAnalysis = {
      timestamp: new Date('2024-01-15').getTime(),
      globalSummary: 'Global summary of all articles.',
      comparison: 'Comparison between the articles.',
      qa: {
        questions: [{ question: 'What is common?', answer: 'Both discuss AI.' }],
      },
    };

    const mockArticles = [
      { article: { title: 'Article One', url: 'https://one.com', wordCount: 1000 } },
      { article: { title: 'Article Two', url: 'https://two.com', wordCount: 2000 } },
    ];

    // Helper: esegue exportMultiAnalysisToMarkdown e cattura il markdown via Blob mock
    function captureMultiMarkdown(analysis, articles, options) {
      let captured = null;
      const mockLink = { href: '', download: '', click: vi.fn() };

      // Blob deve essere un costruttore reale che cattura il contenuto
      class MockBlob {
        constructor(parts) {
          captured = parts[0];
        }
      }

      const originalBlob = globalThis.Blob;
      globalThis.Blob = MockBlob;
      globalThis.URL = { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() };
      vi.spyOn(document, 'createElement').mockReturnValueOnce(mockLink);
      vi.spyOn(document.body, 'appendChild').mockImplementationOnce(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementationOnce(() => {});

      MarkdownExporter.exportMultiAnalysisToMarkdown(analysis, articles, options);

      globalThis.Blob = originalBlob;
      return captured;
    }

    it('test_exportMultiAnalysis_includesHeader', () => {
      const md = captureMultiMarkdown(mockAnalysis, mockArticles);

      expect(md).toContain('# Analisi Multi Articolo');
      expect(md).toContain('**Numero articoli:** 2');
    });

    it('test_exportMultiAnalysis_listsAllArticles', () => {
      const md = captureMultiMarkdown(mockAnalysis, mockArticles);

      expect(md).toContain('**Article One**');
      expect(md).toContain('https://one.com');
      expect(md).toContain('**Article Two**');
      expect(md).toContain('https://two.com');
    });

    it('test_exportMultiAnalysis_includesGlobalSummary_whenEnabled', () => {
      const md = captureMultiMarkdown(mockAnalysis, mockArticles, { includeSummary: true });

      expect(md).toContain('## 📝 Riassunto Globale');
      expect(md).toContain('Global summary of all articles.');
    });

    it('test_exportMultiAnalysis_skipsGlobalSummary_whenDisabled', () => {
      const md = captureMultiMarkdown(mockAnalysis, mockArticles, { includeSummary: false });

      expect(md).not.toContain('## 📝 Riassunto Globale');
    });

    it('test_exportMultiAnalysis_includesComparison_whenEnabled', () => {
      const md = captureMultiMarkdown(mockAnalysis, mockArticles);

      expect(md).toContain('## ⚖️ Confronto Idee');
      expect(md).toContain('Comparison between the articles.');
    });

    it('test_exportMultiAnalysis_skipsComparison_whenDisabled', () => {
      const md = captureMultiMarkdown(mockAnalysis, mockArticles, { includeComparison: false });

      expect(md).not.toContain('## ⚖️ Confronto Idee');
    });

    it('test_exportMultiAnalysis_includesQA_whenEnabled', () => {
      const md = captureMultiMarkdown(mockAnalysis, mockArticles);

      expect(md).toContain('## 💬 Domande e Risposte');
      expect(md).toContain('What is common?');
      expect(md).toContain('Both discuss AI.');
    });

    it('test_exportMultiAnalysis_skipsQA_whenDisabled', () => {
      const md = captureMultiMarkdown(mockAnalysis, mockArticles, { includeQA: false });

      expect(md).not.toContain('## 💬 Domande e Risposte');
    });

    it('test_exportMultiAnalysis_skipsQA_whenEmpty', () => {
      const analysisNoQA = { ...mockAnalysis, qa: { questions: [] } };
      const md = captureMultiMarkdown(analysisNoQA, mockArticles);

      expect(md).not.toContain('## 💬 Domande e Risposte');
    });

    it('test_exportMultiAnalysis_skipsQA_whenNull', () => {
      const analysisNoQA = { ...mockAnalysis, qa: null };
      const md = captureMultiMarkdown(analysisNoQA, mockArticles);

      expect(md).not.toContain('## 💬 Domande e Risposte');
    });

    it('test_exportMultiAnalysis_includesFooter', () => {
      const md = captureMultiMarkdown(mockAnalysis, mockArticles);

      expect(md).toContain('Analisi Multi Articolo');
    });

    it('test_exportMultiAnalysis_skipsGlobalSummary_whenNull', () => {
      const analysisNoSummary = { ...mockAnalysis, globalSummary: null };
      const md = captureMultiMarkdown(analysisNoSummary, mockArticles);

      expect(md).not.toContain('## 📝 Riassunto Globale');
    });

    it('test_exportMultiAnalysis_skipsComparison_whenNull', () => {
      const analysisNoComp = { ...mockAnalysis, comparison: null };
      const md = captureMultiMarkdown(analysisNoComp, mockArticles);

      expect(md).not.toContain('## ⚖️ Confronto Idee');
    });
  });

  describe('downloadMarkdown', () => {
    function runDownloadMarkdown(content, title) {
      // Restore the spy set by beforeEach so the real method runs
      vi.mocked(MarkdownExporter.downloadMarkdown).mockRestore();

      const mockLink = { href: '', download: '', click: vi.fn() };

      class MockBlob {
        constructor() {}
      }
      const originalBlob = globalThis.Blob;
      globalThis.Blob = MockBlob;
      globalThis.URL = { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() };

      const createSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

      MarkdownExporter.downloadMarkdown(content, title);

      globalThis.Blob = originalBlob;
      createSpy.mockRestore();
      appendSpy.mockRestore();
      removeSpy.mockRestore();

      return mockLink;
    }

    it('test_downloadMarkdown_createsAndClicksLink', () => {
      // Act
      const mockLink = runDownloadMarkdown('# Content', 'My Test Title');

      // Assert
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toMatch(/riassunto_my_test_title_\d+\.md/);
    });

    it('test_downloadMarkdown_sanitizesTitle_removesSpecialChars', () => {
      // Act
      const mockLink = runDownloadMarkdown('content', 'Title: With Special! Chars?');

      // Assert
      expect(mockLink.download).toMatch(/^riassunto_title__with_special__chars_/);
    });

    it('test_downloadMarkdown_truncatesLongTitle_to50chars', () => {
      // Arrange — title > 50 chars
      const longTitle = 'A'.repeat(100);

      // Act
      const mockLink = runDownloadMarkdown('content', longTitle);

      // Assert — filename deve avere al massimo 50 chars di titolo sanitizzato
      const titlePart = mockLink.download.replace(/^riassunto_/, '').replace(/_\d+\.md$/, '');
      expect(titlePart.length).toBeLessThanOrEqual(50);
    });
  });
});
