// Multi-Analysis - Article Selection Module
// Handles: article loading, display, selection, filtering

import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { getProviderLabel } from '../../utils/core/display-labels.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { state } from './state.js';
import { matchesArticleFilter, toggleSelection } from './analysis-model.js';

const MIN_ARTICLES = 2;

export async function loadArticles() {
  state.allArticles = await HistoryManager.getHistory();
  displayArticles(state.allArticles);
  updateSelectionCount();
}

export function displayArticles(articles) {
  const listEl = document.getElementById('articlesList');

  if (articles.length === 0) {
    listEl.innerHTML = `<p class="multi-empty-message">${HtmlSanitizer.escape(I18n.t('multi.noArticles'))}</p>`;
    return;
  }

  listEl.innerHTML = articles
    .map(
      (article) => `
    <div class="article-item" data-id="${HtmlSanitizer.escape(article.id)}">
      <input type="checkbox" class="article-checkbox" data-id="${HtmlSanitizer.escape(article.id)}" aria-label="${HtmlSanitizer.escape(article.article.title)}" />
      <div class="article-info">
        <div class="article-title">${HtmlSanitizer.escape(article.article.title)}</div>
        <div class="article-meta">
          <span class="meta-badge provider">${HtmlSanitizer.escape(getProviderLabel(article.metadata.provider))}</span>
          <span class="meta-badge date">${HistoryManager.formatDate(article.timestamp)}</span>
          <span class="meta-badge words">${Number(article.article.wordCount) || 0} ${HtmlSanitizer.escape(I18n.t('article.words'))}</span>
        </div>
      </div>
    </div>
  `,
    )
    .join('');

  document.querySelectorAll('.article-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', handleSelection);
  });

  document.querySelectorAll('.article-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('article-checkbox')) return;
      const checkbox = item.querySelector('.article-checkbox');
      checkbox.checked = !checkbox.checked;
      handleSelection({ target: checkbox });
    });
  });
}

function handleSelection(e) {
  const id = e.target.dataset.id;
  const item = document.querySelector(`.article-item[data-id="${id}"]`);

  state.selectedArticles = toggleSelection(state.selectedArticles, id, e.target.checked);
  if (e.target.checked) {
    item.classList.add('selected');
  } else {
    item.classList.remove('selected');
  }

  updateSelectionCount();
}

export function updateSelectionCount() {
  const countNumber = document.getElementById('selectionCountNumber');
  if (countNumber) {
    countNumber.textContent = state.selectedArticles.length;
  } else {
    document.getElementById('selectionCount').textContent =
      `${state.selectedArticles.length} ${I18n.t('multi.selected')}`;
  }
  const count = state.selectedArticles.length;
  document.getElementById('startAnalysisBtn').disabled = count < MIN_ARTICLES;
  // Say why the button is disabled instead of leaving it grey and silent
  const hint = document.getElementById('startHint');
  if (hint) {
    hint.textContent = I18n.tf('multi.startHint', { count, min: MIN_ARTICLES });
    hint.classList.toggle('hidden', count >= MIN_ARTICLES);
  }
}

export function selectAll() {
  const visibleCheckboxes = document.querySelectorAll(
    '.article-item:not([style*="display: none"]) .article-checkbox',
  );
  visibleCheckboxes.forEach((checkbox) => {
    checkbox.checked = true;
    const id = checkbox.dataset.id;
    if (!state.selectedArticles.includes(id)) {
      state.selectedArticles.push(id);
      document.querySelector(`.article-item[data-id="${id}"]`).classList.add('selected');
    }
  });
  updateSelectionCount();
}

export function clearSelection() {
  document.querySelectorAll('.article-checkbox').forEach((checkbox) => {
    checkbox.checked = false;
  });
  document.querySelectorAll('.article-item').forEach((item) => {
    item.classList.remove('selected');
  });
  state.selectedArticles = [];
  updateSelectionCount();
}

export function filterArticles() {
  const searchQuery = document.getElementById('searchArticles').value.toLowerCase();
  const providerFilter = document.getElementById('filterProvider').value;

  const filtered = state.allArticles.filter((article) =>
    matchesArticleFilter(article, searchQuery, providerFilter),
  );

  displayArticles(filtered);

  state.selectedArticles.forEach((id) => {
    const checkbox = document.querySelector(`.article-checkbox[data-id="${id}"]`);
    if (checkbox) {
      checkbox.checked = true;
      document.querySelector(`.article-item[data-id="${id}"]`).classList.add('selected');
    }
  });
}
