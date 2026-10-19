import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { state, elements } from '../../src/pages/reading-mode/state.js';
import { translateArticle, updateDataInStorage } from '../../src/pages/reading-mode/features.js';
import { HistoryManager } from '../../src/utils/storage/history-manager.js';

vi.mock('../../src/utils/storage/history-manager.js', () => ({
  HistoryManager: {
    updatePDFWithTranslation: vi.fn(),
    updatePDFWithQA: vi.fn(),
    updatePDFWithCitations: vi.fn(),
  },
}));
vi.mock('../../src/utils/storage/storage-manager.js', () => ({
  StorageManager: { getSettings: vi.fn().mockResolvedValue({ selectedProvider: 'groq' }) },
}));
vi.mock('../../src/utils/core/modal.js', () => ({
  Modal: { error: vi.fn(), warning: vi.fn() },
}));

const HISTORY_ID = 'pdf-history-uuid';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  state.currentData = null;
  document.body.innerHTML = '';
});

describe('updateDataInStorage (PDF)', () => {
  it('test_updateDataInStorage_pdfWithHistoryId_savesTranslationQaAndCitationsToPdfHistory', async () => {
    state.currentData = {
      isPDF: true,
      historyId: HISTORY_ID,
      metadata: { language: 'en' },
      translation: 'Hello',
      qa: [{ question: 'q', answer: 'a' }],
      citations: { citations: [] },
    };

    await updateDataInStorage();

    expect(HistoryManager.updatePDFWithTranslation).toHaveBeenCalledExactlyOnceWith(
      HISTORY_ID,
      'Hello',
      'en',
      null,
    );
    expect(HistoryManager.updatePDFWithQA).toHaveBeenCalledExactlyOnceWith(HISTORY_ID, [
      { question: 'q', answer: 'a' },
    ]);
    expect(HistoryManager.updatePDFWithCitations).toHaveBeenCalledExactlyOnceWith(HISTORY_ID, {
      citations: [],
    });
  });

  it('test_updateDataInStorage_pdfWithLegacyId_stillSaves', async () => {
    state.currentData = { isPDF: true, id: HISTORY_ID, translation: 'Ciao' };

    await updateDataInStorage();

    expect(HistoryManager.updatePDFWithTranslation).toHaveBeenCalledWith(
      HISTORY_ID,
      'Ciao',
      'it',
      null,
    );
  });

  it('test_updateDataInStorage_pdfWithoutAnyId_savesNothing', async () => {
    state.currentData = { isPDF: true, translation: 'Ciao' };

    await updateDataInStorage();

    expect(HistoryManager.updatePDFWithTranslation).not.toHaveBeenCalled();
  });
});

describe('translateArticle (PDF, forced translation)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="tab"></div><button id="btn"></button>';
    elements.translationTabContent = document.getElementById('tab');
    elements.translateBtn = document.getElementById('btn');
  });

  it('test_translateArticle_forcedTranslationOnNestedPdfText_sendsResolvedText', async () => {
    state.currentData = {
      isPDF: true,
      historyId: HISTORY_ID,
      filename: 'doc.pdf',
      pdf: { text: 'Nested PDF text' },
      metadata: { language: 'it' },
    };
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ success: true, result: { sameLanguage: true } })
      .mockResolvedValueOnce({ success: true, result: { translation: 'Tradotto' } });
    vi.stubGlobal('browser', { runtime: { sendMessage } });

    const pending = translateArticle();
    await vi.waitFor(() => expect(document.getElementById('sameLanguageTranslate')).not.toBeNull());
    document.getElementById('sameLanguageTranslate').click();
    await pending;

    const forced = sendMessage.mock.calls[1][0];
    expect(forced.forceTranslate).toBe(true);
    expect(forced.text).toBe('Nested PDF text');
    expect(state.currentData.translation).toBe('Tradotto');
  });
});
