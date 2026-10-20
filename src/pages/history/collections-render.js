import { getProviderLabel, getLanguageLabel } from '../../utils/core/display-labels.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';

export function renderPDFCardHtml(entry) {
  const date = HistoryManager.formatDate(entry.timestamp);
  const fileSize = HistoryManager.formatFileSize(entry.pdf.size);
  const isFavorite = entry.favorite || false;
  const hasTranslation = !!entry.translation;
  const hasQA = entry.qa && entry.qa.length > 0;
  const hasCitations =
    entry.citations && entry.citations.citations && entry.citations.citations.length > 0;
  const hasNotes = !!entry.notes;

  const badges = [];
  if (hasTranslation)
    badges.push(`<span class="badge">${I18n.t('history.badgeTranslated')}</span>`);
  if (hasQA) badges.push(`<span class="badge">${Number(entry.qa.length) || 0} Q&A</span>`);
  if (hasCitations)
    badges.push(
      `<span class="badge">${I18n.tf('history.badgeCitations', { count: Number(entry.citations.citations.length) || 0 })}</span>`,
    );
  if (hasNotes) badges.push(`<span class="badge">${I18n.t('tab.notes')}</span>`);
  if (entry.metadata.fromCache) badges.push('<span class="badge cache-badge">Cache</span>');

  return `
    <div class="history-card pdf-card" data-id="${HtmlSanitizer.escape(entry.id)}">
      <div class="card-header">
        <div class="card-title-row">
          <h3 class="card-title">${HtmlSanitizer.escape(entry.pdf.name)}</h3>
          <button class="btn-favorite ${isFavorite ? 'active' : ''}"
                  title="${I18n.t(isFavorite ? 'history.removeFavorite' : 'history.addFavorite')}">
            ${isFavorite ? '★' : '☆'}
          </button>
        </div>
        <div class="card-meta">
          <span class="meta-item">${HtmlSanitizer.escape(date)}</span>
          <span class="meta-item">${HtmlSanitizer.escape(fileSize)}</span>
          <span class="meta-item">${HtmlSanitizer.escape(String(entry.pdf.pages))} pagine</span>
          <span class="meta-item">${HtmlSanitizer.escape(getProviderLabel(entry.metadata.provider))}</span>
          <span class="meta-item">${HtmlSanitizer.escape(getLanguageLabel(entry.metadata.language, I18n.currentLanguage))}</span>
        </div>
      </div>

      <div class="card-content">
        <div class="summary-preview">
          ${HtmlSanitizer.escape(entry.summary.substring(0, 200))}${entry.summary.length > 200 ? '...' : ''}
        </div>

        ${badges.length > 0 ? `<div class="badges">${badges.join('')}</div>` : ''}

        <div class="keypoints-preview">
          <strong>${I18n.t('history.keyPointsLabel')}</strong>
          <ul>
            ${entry.keyPoints
              .slice(0, 3)
              .map((kp) => `<li>${HtmlSanitizer.escape(kp.title)}</li>`)
              .join('')}
            ${entry.keyPoints.length > 3 ? `<li><em>+${entry.keyPoints.length - 3} altri...</em></li>` : ''}
          </ul>
        </div>
      </div>

      <div class="card-actions">
        <button class="history-btn btn-delete btn-delete-full" title="${I18n.t('action.delete')}">
          ${I18n.t('action.delete')}
        </button>
      </div>
    </div>
  `;
}

export function renderMultiAnalysisCardHtml(entry) {
  const date = HistoryManager.formatDate(entry.timestamp);
  const qaCount = entry.analysis?.qa?.questions?.length || 0;
  const articlesCount = entry.articles?.length || 0;
  const provider = getProviderLabel(entry.metadata?.provider || 'unknown');

  return `
    <div class="multi-analysis-card" data-id="${HtmlSanitizer.escape(entry.id)}">
      <div class="multi-analysis-header">
        <div>
          <div class="multi-analysis-title">
            ${HtmlSanitizer.escape(I18n.t('multi.analysisOf'))} ${articlesCount} ${HtmlSanitizer.escape(I18n.t('multi.articles'))}
          </div>
          <div class="multi-analysis-meta">
            <span class="multi-analysis-badge articles">${articlesCount} ${HtmlSanitizer.escape(I18n.t('multi.articles'))}</span>
            <span class="multi-analysis-badge date">${HtmlSanitizer.escape(date)}</span>
            <span class="multi-analysis-badge provider">${HtmlSanitizer.escape(provider)}</span>
            ${qaCount > 0 ? `<span class="multi-analysis-badge qa">${qaCount} Q&A</span>` : ''}
          </div>
        </div>
        <button class="btn-favorite-multi ${entry.favorite ? 'active' : ''}" data-id="${HtmlSanitizer.escape(entry.id)}" title="${entry.favorite ? HtmlSanitizer.escape(I18n.t('history.removeFavorite')) : HtmlSanitizer.escape(I18n.t('history.addFavorite'))}">
          ${entry.favorite ? '★' : '☆'}
        </button>
      </div>

      <div class="multi-analysis-articles">
        <div class="multi-analysis-articles-title">${HtmlSanitizer.escape(I18n.t('multi.articlesIncluded'))}</div>
        ${
          entry.articles && entry.articles.length > 0
            ? entry.articles
                .slice(0, 3)
                .map(
                  (a) => `
          <div class="multi-analysis-article-item">${HtmlSanitizer.escape(a.title || I18n.t('common.titleUnavailable'))}</div>
        `,
                )
                .join('')
            : `<div class="multi-analysis-article-item">${I18n.t('multi.noArticles')}</div>`
        }
        ${entry.articles && entry.articles.length > 3 ? `<div class="multi-analysis-article-item">${I18n.tf('history.moreArticles', { count: entry.articles.length - 3 })}</div>` : ''}
      </div>

      <div class="multi-analysis-actions">
        <button class="multi-analysis-btn danger btn-delete-multi">${I18n.t('action.delete')}</button>
      </div>
    </div>
  `;
}

export function buildPDFReadingData(entry) {
  return {
    pdf: entry.pdf,
    summary: entry.summary,
    keyPoints: entry.keyPoints,
    translation: entry.translation,
    citations: entry.citations,
    qa: entry.qa,
    notes: entry.notes,
    metadata: entry.metadata,
    historyId: entry.id,
    source: 'pdf',
    // Aggiungi campi necessari per il reading mode
    isPDF: true,
    extractedText: entry.pdf.text,
    pageCount: entry.pdf.pages,
    filename: entry.pdf.name,
    apiProvider: entry.metadata.provider,
  };
}

export function isValidMultiAnalysisEntry(entry) {
  return !!(entry.analysis && entry.articles);
}
