// Multi-Analysis History Repository — gestione cronologia analisi multi-articolo
import { BaseHistoryRepository } from './base-history-repository.js';
import { Logger } from '../core/logger.js';

const repo = new BaseHistoryRepository('multiAnalysisHistory', 30);

export class MultiAnalysisHistory {
  // `articles` are flattened summaries: { id, title, url, wordCount }
  static buildEntry(analysis, articles) {
    return {
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        url: a.url,
        wordCount: a.wordCount,
      })),
      analysis: {
        globalSummary: analysis.globalSummary || null,
        comparison: analysis.comparison || null,
        qa: {
          interactive: analysis.qa?.interactive || false,
          articles: analysis.qa?.articles || [],
          questions: analysis.qa?.questions || [],
        },
      },
      metadata: {
        articlesCount: articles.length,
        provider: analysis.metadata?.provider || 'unknown',
      },
    };
  }

  static async saveMultiAnalysis(analysis, articles) {
    Logger.debug('saveMultiAnalysis chiamato con:', { analysis, articles });
    const entry = MultiAnalysisHistory.buildEntry(
      analysis,
      articles.map((a) => ({
        id: a.id,
        title: a.article.title,
        url: a.article.url,
        wordCount: a.article.wordCount,
      })),
    );

    const id = await repo.save(entry);
    Logger.info('✓ Analisi multi-articolo salvata.');
    return id;
  }

  /**
   * Restores an analysis from a backup keeping its original id and timestamp, so that
   * importing the same backup again is recognised as a duplicate.
   * @returns {Promise<string|null>} the stored id, or null when already present or cut by the limit
   */
  static async importMultiAnalysis(backupEntry) {
    const entry = {
      ...MultiAnalysisHistory.buildEntry(
        { ...backupEntry.analysis, metadata: backupEntry.metadata },
        Array.isArray(backupEntry.articles) ? backupEntry.articles : [],
      ),
      id:
        typeof backupEntry.id === 'string' && backupEntry.id !== ''
          ? backupEntry.id
          : crypto.randomUUID(),
      timestamp: Number.isFinite(backupEntry.timestamp) ? backupEntry.timestamp : Date.now(),
      favorite: backupEntry.favorite === true,
    };
    return repo.importEntry(entry);
  }

  static async getMultiAnalysisHistory() {
    return repo.getAll();
  }

  static async getMultiAnalysisById(id) {
    return repo.getById(id);
  }

  static async deleteMultiAnalysis(id) {
    return repo.delete(id);
  }

  static async toggleMultiAnalysisFavorite(analysisId) {
    return repo.toggleFavorite(analysisId);
  }

  static async clearMultiAnalysisHistory() {
    return repo.clear();
  }

  static async updateMultiAnalysisWithQA(analysisId, question, answer) {
    const history = await repo.getAll();
    const entry = history.find((e) => e.id === analysisId);

    if (entry) {
      if (!entry.analysis.qa.questions) {
        entry.analysis.qa.questions = [];
      }
      entry.analysis.qa.questions.push({ question, answer, timestamp: Date.now() });
      await repo._saveAll(history);
    }
  }
}
