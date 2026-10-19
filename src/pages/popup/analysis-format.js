// Pure helpers for the popup analysis flow: no access to state, elements or browser APIs.
// The caller reads the values and assigns the results.

import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { CitationExtractor } from '../../utils/ai/citation-extractor.js';
import { getContentTypeLabel, getProviderLabel } from '../../utils/core/display-labels.js';
import {
  formatQAText,
  formatTranslationText,
  formatSummaryWithKeyPointsText,
} from '../../shared/export-formatters.js';

export const MAX_CONTENT_LENGTH = 50000;

// Returns the error to throw when the content script could not be reached
export function toExtractionError(msgError) {
  if (
    msgError.message?.includes('Could not establish connection') ||
    msgError.message?.includes('Receiving end does not exist')
  ) {
    return new Error('Impossibile comunicare con la pagina. Ricarica la pagina (F5) e riprova.', {
      cause: msgError,
    });
  }
  return msgError;
}

// Limit article content size to prevent excessive resource usage
export function truncateContent(content, maxLength = MAX_CONTENT_LENGTH) {
  if (content && content.length > maxLength) {
    return content.substring(0, maxLength);
  }
  return content;
}

// ContentType saved in history for an already analyzed article, or null
export function findSavedContentType(history, url) {
  const previousAnalysis = history.find((entry) => entry.article.url === url);
  if (previousAnalysis && previousAnalysis.metadata && previousAnalysis.metadata.contentType) {
    return previousAnalysis.metadata.contentType;
  }
  return null;
}

export function resolveContentTypeOutcome(selectedContentType, finalContentType) {
  if (selectedContentType === 'auto') {
    return { detectedContentType: finalContentType, contentTypeMethod: 'auto' };
  }
  return { detectedContentType: selectedContentType, contentTypeMethod: 'manual' };
}

export function formatArticleMeta(article, results, providerValue) {
  const parts = [
    `${article.wordCount} ${I18n.t('article.words')}`,
    `${article.readingTimeMinutes} ${I18n.t('article.readingTime')}`,
  ];
  const type = results?.detectedContentType;
  if (type && type !== 'auto') parts.push(getContentTypeLabel(type, I18n.currentLanguage));
  if (results) parts.push(getProviderLabel(providerValue));
  return parts.join(' · ');
}

export function renderKeypointsHtml(keyPoints) {
  let keypointsHtml = `<p class="keypoints-hint">${HtmlSanitizer.escape(I18n.t('keypoints.clickHint'))}</p>`;
  const showLabel = HtmlSanitizer.escape(I18n.t('keypoints.showInArticle'));
  keyPoints.forEach((point, index) => {
    const paragraphs = HtmlSanitizer.escape(String(point.paragraphs));
    keypointsHtml += `
      <div class="keypoint" role="button" tabindex="0" data-paragraph="${paragraphs}">
        <div class="keypoint-header">
          <div class="keypoint-title">${index + 1}. ${HtmlSanitizer.escape(point.title)}</div>
          <div class="keypoint-ref" title="§${paragraphs}">${showLabel}</div>
        </div>
        <div class="keypoint-desc">${HtmlSanitizer.escape(point.description)}</div>
      </div>
    `;
  });
  return keypointsHtml;
}

export function buildHistoryMetadata({
  providerValue,
  selectedLanguage,
  selectedContentType,
  results,
}) {
  return {
    provider: providerValue,
    language: selectedLanguage,
    contentType: results.detectedContentType || selectedContentType,
    contentTypeMethod: results.contentTypeMethod || 'manual',
    fromCache: results.fromCache || false,
  };
}

export function buildCopyText({ results, translation, qa, citations, article, citationStyle }) {
  let text = formatSummaryWithKeyPointsText(results.summary, results.keyPoints);

  // Aggiungi traduzione se presente
  if (translation) {
    text += `\n`;
    text += formatTranslationText(translation);
  }

  // Aggiungi Q&A se presenti
  if (qa && qa.length > 0) {
    text += `\n`;
    text += formatQAText(qa);
  }

  // Aggiungi citazioni se presenti
  if (citations && citations.citations && citations.citations.length > 0) {
    text += `\n${'='.repeat(50)}\n\n`;
    text += `CITAZIONI E BIBLIOGRAFIA:\n\n`;
    text += CitationExtractor.generateBibliography(
      article,
      citations.citations,
      citationStyle || 'apa',
    );
  }

  return text;
}
