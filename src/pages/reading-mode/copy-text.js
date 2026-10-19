// Reading Mode - pure builders for clipboard text, PDF export arguments and Q&A article shape

import {
  formatCitationsText,
  formatQAText,
  formatTranslationText,
  formatKeyPointsText,
} from '../../shared/export-formatters.js';

const SEPARATOR = '='.repeat(60);

function buildNotesText(notes) {
  if (!notes) return '';
  return `${SEPARATOR}\n\nNOTE PERSONALI:\n${notes}\n\n`;
}

/**
 * Plain text copied by "copy all" in reading mode, for both PDFs and articles.
 * @param {Object} data - Reading mode data
 * @returns {string} Header, summary, key points, translation, Q&A, citations and notes
 */
export function buildReadingModeCopyText(data) {
  const { article, pdf, summary, keyPoints } = data;
  let text;

  if (data.isPDF || pdf) {
    text = `PDF: ${pdf?.name || data.filename || 'Documento'}\n`;
    text += `Pagine: ${pdf?.pages || data.pageCount || 'N/A'}\n\n`;
    text += `${SEPARATOR}\n\n`;
    text += `RIASSUNTO:\n${summary}\n\n`;
    text += formatKeyPointsText(keyPoints);
  } else {
    text = `ARTICOLO: ${article.title}\n`;
    text += `URL: ${article.url}\n\n`;
    text += `${SEPARATOR}\n\n`;
    text += `RIASSUNTO:\n${summary}\n\n`;
    text += formatKeyPointsText(keyPoints, true);
  }

  text += formatTranslationText(data.translation);
  text += formatQAText(data.qa);
  text += formatCitationsText(data.citations?.citations);
  text += buildNotesText(data.notes);
  return text;
}

/**
 * Article and metadata objects passed to the PDF exporter.
 * @param {Object} data - Reading mode data
 * @returns {{articleData: Object, metadataData: Object}} Export arguments
 */
export function buildPdfExportArgs(data) {
  const { article, pdf, metadata } = data;

  const articleData =
    data.isPDF || pdf
      ? {
          title: pdf?.name || data.filename || 'Documento PDF',
          url: 'PDF Document',
          content: data.extractedText || pdf?.text || '',
          wordCount: 0,
          readingTimeMinutes: 0,
        }
      : article;

  const metadataData = metadata ||
    data.metadata || {
      provider: data.apiProvider || 'AI',
      language: 'it',
      contentType: 'pdf',
    };

  return { articleData, metadataData };
}

/**
 * Article with a numbered paragraphs array, as the Q&A service expects.
 * @param {Object} article - Article with `content` and/or `paragraphs`
 * @returns {Object} New article object (input is not mutated)
 */
export function toArticleWithParagraphs(article) {
  const articleWithParagraphs = {
    ...article,
    paragraphs: [],
  };

  if (article.content && !article.paragraphs) {
    const paragraphs = article.content.split('\n\n');
    articleWithParagraphs.paragraphs = paragraphs
      .filter((p) => p.trim())
      .map((text, index) => ({
        id: index + 1,
        text: text.trim(),
      }));
  } else if (article.paragraphs) {
    articleWithParagraphs.paragraphs = article.paragraphs;
  }

  return articleWithParagraphs;
}
