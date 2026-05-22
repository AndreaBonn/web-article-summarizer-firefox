import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@utils/core/logger.js', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const store = {};
global.browser = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        const result = {};
        for (const key of keys) {
          if (store[key] !== undefined) result[key] = JSON.parse(JSON.stringify(store[key]));
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((data) => {
        for (const [key, value] of Object.entries(data)) {
          store[key] = JSON.parse(JSON.stringify(value));
        }
        return Promise.resolve();
      }),
      remove: vi.fn((keys) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach((k) => delete store[k]);
        return Promise.resolve();
      }),
    },
  },
};

import { PDFHistory } from '@utils/storage/pdf-history.js';

const mockPdfInfo = {
  name: 'test.pdf',
  size: 102400,
  pages: 5,
  text: 'Sample PDF text content',
  metadata: { author: 'Test Author' },
};

const mockMetadata = {
  provider: 'groq',
  language: 'it',
  summaryLength: 'medium',
  fromCache: false,
};

describe('PDFHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
  });

  describe('savePDFAnalysis', () => {
    it('test_savePDFAnalysis_validInput_returnsId', async () => {
      // Act
      const id = await PDFHistory.savePDFAnalysis(
        mockPdfInfo,
        'Summary text',
        [{ title: 'Point 1', description: 'Desc 1', paragraphs: '1' }],
        mockMetadata,
      );

      // Assert
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('test_savePDFAnalysis_persistsCorrectStructure', async () => {
      // Act
      const id = await PDFHistory.savePDFAnalysis(mockPdfInfo, 'My Summary', [], mockMetadata);

      // Assert
      const history = await PDFHistory.getPDFHistory();
      expect(history).toHaveLength(1);
      const entry = history[0];
      expect(entry.id).toBe(id);
      expect(entry.pdf.name).toBe('test.pdf');
      expect(entry.pdf.size).toBe(102400);
      expect(entry.pdf.pages).toBe(5);
      expect(entry.summary).toBe('My Summary');
      expect(entry.metadata.provider).toBe('groq');
    });

    it('test_savePDFAnalysis_defaultsFromCache_falseWhenNotProvided', async () => {
      // Arrange
      const metaWithoutCache = { provider: 'openai', language: 'en', summaryLength: 'short' };

      // Act
      await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Summary', [], metaWithoutCache);

      // Assert
      const [entry] = await PDFHistory.getPDFHistory();
      expect(entry.metadata.fromCache).toBe(false);
    });

    it('test_savePDFAnalysis_withFromCache_true_persists', async () => {
      // Arrange
      const metaWithCache = { ...mockMetadata, fromCache: true };

      // Act
      await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Summary', [], metaWithCache);

      // Assert
      const [entry] = await PDFHistory.getPDFHistory();
      expect(entry.metadata.fromCache).toBe(true);
    });

    it('test_savePDFAnalysis_initialFieldsAreNull', async () => {
      // Act
      await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Summary', [], mockMetadata);

      // Assert
      const [entry] = await PDFHistory.getPDFHistory();
      expect(entry.translation).toBeNull();
      expect(entry.qa).toBeNull();
      expect(entry.citations).toBeNull();
      expect(entry.notes).toBeNull();
    });

    it('test_savePDFAnalysis_pdfMetadata_defaultsToEmptyObj_whenUndefined', async () => {
      // Arrange
      const pdfWithoutMeta = { ...mockPdfInfo, metadata: undefined };

      // Act
      await PDFHistory.savePDFAnalysis(pdfWithoutMeta, 'Summary', [], mockMetadata);

      // Assert
      const [entry] = await PDFHistory.getPDFHistory();
      expect(entry.pdf.metadata).toEqual({});
    });
  });

  describe('getPDFHistory', () => {
    it('test_getPDFHistory_empty_returnsEmptyArray', async () => {
      // Act
      const history = await PDFHistory.getPDFHistory();

      // Assert
      expect(history).toEqual([]);
    });

    it('test_getPDFHistory_multipleEntries_returnsAll', async () => {
      // Arrange
      await PDFHistory.savePDFAnalysis({ ...mockPdfInfo, name: 'a.pdf' }, 'S1', [], mockMetadata);
      await PDFHistory.savePDFAnalysis({ ...mockPdfInfo, name: 'b.pdf' }, 'S2', [], mockMetadata);

      // Act
      const history = await PDFHistory.getPDFHistory();

      // Assert
      expect(history).toHaveLength(2);
    });
  });

  describe('getPDFById', () => {
    it('test_getPDFById_existingId_returnsEntry', async () => {
      // Arrange
      const id = await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Find me', [], mockMetadata);

      // Act
      const entry = await PDFHistory.getPDFById(id);

      // Assert
      expect(entry).toBeDefined();
      expect(entry.id).toBe(id);
      expect(entry.summary).toBe('Find me');
    });

    it('test_getPDFById_nonExistentId_returnsUndefined', async () => {
      // Act
      const entry = await PDFHistory.getPDFById('non-existent-id');

      // Assert
      expect(entry).toBeUndefined();
    });
  });

  describe('deletePDF', () => {
    it('test_deletePDF_existingEntry_removesIt', async () => {
      // Arrange
      const id = await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Delete me', [], mockMetadata);

      // Act
      await PDFHistory.deletePDF(id);

      // Assert
      const entry = await PDFHistory.getPDFById(id);
      expect(entry).toBeUndefined();
    });

    it('test_deletePDF_nonExistentId_doesNotThrow', async () => {
      // Act & Assert
      await expect(PDFHistory.deletePDF('ghost-id')).resolves.not.toThrow();
    });
  });

  describe('togglePDFFavorite', () => {
    it('test_togglePDFFavorite_togglesFromFalseToTrue', async () => {
      // Arrange
      const id = await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Summary', [], mockMetadata);

      // Act
      const result = await PDFHistory.togglePDFFavorite(id);

      // Assert
      expect(result).toBe(true);
      const entry = await PDFHistory.getPDFById(id);
      expect(entry.favorite).toBe(true);
    });

    it('test_togglePDFFavorite_togglesFromTrueToFalse', async () => {
      // Arrange
      const id = await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Summary', [], mockMetadata);
      await PDFHistory.togglePDFFavorite(id); // → true

      // Act
      const result = await PDFHistory.togglePDFFavorite(id); // → false

      // Assert
      expect(result).toBe(false);
    });

    it('test_togglePDFFavorite_nonExistentId_returnsFalse', async () => {
      // Act
      const result = await PDFHistory.togglePDFFavorite('does-not-exist');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('clearPDFHistory', () => {
    it('test_clearPDFHistory_noFavorites_removesAll', async () => {
      // Arrange
      await PDFHistory.savePDFAnalysis(mockPdfInfo, 'S1', [], mockMetadata);
      await PDFHistory.savePDFAnalysis(mockPdfInfo, 'S2', [], mockMetadata);

      // Act
      await PDFHistory.clearPDFHistory();

      // Assert
      const history = await PDFHistory.getPDFHistory();
      expect(history).toHaveLength(0);
    });

    it('test_clearPDFHistory_preservesFavorites', async () => {
      // Arrange
      const id1 = await PDFHistory.savePDFAnalysis(mockPdfInfo, 'S1', [], mockMetadata);
      await PDFHistory.savePDFAnalysis(mockPdfInfo, 'S2', [], mockMetadata);
      await PDFHistory.togglePDFFavorite(id1); // favorita

      // Act
      await PDFHistory.clearPDFHistory();

      // Assert
      const history = await PDFHistory.getPDFHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(id1);
    });
  });

  describe('updatePDFWithTranslation', () => {
    it('test_updatePDFWithTranslation_setsTranslationField', async () => {
      // Arrange
      const id = await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Summary', [], mockMetadata);

      // Act
      await PDFHistory.updatePDFWithTranslation(id, 'Translated text', 'en', 'it');

      // Assert
      const entry = await PDFHistory.getPDFById(id);
      expect(entry.translation).toBeDefined();
      expect(entry.translation.text).toBe('Translated text');
      expect(entry.translation.targetLanguage).toBe('en');
      expect(entry.translation.originalLanguage).toBe('it');
      expect(entry.translation.timestamp).toBeGreaterThan(0);
    });
  });

  describe('updatePDFWithQA', () => {
    it('test_updatePDFWithQA_setsQAField', async () => {
      // Arrange
      const id = await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Summary', [], mockMetadata);
      const qaList = [{ question: 'What?', answer: 'This.' }];

      // Act
      await PDFHistory.updatePDFWithQA(id, qaList);

      // Assert
      const entry = await PDFHistory.getPDFById(id);
      expect(entry.qa).toEqual(qaList);
    });
  });

  describe('updatePDFWithCitations', () => {
    it('test_updatePDFWithCitations_setsCitationsField', async () => {
      // Arrange
      const id = await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Summary', [], mockMetadata);
      const citations = { citations: [{ id: 1, author: 'Author' }], total_citations: 1 };

      // Act
      await PDFHistory.updatePDFWithCitations(id, citations);

      // Assert
      const entry = await PDFHistory.getPDFById(id);
      expect(entry.citations).toEqual(citations);
    });
  });

  describe('updatePDFNotes', () => {
    it('test_updatePDFNotes_setsNotesField', async () => {
      // Arrange
      const id = await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Summary', [], mockMetadata);

      // Act
      await PDFHistory.updatePDFNotes(id, 'My personal notes');

      // Assert
      const entry = await PDFHistory.getPDFById(id);
      expect(entry.notes).toBe('My personal notes');
    });
  });

  describe('searchPDFHistory', () => {
    it('test_searchPDFHistory_matchesByPDFName', async () => {
      // Arrange
      await PDFHistory.savePDFAnalysis(
        { ...mockPdfInfo, name: 'annual-report.pdf' },
        'Summary',
        [],
        mockMetadata,
      );
      await PDFHistory.savePDFAnalysis(
        { ...mockPdfInfo, name: 'budget.pdf' },
        'Summary',
        [],
        mockMetadata,
      );

      // Act
      const results = await PDFHistory.searchPDFHistory('annual');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].pdf.name).toBe('annual-report.pdf');
    });

    it('test_searchPDFHistory_matchesBySummaryText', async () => {
      // Arrange
      await PDFHistory.savePDFAnalysis(
        mockPdfInfo,
        'This is about quantum computing',
        [],
        mockMetadata,
      );
      await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Classic algorithms', [], mockMetadata);

      // Act
      const results = await PDFHistory.searchPDFHistory('quantum');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].summary).toContain('quantum');
    });

    it('test_searchPDFHistory_matchesByKeyPointTitle', async () => {
      // Arrange
      const keyPoints = [
        { title: 'Machine Learning Basics', description: 'Desc', paragraphs: '1' },
      ];
      await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Summary', keyPoints, mockMetadata);

      // Act
      const results = await PDFHistory.searchPDFHistory('machine learning');

      // Assert
      expect(results).toHaveLength(1);
    });

    it('test_searchPDFHistory_matchesByKeyPointDescription', async () => {
      // Arrange
      const keyPoints = [{ title: 'Point', description: 'Uses neural networks', paragraphs: '2' }];
      await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Summary', keyPoints, mockMetadata);

      // Act
      const results = await PDFHistory.searchPDFHistory('neural networks');

      // Assert
      expect(results).toHaveLength(1);
    });

    it('test_searchPDFHistory_matchesByNotes', async () => {
      // Arrange
      const id = await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Summary', [], mockMetadata);
      await PDFHistory.updatePDFNotes(id, 'Important reference for project X');

      // Act
      const results = await PDFHistory.searchPDFHistory('project X');

      // Assert
      expect(results).toHaveLength(1);
    });

    it('test_searchPDFHistory_noMatch_returnsEmpty', async () => {
      // Arrange
      await PDFHistory.savePDFAnalysis(mockPdfInfo, 'Unrelated content', [], mockMetadata);

      // Act
      const results = await PDFHistory.searchPDFHistory('zyxwvutsrqpon');

      // Assert
      expect(results).toHaveLength(0);
    });

    it('test_searchPDFHistory_caseInsensitive', async () => {
      // Arrange
      await PDFHistory.savePDFAnalysis(
        { ...mockPdfInfo, name: 'ReportAnnuale.pdf' },
        'Summary',
        [],
        mockMetadata,
      );

      // Act
      const results = await PDFHistory.searchPDFHistory('REPORTANNUALE');

      // Assert
      expect(results).toHaveLength(1);
    });

    it('test_searchPDFHistory_emptyHistory_returnsEmpty', async () => {
      // Act
      const results = await PDFHistory.searchPDFHistory('anything');

      // Assert
      expect(results).toHaveLength(0);
    });
  });
});
