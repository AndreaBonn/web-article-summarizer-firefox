// History Lazy Loader - Virtual Scrolling per cronologia
// Carica progressivamente gli articoli per migliorare performance
import { HistoryManager } from '../storage/history-manager.js';
import { getProviderLabel, getLanguageLabel, getContentTypeLabel } from './display-labels.js';
import { I18n } from '../i18n/i18n.js';

export class HistoryLazyLoader {
  constructor(container, itemsPerPage = 20) {
    this.container = container;
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 0;
    this.allItems = [];
    this.isLoading = false;
    this.onItemClick = null;
    this.onFavoriteToggle = null;

    this.setupIntersectionObserver();
  }

  /**
   * Setup Intersection Observer per rilevare quando l'utente arriva in fondo
   */
  setupIntersectionObserver() {
    this.sentinel = document.createElement('div');
    this.sentinel.className = 'lazy-sentinel';
    this.sentinel.style.height = '1px';
    this.sentinel.style.visibility = 'hidden';

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.isLoading) {
          this.loadNextPage();
        }
      },
      {
        rootMargin: '200px', // Precarica 200px prima di arrivare in fondo
        threshold: 0.1,
      },
    );
  }

  /**
   * Imposta gli items da visualizzare
   */
  setItems(items) {
    this.allItems = items;
    this.currentPage = 0;
    this.container.innerHTML = '';

    // Rimuovi observer precedente
    if (this.sentinel.parentNode) {
      this.observer.unobserve(this.sentinel);
    }

    this.loadNextPage();
  }

  /**
   * Carica la prossima pagina di items
   */
  loadNextPage() {
    if (this.isLoading) return;

    const start = this.currentPage * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const pageItems = this.allItems.slice(start, end);

    if (pageItems.length === 0) return;

    this.isLoading = true;

    // Mostra loading indicator
    this.showLoadingIndicator();

    // Usa requestAnimationFrame per rendering fluido
    requestAnimationFrame(() => {
      const fragment = document.createDocumentFragment();

      pageItems.forEach((entry) => {
        const item = this.createHistoryItem(entry);
        fragment.appendChild(item);
      });

      this.container.appendChild(fragment);

      // Rimuovi loading indicator
      this.hideLoadingIndicator();

      // Rimuovi vecchio sentinel e aggiungi nuovo
      if (this.sentinel.parentNode) {
        this.sentinel.parentNode.removeChild(this.sentinel);
      }

      // Se ci sono ancora items, aggiungi sentinel
      if (end < this.allItems.length) {
        this.container.appendChild(this.sentinel);
        this.observer.observe(this.sentinel);
      }

      this.currentPage++;
      this.isLoading = false;
    });
  }

  /**
   * Crea un singolo item della cronologia
   */
  createHistoryItem(entry) {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.dataset.id = entry.id;

    div.innerHTML = `
      <div class="history-item-header">
        <div class="history-item-title">${this.escapeHtml(entry.article.title)}</div>
        <div class="history-item-actions">
          <button class="btn-favorite ${entry.favorite ? 'active' : ''}"
                  data-id="${this.escapeHtml(entry.id)}"
                  title="${entry.favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}">
            ${entry.favorite ? '★' : '☆'}
          </button>
          <span class="history-item-date">${HistoryManager.formatDate(entry.timestamp)}</span>
        </div>
      </div>
      <div class="history-item-meta">
        <span class="meta-badge provider">${this.escapeHtml(getProviderLabel(entry.metadata.provider))}</span>
        <span class="meta-badge language">${this.escapeHtml(getLanguageLabel(entry.metadata.language, I18n.currentLanguage))}</span>
        ${entry.metadata.contentType ? `<span class="meta-badge type">${this.escapeHtml(getContentTypeLabel(entry.metadata.contentType, I18n.currentLanguage))}</span>` : ''}
        <span class="meta-badge">${entry.article.wordCount} ${I18n.t('article.words')}</span>
      </div>
      <div class="history-item-preview">${this.escapeHtml(entry.summary.substring(0, 150))}...</div>
    `;

    // Event listener per click sull'item
    div.addEventListener('click', (e) => {
      if (!e.target.closest('.btn-favorite')) {
        if (this.onItemClick) {
          this.onItemClick(entry.id);
        }
      }
    });

    // Event listener per favorite button
    const favoriteBtn = div.querySelector('.btn-favorite');
    favoriteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      if (this.onFavoriteToggle) {
        const isFavorite = await this.onFavoriteToggle(entry.id);
        favoriteBtn.classList.toggle('active', isFavorite);
        favoriteBtn.textContent = isFavorite ? '★' : '☆';
        favoriteBtn.title = isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti';
        entry.favorite = isFavorite;
      }
    });

    return div;
  }

  /**
   * Mostra indicatore di caricamento
   */
  showLoadingIndicator() {
    if (!this.loadingIndicator) {
      this.loadingIndicator = document.createElement('div');
      this.loadingIndicator.className = 'lazy-loading-indicator';
      this.loadingIndicator.innerHTML = `
        <div class="spinner-small"></div>
        <span>${I18n.t('common.loading')}</span>
      `;
    }

    this.container.appendChild(this.loadingIndicator);
  }

  /**
   * Nascondi indicatore di caricamento
   */
  hideLoadingIndicator() {
    if (this.loadingIndicator && this.loadingIndicator.parentNode) {
      this.loadingIndicator.parentNode.removeChild(this.loadingIndicator);
    }
  }

  /**
   * Escape HTML per prevenire XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Distruggi il loader e pulisci risorse
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }

    if (this.sentinel && this.sentinel.parentNode) {
      this.sentinel.parentNode.removeChild(this.sentinel);
    }

    this.container.innerHTML = '';
  }

  /**
   * Scroll to top
   */
  scrollToTop() {
    this.container.scrollTop = 0;
  }

  /**
   * Get total items count
   */
  getTotalItems() {
    return this.allItems.length;
  }

  /**
   * Get loaded items count
   */
  getLoadedItems() {
    return Math.min(this.currentPage * this.itemsPerPage, this.allItems.length);
  }
}
