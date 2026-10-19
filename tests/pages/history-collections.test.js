import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/storage/history-manager.js', () => ({
  HistoryManager: {
    getMultiAnalysisHistory: vi.fn(),
    getMultiAnalysisById: vi.fn(),
    formatDate: vi.fn(() => 'today'),
  },
}));
vi.mock('@utils/core/modal.js', () => ({ Modal: { error: vi.fn(), confirm: vi.fn() } }));

import { loadMultiAnalysisHistory } from '@pages/history/collections.js';
import { HistoryManager } from '@utils/storage/history-manager.js';

const PAGE_URL = 'moz-extension://test/src/pages/multi-analysis/multi-analysis.html';

function makeEntry() {
  return {
    id: 'multi-1',
    timestamp: 1,
    articles: [{ id: 'a1', title: 'First', url: 'https://example.com/1', wordCount: 10 }],
    analysis: { globalSummary: 'Summary', comparison: 'Comparison', qa: { questions: [] } },
    metadata: { articlesCount: 1, provider: 'groq' },
  };
}

describe('opening a saved multi-analysis from history', () => {
  let set;
  let navigate;

  beforeEach(() => {
    document.body.innerHTML = '<div id="multiAnalysisList"></div>';
    // Promise-only API, like browser.storage.local in Firefox: a callback is never invoked.
    set = vi.fn().mockResolvedValue(undefined);
    navigate = vi.fn();
    vi.stubGlobal('browser', {
      storage: { local: { set } },
      runtime: { getURL: vi.fn(() => PAGE_URL) },
    });
    vi.stubGlobal('location', {
      set href(value) {
        navigate(value);
      },
    });
    const entry = makeEntry();
    HistoryManager.getMultiAnalysisHistory.mockResolvedValue([entry]);
    HistoryManager.getMultiAnalysisById.mockResolvedValue(entry);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('stores the analysis for reopening, then navigates to the multi-analysis page', async () => {
    await loadMultiAnalysisHistory();

    document.querySelector('.multi-analysis-card').click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith(PAGE_URL));

    expect(set).toHaveBeenCalledExactlyOnceWith({
      reopenMultiAnalysis: {
        id: 'multi-1',
        analysis: makeEntry().analysis,
        articles: makeEntry().articles,
        timestamp: 1,
      },
    });
    expect(set.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
  });
});
