import { describe, it, expect } from 'vitest';
import {
  resolveSelectedArticles,
  applyUnrelatedChoice,
  hasAnyAnalysisOption,
  matchesArticleFilter,
  toggleSelection,
  buildReopenedAnalysis,
} from '@pages/multi-analysis/analysis-model.js';

const articles = [
  {
    id: 'a',
    article: { title: 'Energy News', url: 'https://example.org/solar' },
    metadata: { provider: 'groq' },
  },
  {
    id: 'b',
    article: { title: 'Transport', url: 'https://example.org/train' },
    metadata: { provider: 'openai' },
  },
];

describe('multi-analysis model', () => {
  it('test_resolveSelectedArticles_preserves_selection_order_and_missing_entries', () => {
    expect(resolveSelectedArticles(['b', 'a', 'missing'], articles)).toEqual([
      articles[1],
      articles[0],
      undefined,
    ]);
    expect(resolveSelectedArticles([], articles)).toEqual([]);
  });

  it('test_applyUnrelatedChoice_handles_cancel_full_and_qaOnly_without_mutation', () => {
    const options = Object.freeze({ globalSummary: true, comparison: true, qa: false });
    expect(applyUnrelatedChoice(options, 'cancel')).toBe(null);
    expect(applyUnrelatedChoice(options, 'full')).toEqual(options);
    expect(applyUnrelatedChoice(options, 'qaOnly')).toEqual({
      globalSummary: false,
      comparison: false,
      qa: true,
    });
    expect(options).toEqual({ globalSummary: true, comparison: true, qa: false });
  });

  it('test_hasAnyAnalysisOption_accepts_each_option_and_rejects_empty', () => {
    expect(hasAnyAnalysisOption({})).toBe(false);
    expect(hasAnyAnalysisOption({ globalSummary: false, comparison: false, qa: false })).toBe(
      false,
    );
    for (const option of ['globalSummary', 'comparison', 'qa']) {
      expect(hasAnyAnalysisOption({ [option]: true })).toBe(true);
    }
  });

  it('test_matchesArticleFilter_combines_title_url_and_provider', () => {
    expect(matchesArticleFilter(articles[0], '', '')).toBe(true);
    expect(matchesArticleFilter(articles[0], 'energy', 'groq')).toBe(true);
    expect(matchesArticleFilter(articles[0], 'solar', '')).toBe(true);
    expect(matchesArticleFilter(articles[0], 'train', '')).toBe(false);
    expect(matchesArticleFilter(articles[0], 'solar', 'openai')).toBe(false);
  });

  it('test_toggleSelection_returns_new_arrays_without_changing_previous_selection', () => {
    const selected = Object.freeze(['a', 'b']);
    const added = toggleSelection(selected, 'c', true);
    expect(added).toEqual(['a', 'b', 'c']);
    expect(added).not.toBe(selected);
    expect(toggleSelection(selected, 'a', false)).toEqual(['b']);
    expect(toggleSelection([], 'a', true)).toEqual(['a']);
    expect(toggleSelection([], 'a', false)).toEqual([]);
    expect(selected).toEqual(['a', 'b']);
  });

  it('test_buildReopenedAnalysis_maps_saved_data_and_provider_without_mutating_input', () => {
    const data = {
      id: 'saved',
      analysis: {
        globalSummary: 'Overview',
        comparison: 'Differences',
        qa: { interactive: true },
        metadata: { provider: 'groq' },
      },
      articles: [{ id: 'a', title: 'Solar', url: 'https://example.org', wordCount: 42 }],
    };
    const before = structuredClone(data);
    const reopened = buildReopenedAnalysis(data, 123);
    expect(reopened.currentAnalysis.id).toBe('saved');
    expect(reopened.currentAnalysis.globalSummary).toBe('Overview');
    expect(reopened.currentAnalysis.comparison).toBe('Differences');
    expect(reopened.currentAnalysis.qa).toEqual({ interactive: true });
    expect(reopened.currentAnalysis.metadata).toEqual({ provider: 'groq' });
    expect(reopened.selectedArticles).toEqual(['a']);
    expect(reopened.allArticles).toEqual([
      { id: 'a', article: { title: 'Solar', url: 'https://example.org', wordCount: 42 } },
    ]);
    expect(data).toEqual(before);
    const empty = buildReopenedAnalysis({ analysis: {}, articles: [] }, 123);
    expect(empty.currentAnalysis.metadata).toEqual({ provider: 'unknown' });
    expect(empty.selectedArticles).toEqual([]);
    expect(empty.allArticles).toEqual([]);
  });

  it('test_buildReopenedAnalysis_keeps_saved_timestamp_and_falls_back_to_now_when_absent', () => {
    const saved = buildReopenedAnalysis({ timestamp: 1000, analysis: {}, articles: [] }, 123);
    expect(saved.currentAnalysis.timestamp).toBe(1000);
    const legacy = buildReopenedAnalysis({ analysis: {}, articles: [] }, 123);
    expect(legacy.currentAnalysis.timestamp).toBe(123);
  });
});
