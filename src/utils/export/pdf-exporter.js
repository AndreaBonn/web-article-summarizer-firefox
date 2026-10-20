// PDF Exporter - Genera PDF ben formattati per riassunti e punti chiave
import { CitationExtractor } from '../ai/citation-extractor.js';
import { CitationFormatter } from '../ai/citation-formatter.js';
import { PDFBuilder } from './pdf-builder.js';
import { docLabel, docHeading, docDate } from './doc-labels.js';

export class PDFExporter {
  static async exportToPDF(
    article,
    summary,
    keyPoints,
    metadata,
    translation = null,
    qaList = null,
    citations = null,
  ) {
    const pdf = new PDFBuilder();

    // Header
    pdf.writeText('AI Article Summarizer', { fontSize: 20, style: 'bold' });
    pdf.addSpacing(3);

    // Metadata
    const date = docDate(new Date());
    pdf.writeText(`${docLabel('generatedOn')}: ${date}`, { fontSize: 10, color: [100, 100, 100] });
    pdf.writeText(`Provider: ${metadata.provider || 'N/A'}`, {
      fontSize: 10,
      color: [100, 100, 100],
    });
    pdf.writeText(`${docLabel('language')}: ${metadata.language || 'N/A'}`, {
      fontSize: 10,
      color: [100, 100, 100],
    });
    pdf.writeText(`${docLabel('type')}: ${metadata.contentType || 'N/A'}`, {
      fontSize: 10,
      color: [100, 100, 100],
    });
    pdf.addSpacing(5);
    pdf.addSeparator();

    // Article Title
    pdf.writeText(article.title, { fontSize: 16, style: 'bold' });
    pdf.addSpacing(2);

    // Article Stats
    pdf.writeText(
      docLabel('length', { words: article.wordCount, minutes: article.readingTimeMinutes }),
      {
        fontSize: 9,
        style: 'italic',
        color: [100, 100, 100],
      },
    );
    pdf.writeText(`URL: ${article.url}`, { fontSize: 9, style: 'italic', color: [100, 100, 100] });
    pdf.addSpacing(10);

    // Summary
    if (summary) {
      pdf.writeSectionTitle(docHeading('summary'));
      pdf.writeTextBlock(summary);
      pdf.addSpacing();
    }

    // Key Points
    pdf.renderKeyPoints(keyPoints);

    // Translation
    if (translation) {
      pdf.addSpacing();
      pdf.writeSectionTitle(docHeading('translation'));
      pdf.writeTextBlock(translation);
    }

    // Q&A
    pdf.renderQA(qaList);

    // Citations
    if (citations?.citations?.length > 0) {
      this._renderCitations(pdf, citations);
    }

    const sanitized = PDFBuilder.sanitizeFilename(article.title);
    pdf.save(`${docLabel('fileSummary')}_${sanitized}_${Date.now()}.pdf`);
  }

  static async exportKeyPointsOnly(article, keyPoints, _metadata) {
    const pdf = new PDFBuilder();

    pdf.writeText(`${docLabel('keyPoints')} - Web Sites Summarizer`, {
      fontSize: 20,
      style: 'bold',
    });
    pdf.addSpacing(8);

    pdf.writeText(article.title, { fontSize: 14, style: 'bold' });
    pdf.addSpacing(5);

    pdf.renderKeyPoints(keyPoints);

    const sanitized = PDFBuilder.sanitizeFilename(article.title);
    pdf.save(`${docLabel('fileKeyPoints')}_${sanitized}_${Date.now()}.pdf`);
  }

  static async exportMultiAnalysisToPDF(analysis, articles, options = {}) {
    const { includeSummary = true, includeComparison = true, includeQA = true } = options;
    const pdf = new PDFBuilder();

    // Header
    pdf.writeText(docLabel('multiTitle'), { fontSize: 20, style: 'bold' });
    pdf.addSpacing(3);

    // Metadata
    const date = docDate(new Date(analysis.timestamp));
    pdf.writeText(`${docLabel('generatedOn')}: ${date}`, { fontSize: 10, color: [100, 100, 100] });
    pdf.writeText(`${docLabel('articleCount')}: ${articles.length}`, {
      fontSize: 10,
      color: [100, 100, 100],
    });
    pdf.addSpacing(5);

    // Articles List
    pdf.writeSectionTitle(`${docHeading('analyzedArticles')}:`);
    articles.forEach((article, index) => {
      pdf.writeText(`${index + 1}. ${article.article.title}`, { fontSize: 9, indent: 5 });
      pdf.addSpacing(1);
    });
    pdf.addSpacing(5);

    // Global Summary
    if (includeSummary && analysis.globalSummary) {
      pdf.writeSectionTitle(docHeading('globalSummary'));
      pdf.writeTextBlock(analysis.globalSummary);
      pdf.addSpacing(10);
    }

    // Comparison
    if (includeComparison && analysis.comparison) {
      pdf.writeSectionTitle(docHeading('comparison'));
      pdf.writeTextBlock(analysis.comparison);
      pdf.addSpacing(10);
    }

    // Q&A
    if (includeQA && analysis.qa?.questions?.length > 0) {
      pdf.renderQA(analysis.qa.questions);
    }

    pdf.save(`${docLabel('fileMulti')}_${Date.now()}.pdf`);
  }

  static _renderCitations(pdf, citations) {
    pdf.checkPageBreak(200);
    pdf.writeSectionTitle(docHeading('citationsBibliography'));

    // Main article citation
    pdf.writeText(`${docLabel('mainArticle')}:`, {
      fontSize: 11,
      style: 'bold',
      color: [102, 126, 234],
    });
    const mainCitation = CitationExtractor.formatCitation(citations.article, 'apa');
    pdf.writeTextBlock(mainCitation, { fontSize: 9, indent: 5 });
    pdf.addSpacing(5);

    // Found citations
    const totalCitations =
      citations.total_citations || citations.totalCount || citations.citations.length;
    pdf.writeText(`${docLabel('citationsFound')} (${totalCitations}):`, {
      fontSize: 11,
      style: 'bold',
      color: [102, 126, 234],
    });
    pdf.addSpacing(3);

    citations.citations.forEach((citation) => {
      pdf.checkPageBreak(250);

      // Author
      const author =
        citation.author && citation.author !== 'N/A' ? citation.author : docLabel('unknownSource');
      pdf.writeText(`#${citation.id} - ${author}`, { fontSize: 10, style: 'bold' });

      // Source and year
      if (citation.source || citation.year) {
        let sourceInfo = '';
        if (citation.source && citation.source !== 'N/A') sourceInfo += citation.source;
        if (citation.year) sourceInfo += ` (${citation.year})`;
        if (sourceInfo) {
          pdf.writeText(sourceInfo, { fontSize: 8, color: [100, 100, 100], indent: 5 });
        }
      }

      // Quote text
      const quoteText = citation.quote_text || citation.text || '';
      if (quoteText) {
        pdf.writeText(`"${quoteText}"`, {
          fontSize: 9,
          style: 'italic',
          color: [60, 60, 60],
          indent: 5,
        });
        pdf.addSpacing(1);
      }

      // Context
      if (citation.context) {
        pdf.writeTextBlock(citation.context, { fontSize: 9, indent: 5 });
        pdf.addSpacing(1);
      }

      // Type and paragraph
      const typeLabel = this.getCitationTypeLabel(citation.type);
      let metaText = `${docLabel('type')}: ${typeLabel}`;
      if (citation.paragraph) metaText += ` | ${docLabel('paragraph')}: §${citation.paragraph}`;
      pdf.writeText(metaText, { fontSize: 8, color: [100, 100, 100], indent: 5 });
      pdf.addSpacing(3);
    });
  }

  static getCitationTypeLabel(type) {
    return CitationFormatter.getCitationTypeLabel(type);
  }
}
