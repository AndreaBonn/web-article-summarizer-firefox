import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildParagraphMap,
  highlightParagraph,
  highlightTextInPage,
} from '../../src/content/page-highlighter.js';

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete Element.prototype.scrollIntoView;
  document.body.innerHTML = '';
});

describe('paragraph highlighting', () => {
  it('maps headings and paragraphs in document order, excluding short and whitespace-only text', () => {
    document.body.innerHTML =
      '<h1>A substantial heading for mapping</h1><p>   </p><p>12345678901234567890</p><div>A long div that is not a paragraph</div><p>  A substantial paragraph for mapping  </p>';
    const map = buildParagraphMap(document);
    expect([...map.keys()]).toEqual([1, 2]);
    expect([...map.values()].map((el) => el.textContent.trim())).toEqual([
      'A substantial heading for mapping',
      'A substantial paragraph for mapping',
    ]);
  });
  it('returns an empty map for an empty document', () => {
    expect([...buildParagraphMap(document)]).toEqual([]);
  });
  it('highlights a range, clears old highlights and removes it after 3000 ms', () => {
    document.body.innerHTML =
      '<p class="ai-summarizer-highlight">Old</p><p>A substantial first paragraph</p><p>A substantial second paragraph</p>';
    const map = buildParagraphMap(document);
    highlightParagraph(map, '1-3', document);
    expect(
      [...document.querySelectorAll('.ai-summarizer-highlight')].map((el) => el.textContent),
    ).toEqual(['A substantial first paragraph', 'A substantial second paragraph']);
    expect(map.get(1).scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    vi.advanceTimersByTime(2999);
    expect(document.querySelectorAll('.ai-summarizer-highlight')).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(document.querySelectorAll('.ai-summarizer-highlight')).toHaveLength(0);
    expect(document.body.textContent).toBe(
      'OldA substantial first paragraphA substantial second paragraph',
    );
  });
  it('selects a single paragraph and ignores an unknown number', () => {
    document.body.innerHTML = '<p>A substantial first paragraph</p>';
    const map = buildParagraphMap(document);
    highlightParagraph(map, 1, document);
    expect(map.get(1).className).toBe('ai-summarizer-highlight');
    highlightParagraph(map, 9, document);
    expect(document.querySelectorAll('.ai-summarizer-highlight')).toHaveLength(0);
    expect(map.get(1).textContent).toBe('A substantial first paragraph');
  });
});

describe('citation highlighting', () => {
  it('wraps a case-insensitive quote and restores the text at 8000 ms', () => {
    document.body.innerHTML = '<p>Before HELLO world after</p>';
    expect(highlightTextInPage(document, 'hello world')).toBe(true);
    expect(document.querySelector('.citation-highlight').textContent).toBe('HELLO world');
    expect(document.querySelector('p').textContent).toBe('Before HELLO world after');
    vi.advanceTimersByTime(7999);
    expect(document.querySelectorAll('.citation-highlight')).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(document.querySelectorAll('.citation-highlight')).toHaveLength(0);
    expect(document.querySelector('p').childNodes).toHaveLength(1);
    expect(document.querySelector('p').textContent).toBe('Before HELLO world after');
  });
  it('wraps a whole text node with no surrounding text', () => {
    document.body.textContent = 'Hello world';
    expect(highlightTextInPage(document, 'Hello world')).toBe(true);
    expect(document.body.firstChild.textContent).toBe('Hello world');
    expect(document.body.firstChild.className).toBe('citation-highlight');
  });
  it('clears previous citation highlights before a new request', () => {
    document.body.innerHTML = '<p>Hello world and another citation</p>';
    expect(highlightTextInPage(document, 'Hello world')).toBe(true);
    expect(document.querySelector('.citation-highlight').textContent).toBe('Hello world');
    expect(highlightTextInPage(document, 'another citation')).toBe(true);
    expect(
      [...document.querySelectorAll('.citation-highlight')].map((el) => el.textContent),
    ).toEqual(['another citation']);
    expect(document.querySelector('p').textContent).toBe('Hello world and another citation');
  });
  it.each([null, '', 'short', 'no matching passage'])(
    'rejects missing, short or absent search %s',
    (search) => {
      document.body.textContent = 'A sufficiently long quotation';
      expect(highlightTextInPage(document, search)).toBe(false);
      expect(highlightTextInPage(document, 'long quotation')).toBe(true);
      expect(document.querySelector('.citation-highlight').textContent).toBe('long quotation');
    },
  );
  it('ignores script and style text while highlighting visible text', () => {
    document.body.innerHTML =
      '<script>Hello world</script><style>Hello world</style><p>Hello world</p>';
    expect(highlightTextInPage(document, 'Hello world')).toBe(true);
    expect(document.querySelectorAll('.citation-highlight')).toHaveLength(1);
    expect(document.querySelector('p .citation-highlight').textContent).toBe('Hello world');
    expect(document.querySelector('script').textContent).toBe('Hello world');
    expect(document.querySelector('style').textContent).toBe('Hello world');
  });
  it('highlights a partial long quote', () => {
    const prefix = 'a'.repeat(150);
    document.body.textContent = 'Before ' + prefix + ' after';
    expect(highlightTextInPage(document, prefix + 'b'.repeat(50))).toBe(true);
    expect(document.querySelector('.citation-highlight').textContent).toBe(prefix);
    expect(document.body.textContent).toBe('Before ' + prefix + ' after');
  });
  it('highlights every keyword-matched node and restores them after eight seconds', () => {
    const search = 'planet galaxy cosmos telescope discovery ' + 'x'.repeat(39);
    document.body.innerHTML =
      '<p>cosmos and galaxy near planet</p><p>planet with cosmos and galaxy</p>';
    expect(highlightTextInPage(document, search)).toBe(true);
    expect(
      [...document.querySelectorAll('.citation-highlight')].map((el) => el.textContent),
    ).toEqual(['cosmos and galaxy near planet', 'planet with cosmos and galaxy']);
    vi.advanceTimersByTime(8000);
    expect(document.querySelectorAll('.citation-highlight')).toHaveLength(0);
    expect([...document.querySelectorAll('p')].map((el) => el.textContent)).toEqual([
      'cosmos and galaxy near planet',
      'planet with cosmos and galaxy',
    ]);
  });
});

describe('citation highlighting with typographic quotes and unlocatable spans', () => {
  it('highlights a curly-quote page passage quoted with straight quotes by the AI', () => {
    document.body.innerHTML = '<p>He said “it’s a long story” to everyone</p>';
    expect(highlightTextInPage(document, '"it\'s a long story"')).toBe(true);
    expect(document.querySelector('.citation-highlight').textContent).toBe('“it’s a long story”');
  });
  it('returns false when a node matches but no span can be created', () => {
    // Whitespace runs collapse in the normalized match but not in the raw locator
    document.body.innerHTML = '<p>some text with hello   world inside it</p>';
    expect(highlightTextInPage(document, 'hello world')).toBe(false);
    expect(document.querySelectorAll('.citation-highlight')).toHaveLength(0);
    expect(document.querySelector('p').textContent).toBe('some text with hello   world inside it');
  });
});
