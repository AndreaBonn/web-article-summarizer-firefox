// History Manager — Facade retrocompatibile che delega ai repository di dominio
import { BaseHistoryRepository } from './base-history-repository.js';
import { ArticleHistory } from './article-history.js';
import { PDFHistory } from './pdf-history.js';
import { MultiAnalysisHistory } from './multi-analysis-history.js';

export class HistoryManager {
  // ===== UTILITY =====

  static formatDate(timestamp) {
    return BaseHistoryRepository.formatDate(timestamp);
  }

  static formatFileSize(bytes) {
    return BaseHistoryRepository.formatFileSize(bytes);
  }

  // ===== SUMMARY (singoli articoli) =====

  static async saveSummary(article, summary, keyPoints, metadata) {
    return ArticleHistory.saveSummary(article, summary, keyPoints, metadata);
  }

  static async importSummary(backupEntry) {
    return ArticleHistory.importSummary(backupEntry);
  }

  static async getHistory() {
    return ArticleHistory.getHistory();
  }

  static async getSummaryById(id) {
    return ArticleHistory.getSummaryById(id);
  }

  static async deleteSummary(id) {
    return ArticleHistory.deleteSummary(id);
  }

  static async toggleFavorite(entryId) {
    return ArticleHistory.toggleFavorite(entryId);
  }

  static async clearHistory() {
    return ArticleHistory.clearHistory();
  }

  static async updateSummaryWithTranslation(
    articleUrl,
    translation,
    targetLanguage,
    originalLanguage,
  ) {
    return ArticleHistory.updateSummaryWithTranslation(
      articleUrl,
      translation,
      targetLanguage,
      originalLanguage,
    );
  }

  static async updateSummaryWithQA(articleUrl, qaList) {
    return ArticleHistory.updateSummaryWithQA(articleUrl, qaList);
  }

  static async updateSummaryNotes(entryId, notes) {
    return ArticleHistory.updateSummaryNotes(entryId, notes);
  }

  static async updateSummaryWithCitations(articleUrl, citations) {
    return ArticleHistory.updateSummaryWithCitations(articleUrl, citations);
  }

  static async searchHistory(query, options = {}) {
    return ArticleHistory.searchHistory(query, options);
  }

  static async filterHistory(filters) {
    return ArticleHistory.filterHistory(filters);
  }

  // ===== MULTI-ANALYSIS =====

  static async saveMultiAnalysis(analysis, articles) {
    return MultiAnalysisHistory.saveMultiAnalysis(analysis, articles);
  }

  static async importMultiAnalysis(backupEntry) {
    return MultiAnalysisHistory.importMultiAnalysis(backupEntry);
  }

  static async getMultiAnalysisHistory() {
    return MultiAnalysisHistory.getMultiAnalysisHistory();
  }

  static async getMultiAnalysisById(id) {
    return MultiAnalysisHistory.getMultiAnalysisById(id);
  }

  static async deleteMultiAnalysis(id) {
    return MultiAnalysisHistory.deleteMultiAnalysis(id);
  }

  static async toggleMultiAnalysisFavorite(analysisId) {
    return MultiAnalysisHistory.toggleMultiAnalysisFavorite(analysisId);
  }

  static async clearMultiAnalysisHistory() {
    return MultiAnalysisHistory.clearMultiAnalysisHistory();
  }

  static async updateMultiAnalysisWithQA(analysisId, question, answer) {
    return MultiAnalysisHistory.updateMultiAnalysisWithQA(analysisId, question, answer);
  }

  // ===== PDF =====

  static async savePDFAnalysis(pdfInfo, summary, keyPoints, metadata) {
    return PDFHistory.savePDFAnalysis(pdfInfo, summary, keyPoints, metadata);
  }

  static async getPDFHistory() {
    return PDFHistory.getPDFHistory();
  }

  static async getPDFById(id) {
    return PDFHistory.getPDFById(id);
  }

  static async deletePDF(id) {
    return PDFHistory.deletePDF(id);
  }

  static async togglePDFFavorite(pdfId) {
    return PDFHistory.togglePDFFavorite(pdfId);
  }

  static async clearPDFHistory() {
    return PDFHistory.clearPDFHistory();
  }

  static async updatePDFWithTranslation(pdfId, translation, targetLanguage, originalLanguage) {
    return PDFHistory.updatePDFWithTranslation(
      pdfId,
      translation,
      targetLanguage,
      originalLanguage,
    );
  }

  static async updatePDFWithQA(pdfId, qaList) {
    return PDFHistory.updatePDFWithQA(pdfId, qaList);
  }

  static async updatePDFWithCitations(pdfId, citations) {
    return PDFHistory.updatePDFWithCitations(pdfId, citations);
  }

  static async updatePDFNotes(pdfId, notes) {
    return PDFHistory.updatePDFNotes(pdfId, notes);
  }

  static async searchPDFHistory(query) {
    return PDFHistory.searchPDFHistory(query);
  }
}
