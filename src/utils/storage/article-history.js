// Article History Repository — gestione cronologia articoli riassunti
import { BaseHistoryRepository } from './base-history-repository.js';

const repo = new BaseHistoryRepository('summaryHistory', 50);

export class ArticleHistory {
  static buildEntry(article, summary, keyPoints, metadata) {
    return {
      article: {
        title: article.title,
        url: article.url,
        content: article.content,
        excerpt: article.excerpt,
        wordCount: article.wordCount,
        readingTimeMinutes: article.readingTimeMinutes,
        paragraphs: article.paragraphs,
      },
      summary,
      keyPoints,
      translation: null,
      notes: null,
      metadata: {
        provider: metadata.provider,
        language: metadata.language,
        contentType: metadata.contentType,
        fromCache: metadata.fromCache || false,
      },
    };
  }

  static async saveSummary(article, summary, keyPoints, metadata) {
    return repo.save(ArticleHistory.buildEntry(article, summary, keyPoints, metadata));
  }

  /**
   * Restores an entry from a backup keeping its original id and timestamp, so that
   * importing the same backup again is recognised as a duplicate.
   * @returns {Promise<string|null>} the stored id, or null when the id was already present or the entry was cut by the limit
   */
  static async importSummary(backupEntry) {
    const hasId = typeof backupEntry.id === 'string' && backupEntry.id !== '';

    const entry = {
      ...ArticleHistory.buildEntry(
        backupEntry.article,
        backupEntry.summary,
        backupEntry.keyPoints,
        backupEntry.metadata,
      ),
      id: hasId ? backupEntry.id : crypto.randomUUID(),
      timestamp: Number.isFinite(backupEntry.timestamp) ? backupEntry.timestamp : Date.now(),
      translation: backupEntry.translation ?? null,
      notes: backupEntry.notes ?? null,
      favorite: backupEntry.favorite === true,
    };
    if (backupEntry.qa) entry.qa = backupEntry.qa;
    if (backupEntry.citations) entry.citations = backupEntry.citations;

    return repo.importEntry(entry);
  }

  static async getHistory() {
    return repo.getAll();
  }

  static async getSummaryById(id) {
    return repo.getById(id);
  }

  static async deleteSummary(id) {
    return repo.delete(id);
  }

  static async toggleFavorite(entryId) {
    return repo.toggleFavorite(entryId);
  }

  static async clearHistory() {
    return repo.clear();
  }

  static async updateSummaryWithTranslation(
    articleUrl,
    translation,
    targetLanguage,
    originalLanguage,
  ) {
    return repo.updateByField('article.url', articleUrl, 'translation', {
      text: translation,
      targetLanguage,
      originalLanguage,
      timestamp: Date.now(),
    });
  }

  static async updateSummaryWithQA(articleUrl, qaList) {
    return repo.updateByField('article.url', articleUrl, 'qa', qaList);
  }

  static async updateSummaryNotes(entryId, notes) {
    return repo.updateField(entryId, 'notes', notes);
  }

  static async updateSummaryWithCitations(articleUrl, citations) {
    return repo.updateByField('article.url', articleUrl, 'citations', citations);
  }

  static async searchHistory(query, options = {}) {
    const history = await repo.getAll();
    const lowerQuery = query.toLowerCase();
    const { searchInTitle = true, searchInUrl = true, searchInContent = true } = options;

    return history.filter((entry) => {
      if (searchInTitle && entry.article.title.toLowerCase().includes(lowerQuery)) return true;
      if (searchInUrl && entry.article.url.toLowerCase().includes(lowerQuery)) return true;

      if (searchInContent) {
        if (entry.summary?.toLowerCase().includes(lowerQuery)) return true;
        if (
          entry.keyPoints?.some(
            (p) =>
              p.title?.toLowerCase().includes(lowerQuery) ||
              p.description?.toLowerCase().includes(lowerQuery),
          )
        )
          return true;
        if (entry.notes?.toLowerCase().includes(lowerQuery)) return true;
        if (entry.translation?.text?.toLowerCase().includes(lowerQuery)) return true;
        if (
          entry.qa?.some(
            (qa) =>
              qa.question.toLowerCase().includes(lowerQuery) ||
              qa.answer.toLowerCase().includes(lowerQuery),
          )
        )
          return true;
      }

      return false;
    });
  }

  static async filterHistory(filters) {
    const history = await repo.getAll();

    return history.filter((entry) => {
      if (filters.provider && entry.metadata.provider !== filters.provider) return false;
      if (filters.language && entry.metadata.language !== filters.language) return false;
      if (filters.contentType && entry.metadata.contentType !== filters.contentType) return false;
      if (filters.dateFrom && entry.timestamp < filters.dateFrom) return false;
      if (filters.dateTo && entry.timestamp > filters.dateTo) return false;
      return true;
    });
  }
}
