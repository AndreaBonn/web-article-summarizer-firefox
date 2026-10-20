import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { extractMock } = vi.hoisted(() => ({ extractMock: vi.fn() }));

vi.mock('../../src/utils/core/content-extractor.js', () => ({
  ContentExtractor: { extract: extractMock },
}));

const EXT_ID = 'ext-id';
const P1 = 'First paragraph with enough words to be substantial.';
const P2 = 'Second paragraph that is also long enough to count here.';
const QUOTE = 'quick brown fox jumps over the lazy dog';

let listener;

async function loadListener() {
  const addListener = vi.fn();
  vi.stubGlobal('browser', { runtime: { id: EXT_ID, onMessage: { addListener } } });
  vi.resetModules();
  await import('../../src/content/content-script.js');
  expect(addListener).toHaveBeenCalledTimes(1);
  return addListener.mock.calls[0][0];
}

function send(message, senderId = EXT_ID) {
  const sendResponse = vi.fn();
  const ret = listener(message, { id: senderId }, sendResponse);
  return { sendResponse, ret };
}

beforeEach(async () => {
  vi.useFakeTimers();
  extractMock.mockReset();
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  document.body.innerHTML = `<article><h1>Article headline long enough to count</h1><p>${P1}</p><p>${P2}</p><p>The ${QUOTE} while nobody watches.</p></article>`;
  listener = await loadListener();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete Element.prototype.scrollIntoView;
  document.body.innerHTML = '';
});

describe('sender validation', () => {
  it('rejects messages from a foreign sender without responding and without extracting', () => {
    const { sendResponse, ret } = send({ action: 'extractArticle' }, 'other-ext');
    expect(ret).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
    expect(extractMock).not.toHaveBeenCalled();
  });

  it('rejects a foreign sender on every action', () => {
    for (const action of ['highlightParagraph', 'highlightText', 'getUrl']) {
      const { sendResponse, ret } = send({ action, text: QUOTE, paragraphNumber: 1 }, 'evil');
      expect(ret).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    }
  });

  it('accepts the same action from the own extension', () => {
    extractMock.mockReturnValue({ title: 'T' });
    const { sendResponse } = send({ action: 'extractArticle' });
    expect(sendResponse).toHaveBeenCalledTimes(1);
  });
});

describe('extractArticle', () => {
  it('returns the extracted article synchronously, passing the page document', () => {
    const article = { title: 'T', content: 'C' };
    extractMock.mockReturnValue(article);
    const { sendResponse, ret } = send({ action: 'extractArticle' });
    expect(extractMock).toHaveBeenCalledWith(document);
    expect(sendResponse).toHaveBeenCalledWith({ success: true, article });
    expect(ret).toBe(false);
  });

  it('returns success:false with the error message when extraction throws', () => {
    extractMock.mockImplementation(() => {
      throw new Error('no readable content');
    });
    const { sendResponse } = send({ action: 'extractArticle' });
    expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'no readable content' });
  });

  it('answers success:true with article null when nothing is extracted', () => {
    extractMock.mockReturnValue(null);
    const { sendResponse } = send({ action: 'extractArticle' });
    expect(sendResponse).toHaveBeenCalledWith({ success: true, article: null });
  });
});

describe('highlightParagraph', () => {
  it('highlights the numbered paragraph after extraction built the map', () => {
    extractMock.mockReturnValue({ title: 'T' });
    send({ action: 'extractArticle' });
    const { sendResponse } = send({ action: 'highlightParagraph', paragraphNumber: 2 });
    const highlighted = document.querySelectorAll('.ai-summarizer-highlight');
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].textContent).toBe(P1);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('highlights a range such as "2-3"', () => {
    extractMock.mockReturnValue({ title: 'T' });
    send({ action: 'extractArticle' });
    send({ action: 'highlightParagraph', paragraphNumber: '2-3' });
    const texts = [...document.querySelectorAll('.ai-summarizer-highlight')].map(
      (el) => el.textContent,
    );
    expect(texts).toEqual([P1, P2]);
  });

  it('does not build the paragraph map when extraction returns null', () => {
    extractMock.mockReturnValue(null);
    send({ action: 'extractArticle' });
    const { sendResponse } = send({ action: 'highlightParagraph', paragraphNumber: 1 });
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(document.querySelectorAll('.ai-summarizer-highlight')).toHaveLength(0);
  });

  it('succeeds without highlighting when no article was extracted yet', () => {
    const { sendResponse } = send({ action: 'highlightParagraph', paragraphNumber: 1 });
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(document.querySelectorAll('.ai-summarizer-highlight')).toHaveLength(0);
  });

  it('returns success:false with the message when highlighting throws', () => {
    extractMock.mockReturnValue({ title: 'T' });
    send({ action: 'extractArticle' });
    vi.spyOn(document, 'querySelectorAll').mockImplementation(() => {
      throw new Error('dom exploded');
    });
    const { sendResponse } = send({ action: 'highlightParagraph', paragraphNumber: 1 });
    expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'dom exploded' });
  });
});

describe('highlightText', () => {
  it('answers success:true and marks the quote when it is present in the page', () => {
    const { sendResponse, ret } = send({ action: 'highlightText', text: QUOTE });
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(ret).toBe(false);
    expect(document.querySelector('.citation-highlight').textContent).toBe(QUOTE);
  });

  it('answers success:false when the quote is not in the page', () => {
    const { sendResponse } = send({
      action: 'highlightText',
      text: 'absent sentence about penguins',
    });
    expect(sendResponse).toHaveBeenCalledWith({ success: false });
    expect(document.querySelector('.citation-highlight')).toBeNull();
  });

  it('answers success:false for a quote shorter than 10 characters', () => {
    const { sendResponse } = send({ action: 'highlightText', text: 'fox' });
    expect(sendResponse).toHaveBeenCalledWith({ success: false });
  });

  it('answers success:false with the message when the page walk throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(document, 'createTreeWalker').mockImplementation(() => {
      throw new Error('walker failed');
    });
    const { sendResponse } = send({ action: 'highlightText', text: QUOTE });
    expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'walker failed' });
  });
});

describe('getUrl and unknown actions', () => {
  it('returns the page url', () => {
    const { sendResponse, ret } = send({ action: 'getUrl' });
    expect(sendResponse).toHaveBeenCalledWith({ url: window.location.href });
    expect(ret).toBe(false);
  });

  it('ignores an unknown action: no response, no return value', () => {
    const { sendResponse, ret } = send({ action: 'doSomethingElse' });
    expect(sendResponse).not.toHaveBeenCalled();
    expect(ret).toBeUndefined();
    expect(extractMock).not.toHaveBeenCalled();
  });
});
