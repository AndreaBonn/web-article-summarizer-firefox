/** Resolve selected entries in selection order, including missing entries.
 * @param {string[]} selectedIds
 * @param {object[]} allArticles
 * @returns {object[]}
 */
export function resolveSelectedArticles(selectedIds, allArticles) {
  return selectedIds.map((id) => allArticles.find((a) => a.id === id));
}

/** Apply the user's choice without mutating the supplied options.
 * @param {object} options
 * @param {string} choice
 * @returns {object|null}
 */
export function applyUnrelatedChoice(options, choice) {
  if (choice === 'cancel') return null;
  const result = { ...options };
  if (choice === 'qaOnly') {
    result.globalSummary = false;
    result.comparison = false;
    result.qa = true;
  }
  return result;
}

/** Check whether at least one analysis option is enabled.
 * @param {object} options
 * @returns {boolean}
 */
export function hasAnyAnalysisOption(options) {
  return !!(options.globalSummary || options.comparison || options.qa);
}

/** Match the normalized search query and optional provider.
 * @param {object} article
 * @param {string} query
 * @param {string} provider
 * @returns {boolean}
 */
export function matchesArticleFilter(article, query, provider) {
  const matchesSearch =
    !query ||
    article.article.title.toLowerCase().includes(query) ||
    article.article.url.toLowerCase().includes(query);
  const matchesProvider = !provider || article.metadata.provider === provider;
  return matchesSearch && matchesProvider;
}

/** Return the selection after a checkbox change, preserving insertion order.
 * @param {string[]} selected
 * @param {string} id
 * @param {boolean} checked
 * @returns {string[]}
 */
export function toggleSelection(selected, id, checked) {
  if (checked) return [...selected, id];
  return selected.filter((artId) => artId !== id);
}

/** Reconstruct the page data for a saved analysis.
 * @param {object} data
 * @param {number} now
 * @returns {{currentAnalysis: object, selectedArticles: string[], allArticles: object[]}}
 */
export function buildReopenedAnalysis(data, now) {
  const currentAnalysis = {
    id: data.id,
    timestamp: data.timestamp ?? now,
    globalSummary: data.analysis.globalSummary,
    comparison: data.analysis.comparison,
    qa: data.analysis.qa,
    metadata: {
      provider: data.analysis.metadata?.provider || 'unknown',
    },
  };

  const selectedArticles = data.articles.map((a) => a.id);
  const allArticles = data.articles.map((a) => ({
    id: a.id,
    article: {
      title: a.title,
      url: a.url,
      wordCount: a.wordCount,
    },
  }));
  return { currentAnalysis, selectedArticles, allArticles };
}
