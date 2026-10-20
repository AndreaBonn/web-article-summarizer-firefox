// Markdown Exporter - Genera file Markdown ben formattati
import { CitationExtractor } from '../ai/citation-extractor.js';
import { CitationFormatter } from '../ai/citation-formatter.js';
import { docLabel, docDate } from './doc-labels.js';

export class MarkdownExporter {
  static exportToMarkdown(
    article,
    summary,
    keyPoints,
    metadata,
    translation = null,
    qaList = null,
    notes = null,
    citations = null,
  ) {
    let markdown = '';

    // Header con metadata
    markdown += `# ${article.title}\n\n`;
    markdown += `---\n\n`;
    markdown += `**URL:** ${article.url}\n\n`;
    markdown += `**${docLabel('lengthLabel')}:** ${docLabel('length', { words: article.wordCount, minutes: article.readingTimeMinutes })}\n\n`;
    markdown += `**${docLabel('generatedOn')}:** ${docDate(new Date())}\n\n`;
    markdown += `**Provider:** ${metadata.provider || 'N/A'}\n\n`;
    markdown += `**${docLabel('language')}:** ${metadata.language || 'N/A'}\n\n`;
    markdown += `**${docLabel('type')}:** ${metadata.contentType || 'N/A'}\n\n`;
    markdown += `---\n\n`;

    // Note personali (se presenti)
    if (notes) {
      markdown += `## 📌 ${docLabel('personalNotes')}\n\n`;
      markdown += `${notes}\n\n`;
      markdown += `---\n\n`;
    }

    // Riassunto (se incluso)
    if (summary) {
      markdown += `## 📝 ${docLabel('summary')}\n\n`;
      markdown += `${summary}\n\n`;
      markdown += `---\n\n`;
    }

    // Punti chiave (se inclusi)
    if (keyPoints && keyPoints.length > 0) {
      markdown += `## 🔑 ${docLabel('keyPoints')}\n\n`;
      keyPoints.forEach((point, index) => {
        markdown += `### ${index + 1}. ${point.title}\n\n`;
        markdown += `**${docLabel('reference')}:** §${point.paragraphs}\n\n`;
        markdown += `${point.description}\n\n`;
      });
      markdown += `---\n\n`;
    }

    // Traduzione (se inclusa)
    if (translation) {
      markdown += `## 🌍 ${docLabel('translation')}\n\n`;
      markdown += `${translation}\n\n`;
      markdown += `---\n\n`;
    }

    // Q&A (se incluse)
    if (qaList && qaList.length > 0) {
      markdown += `## 💬 ${docLabel('qa')}\n\n`;
      qaList.forEach((qa, index) => {
        markdown += `### Q${index + 1}: ${qa.question}\n\n`;
        markdown += `**${docLabel('answerShort')}${index + 1}:** ${qa.answer}\n\n`;
      });
      markdown += `---\n\n`;
    }

    // Citations (se incluse)
    if (citations && citations.citations && citations.citations.length > 0) {
      markdown += `## 📚 ${docLabel('citationsBibliography')}\n\n`;

      // Citazione articolo principale
      markdown += `### ${docLabel('mainArticle')}\n\n`;
      const mainCitation = CitationExtractor.formatCitation(citations.article, 'apa');
      markdown += `${mainCitation}\n\n`;
      markdown += `---\n\n`;

      // Citazioni trovate
      const totalCitations =
        citations.total_citations || citations.totalCount || citations.citations.length;
      markdown += `### ${docLabel('citationsFound')} (${totalCitations})\n\n`;
      citations.citations.forEach((citation, _index) => {
        const author =
          citation.author && citation.author !== 'N/A'
            ? citation.author
            : docLabel('unknownSource');
        markdown += `#### #${citation.id} - ${author}\n\n`;

        // Source and year
        if (citation.source || citation.year) {
          let sourceInfo = '';
          if (citation.source && citation.source !== 'N/A') sourceInfo += `📚 ${citation.source}`;
          if (citation.year) sourceInfo += ` (${citation.year})`;
          if (sourceInfo) {
            markdown += `${sourceInfo}\n\n`;
          }
        }

        // Citation text
        const quoteText = citation.quote_text || citation.text || '';
        if (quoteText) {
          markdown += `> "${quoteText}"\n\n`;
        }

        // Context
        if (citation.context) {
          markdown += `${citation.context}\n\n`;
        }

        // Type and paragraph
        const typeLabel = this.getCitationTypeLabel(citation.type);
        let metadata = `*${docLabel('type')}:* ${typeLabel}`;
        if (citation.paragraph) {
          metadata += ` | *${docLabel('paragraph')}:* §${citation.paragraph}`;
        }
        markdown += `${metadata}\n\n`;

        // Additional info
        if (citation.additional_info) {
          const info = citation.additional_info;
          const details = [];
          if (info.study_title) details.push(`**${docLabel('study')}:** "${info.study_title}"`);
          if (info.journal) details.push(`**Journal:** ${info.journal}`);
          if (info.doi) details.push(`**DOI:** ${info.doi}`);
          if (info.url) details.push(`**URL:** ${info.url}`);

          if (details.length > 0) {
            markdown += `*${docLabel('details')}:* ${details.join(' | ')}\n\n`;
          }
        }
      });
      markdown += `---\n\n`;
    }

    // Footer
    markdown += `\n*${docLabel('generatedWith')}*\n`;

    // Crea e scarica il file
    this.downloadMarkdown(markdown, article.title);
  }

  static downloadMarkdown(content, title) {
    // Crea blob
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });

    // Crea URL
    const url = URL.createObjectURL(blob);

    // Crea link temporaneo
    const link = document.createElement('a');
    link.href = url;

    // Genera filename
    const sanitizedTitle = title
      .substring(0, 50)
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    link.download = `${docLabel('fileSummary')}_${sanitizedTitle}_${Date.now()}.md`;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static exportMultiAnalysisToMarkdown(analysis, articles, options = {}) {
    // Default: include tutto se non specificato
    const { includeSummary = true, includeComparison = true, includeQA = true } = options;

    let markdown = '';

    // Header
    markdown += `# ${docLabel('multiTitle')}\n\n`;
    markdown += `---\n\n`;
    markdown += `**${docLabel('generatedOn')}:** ${docDate(new Date(analysis.timestamp))}\n\n`;
    markdown += `**${docLabel('articleCount')}:** ${articles.length}\n\n`;
    markdown += `---\n\n`;

    // Articles List
    markdown += `## 📚 ${docLabel('analyzedArticlesHeading')}\n\n`;
    articles.forEach((article, index) => {
      markdown += `${index + 1}. **${article.article.title}**\n`;
      markdown += `   - URL: ${article.article.url}\n`;
      markdown += `   - ${docLabel('words')}: ${article.article.wordCount}\n\n`;
    });
    markdown += `---\n\n`;

    // Global Summary
    if (includeSummary && analysis.globalSummary) {
      markdown += `## 📝 ${docLabel('globalSummary')}\n\n`;
      markdown += `${analysis.globalSummary}\n\n`;
      markdown += `---\n\n`;
    }

    // Comparison
    if (includeComparison && analysis.comparison) {
      markdown += `## ⚖️ ${docLabel('comparison')}\n\n`;
      markdown += `${analysis.comparison}\n\n`;
      markdown += `---\n\n`;
    }

    // Q&A
    if (includeQA && analysis.qa && analysis.qa.questions && analysis.qa.questions.length > 0) {
      markdown += `## 💬 ${docLabel('qa')}\n\n`;
      analysis.qa.questions.forEach((qa, index) => {
        markdown += `### Q${index + 1}: ${qa.question}\n\n`;
        markdown += `**${docLabel('answerShort')}${index + 1}:** ${qa.answer}\n\n`;
      });
      markdown += `---\n\n`;
    }

    // Footer
    markdown += `\n*${docLabel('generatedWithMulti')}*\n`;

    // Download
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docLabel('fileMulti')}_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static getCitationTypeLabel(type) {
    return CitationFormatter.getCitationTypeLabel(type);
  }
}
