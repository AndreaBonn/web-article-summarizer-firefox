import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openReadingModeFromHistory } from '@pages/history/io.js';
import { state } from '@pages/history/state.js';

vi.mock('@pages/history/io-email.js', () => ({ sendCurrentEmail: vi.fn() }));
vi.mock('@pages/history/io-backup.js', () => ({
  downloadHistory: vi.fn(),
  importHistory: vi.fn(),
}));

const PAGE_PATH = 'src/pages/reading-mode/reading-mode.html';
const PAGE_URL = `moz-extension://test/${PAGE_PATH}`;

function makeEntry() {
  return {
    article: { title: 'Research', content: 'Twelve samples.' },
    summary: 'The research summary.',
    keyPoints: ['Twelve samples'],
  };
}

describe('history reading mode handoff', () => {
  let previousEntry;
  let set;
  let open;

  beforeEach(() => {
    previousEntry = state.currentEntry;
    state.currentEntry = null;
    set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('browser', {
      storage: { local: { set } },
      runtime: { getURL: vi.fn(() => PAGE_URL) },
    });
    open = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    state.currentEntry = previousEntry;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('stores a minimal entry with default metadata and opens the extension page', async () => {
    state.currentEntry = makeEntry();
    await openReadingModeFromHistory();
    expect(set).toHaveBeenCalledExactlyOnceWith({
      readingModeData: {
        article: { title: 'Research', content: 'Twelve samples.' },
        summary: 'The research summary.',
        keyPoints: ['Twelve samples'],
        translation: null,
        citations: null,
        qa: null,
        metadata: {},
      },
    });
    expect(browser.runtime.getURL).toHaveBeenCalledExactlyOnceWith(PAGE_PATH);
    expect(open).toHaveBeenCalledExactlyOnceWith(PAGE_URL, '_blank');
  });

  it('preserves translation, citations, questions and metadata', async () => {
    state.currentEntry = {
      ...makeEntry(),
      translation: { text: 'Dodici campioni.', targetLanguage: 'it' },
      citations: { citations: [], total_citations: 0 },
      qa: [{ question: 'How many?', answer: 'Twelve.' }],
      metadata: { provider: 'groq' },
    };
    await openReadingModeFromHistory();
    expect(set).toHaveBeenCalledExactlyOnceWith({
      readingModeData: {
        article: { title: 'Research', content: 'Twelve samples.' },
        summary: 'The research summary.',
        keyPoints: ['Twelve samples'],
        translation: { text: 'Dodici campioni.', targetLanguage: 'it' },
        citations: { citations: [], total_citations: 0 },
        qa: [{ question: 'How many?', answer: 'Twelve.' }],
        metadata: { provider: 'groq' },
      },
    });
    expect(open).toHaveBeenCalledExactlyOnceWith(PAGE_URL, '_blank');
  });

  it('waits for storage before opening the page', async () => {
    let release;
    set.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    state.currentEntry = makeEntry();
    const pending = openReadingModeFromHistory();
    expect(set).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    release();
    await pending;
    expect(open).toHaveBeenCalledExactlyOnceWith(PAGE_URL, '_blank');
  });

  it('leaves the page closed after storage rejection and opens after recovery', async () => {
    state.currentEntry = makeEntry();
    set.mockRejectedValueOnce(new Error('Storage full'));
    await openReadingModeFromHistory();
    expect(set).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    await openReadingModeFromHistory();
    expect(open).toHaveBeenCalledExactlyOnceWith(PAGE_URL, '_blank');
  });

  it('ignores an absent entry and opens after an entry is selected', async () => {
    await openReadingModeFromHistory();
    expect(open).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    state.currentEntry = makeEntry();
    await openReadingModeFromHistory();
    expect(set).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledExactlyOnceWith(PAGE_URL, '_blank');
  });
});
