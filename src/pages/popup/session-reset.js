// Popup session reset - "new analysis" must not leak the previous article's derived data
import { state, elements, showState } from './state.js';
import { setCurrentTranslation, setCurrentCitations, renderTranslationEmpty } from './features.js';
import { renderCitationsEmpty } from './citations.js';

export function resetArticleSession() {
  state.currentArticle = null;
  state.currentResults = null;
  state.currentQA = [];
  state.selectedContentType = 'auto';
  elements.contentTypeSelect.value = 'auto';

  setCurrentTranslation(null);
  setCurrentCitations(null);
  renderTranslationEmpty();
  renderCitationsEmpty();
  document.querySelectorAll('#citationsTab .cache-badge').forEach((badge) => badge.remove());
  elements.qaAnswer.textContent = '';
  elements.qaAnswer.classList.add('hidden');

  showState('initial');
}
