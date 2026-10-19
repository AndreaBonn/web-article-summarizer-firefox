import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryLazyLoader } from '@utils/core/history-lazy-loader.js';
import { I18n } from '@utils/i18n/i18n.js';

const ITEM_COUNT = 45;
const PAGE_SIZE = 20;
const SUMMARY_LIMIT = 150;

class FakeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
  }

  intersect(isIntersecting) {
    this.callback([{ isIntersecting }]);
  }
}

function makeEntry(index = 0) {
  return {
    id: `article-${index}`,
    timestamp: 1700000000000,
    article: { title: `Article ${index}`, wordCount: 321 },
    summary: 'A useful document summary.',
    metadata: { provider: 'groq', language: 'it', contentType: 'news' },
    favorite: false,
  };
}

describe('history lazy loading', () => {
  let container;
  let loader;
  let previousLanguage;

  beforeEach(() => {
    previousLanguage = I18n.currentLanguage;
    I18n.currentLanguage = 'it';
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      callback();
      return 1;
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    loader = new HistoryLazyLoader(container);
  });

  afterEach(() => {
    loader.destroy();
    document.body.replaceChildren();
    I18n.currentLanguage = previousLanguage;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders 45 articles over three pages and removes the final sentinel', () => {
    loader.setItems(Array.from({ length: ITEM_COUNT }, (_, index) => makeEntry(index)));
    expect(container.querySelectorAll('.history-item')).toHaveLength(PAGE_SIZE);
    expect(container.querySelectorAll('.lazy-sentinel')).toHaveLength(1);
    expect(loader.getLoadedItems()).toBe(PAGE_SIZE);
    expect(loader.getTotalItems()).toBe(ITEM_COUNT);
    loader.loadNextPage();
    expect(container.querySelectorAll('.history-item')).toHaveLength(40);
    expect(loader.getLoadedItems()).toBe(40);
    expect(container.querySelectorAll('.lazy-sentinel')).toHaveLength(1);
    loader.loadNextPage();
    expect(container.querySelectorAll('.history-item')).toHaveLength(ITEM_COUNT);
    expect(loader.getLoadedItems()).toBe(ITEM_COUNT);
    expect(container.querySelector('.lazy-sentinel')).toBeNull();
    expect(container.lastElementChild.dataset.id).toBe('article-44');
    loader.loadNextPage();
    expect(container.querySelectorAll('.history-item')).toHaveLength(ITEM_COUNT);
  });

  it('loads only when the observer reports an intersection', () => {
    loader.setItems(Array.from({ length: ITEM_COUNT }, (_, index) => makeEntry(index)));
    loader.observer.intersect(false);
    expect(loader.getLoadedItems()).toBe(PAGE_SIZE);
    loader.observer.intersect(true);
    expect(loader.getLoadedItems()).toBe(40);
    expect(container.querySelectorAll('.history-item')).toHaveLength(40);
  });

  it('replaces a completed list and resets counts for an empty list', () => {
    loader.setItems([makeEntry()]);
    expect(container.querySelectorAll('.history-item')).toHaveLength(1);
    loader.setItems([]);
    expect(container.childElementCount).toBe(0);
    expect(loader.getLoadedItems()).toBe(0);
    expect(loader.getTotalItems()).toBe(0);
  });

  it('escapes titles and summaries and renders localized metadata', () => {
    const entry = makeEntry();
    entry.article.title = '<b>Research & results</b>';
    entry.summary = '<i>Important</i>' + 'x'.repeat(SUMMARY_LIMIT);
    loader.setItems([entry]);
    expect(container.querySelector('.history-item-title').textContent).toBe(
      '<b>Research & results</b>',
    );
    expect(container.querySelector('.history-item-title').children).toHaveLength(0);
    expect(container.querySelector('.history-item-preview').textContent).toBe(
      '<i>Important</i>' + 'x'.repeat(134) + '...',
    );
    expect(container.querySelector('.provider').textContent).toBe('Groq');
    expect(container.querySelector('.language').textContent).toBe('Italiano');
    expect(container.querySelector('.type').textContent).toBe('Notizia');
    expect(container.querySelector('.history-item-meta').textContent).toContain('321 parole');
  });

  it('toggles a favorite without opening its article and opens on a title click', async () => {
    loader.onItemClick = vi.fn();
    loader.onFavoriteToggle = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    loader.setItems([makeEntry()]);
    const button = container.querySelector('.btn-favorite');
    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe('★'));
    expect(button.classList.contains('active')).toBe(true);
    expect(button.title).toBe('Rimuovi dai preferiti');
    expect(loader.onFavoriteToggle).toHaveBeenCalledExactlyOnceWith('article-0');
    expect(loader.onItemClick).not.toHaveBeenCalled();
    container.querySelector('.history-item-title').click();
    expect(loader.onItemClick).toHaveBeenCalledExactlyOnceWith('article-0');
    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe('☆'));
    expect(button.classList.contains('active')).toBe(false);
    expect(button.title).toBe('Aggiungi ai preferiti');
  });

  it('renders saved favorites and handles cards without optional callbacks or type', () => {
    const entry = makeEntry();
    entry.favorite = true;
    delete entry.metadata.contentType;
    loader.setItems([entry]);
    container.querySelector('.history-item-title').click();
    container.querySelector('.btn-favorite').click();
    expect(container.querySelector('.btn-favorite').textContent.trim()).toBe('★');
    expect(container.querySelector('.btn-favorite').title).toBe('Rimuovi dai preferiti');
    expect(container.querySelectorAll('.meta-badge')).toHaveLength(3);
  });

  it('displays loading until the frame renders and ignores duplicate page requests', () => {
    let render;
    const frame = vi.fn((callback) => {
      render = callback;
      return 1;
    });
    vi.stubGlobal('requestAnimationFrame', frame);
    loader.setItems([makeEntry()]);
    expect(container.querySelector('.lazy-loading-indicator').textContent).toContain(
      I18n.t('common.loading'),
    );
    loader.loadNextPage();
    loader.observer.intersect(true);
    expect(frame).toHaveBeenCalledTimes(1);
    render();
    expect(container.querySelectorAll('.history-item')).toHaveLength(1);
    expect(container.querySelector('.lazy-loading-indicator')).toBeNull();
    expect(loader.getLoadedItems()).toBe(1);
  });

  it('scrolls to the start and releases observed articles on destruction', () => {
    loader.setItems(Array.from({ length: ITEM_COUNT }, (_, index) => makeEntry(index)));
    expect(container.querySelectorAll('.history-item')).toHaveLength(PAGE_SIZE);
    container.scrollTop = 100;
    loader.scrollToTop();
    expect(container.scrollTop).toBe(0);
    loader.destroy();
    expect(container.childElementCount).toBe(0);
    expect(loader.observer.disconnect).toHaveBeenCalledOnce();
  });
});
