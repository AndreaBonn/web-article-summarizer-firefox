// PDF History Repository — gestione cronologia analisi PDF
import { BaseHistoryRepository } from './base-history-repository.js';
import { Logger } from '../core/logger.js';

const repo = new BaseHistoryRepository('pdfHistory', 30);

export class PDFHistory {
  static async savePDFAnalysis(pdfInfo, summary, keyPoints, metadata) {
    const entry = {
      pdf: {
        name: pdfInfo.name,
        size: pdfInfo.size,
        pages: pdfInfo.pages,
        text: pdfInfo.text,
        metadata: pdfInfo.metadata || {},
      },
      summary,
      keyPoints,
      translation: null,
      qa: null,
      citations: null,
      notes: null,
      metadata: {
        provider: metadata.provider,
        language: metadata.language,
        summaryLength: metadata.summaryLength,
        fromCache: metadata.fromCache || false,
      },
    };

    const id = await repo.save(entry);
    Logger.info('✓ PDF salvato in cronologia.');
    return id;
  }

  /**
   * Restores a PDF analysis from a backup keeping its original id and timestamp, so that
   * importing the same backup again is recognised as a duplicate.
   * @returns {Promise<string|null>} the stored id, or null when the id was already present or the entry was cut by the limit
   */
  static async importPDFAnalysis(backupEntry) {
    const pdf = backupEntry.pdf && typeof backupEntry.pdf === 'object' ? backupEntry.pdf : {};
    const metadata =
      backupEntry.metadata && typeof backupEntry.metadata === 'object' ? backupEntry.metadata : {};
    const entry = {
      pdf: {
        name: pdf.name,
        size: pdf.size,
        pages: pdf.pages,
        text: pdf.text,
        metadata: pdf.metadata && typeof pdf.metadata === 'object' ? pdf.metadata : {},
      },
      summary: backupEntry.summary,
      keyPoints: backupEntry.keyPoints,
      translation: backupEntry.translation ?? null,
      qa: backupEntry.qa ?? null,
      citations: backupEntry.citations ?? null,
      notes: backupEntry.notes ?? null,
      metadata: {
        provider: metadata.provider,
        language: metadata.language,
        summaryLength: metadata.summaryLength,
        fromCache: metadata.fromCache === true,
      },
      id:
        typeof backupEntry.id === 'string' && backupEntry.id !== ''
          ? backupEntry.id
          : crypto.randomUUID(),
      timestamp: Number.isFinite(backupEntry.timestamp) ? backupEntry.timestamp : Date.now(),
      favorite: backupEntry.favorite === true,
    };
    return repo.importEntry(entry);
  }

  static async getPDFHistory() {
    return repo.getAll();
  }

  static async getPDFById(id) {
    return repo.getById(id);
  }

  static async deletePDF(id) {
    return repo.delete(id);
  }

  static async togglePDFFavorite(pdfId) {
    return repo.toggleFavorite(pdfId);
  }

  static async clearPDFHistory() {
    return repo.clear();
  }

  static async updatePDFWithTranslation(pdfId, translation, targetLanguage, originalLanguage) {
    return repo.updateField(pdfId, 'translation', {
      text: translation,
      targetLanguage,
      originalLanguage,
      timestamp: Date.now(),
    });
  }

  static async updatePDFWithQA(pdfId, qaList) {
    return repo.updateField(pdfId, 'qa', qaList);
  }

  static async updatePDFWithCitations(pdfId, citations) {
    return repo.updateField(pdfId, 'citations', citations);
  }

  static async updatePDFNotes(pdfId, notes) {
    return repo.updateField(pdfId, 'notes', notes);
  }

  static async searchPDFHistory(query) {
    const history = await repo.getAll();
    const lowerQuery = query.toLowerCase();

    return history.filter((entry) => {
      if (entry.pdf.name.toLowerCase().includes(lowerQuery)) return true;
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
      return false;
    });
  }
}
