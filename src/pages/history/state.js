// History shared state — imported by all history modules

export const state = {
  currentHistory: [],
  currentEntry: null,
  voiceController: null,
  lazyLoader: null,
  searchOptimizer: null,
  debouncedSearch: null,
  // Callbacks impostati da history.js per evitare circular imports
  loadHistory: null,
  loadMultiAnalysisHistory: null,
  loadPDFHistory: null,
};
