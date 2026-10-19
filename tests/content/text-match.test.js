import { describe, it, expect } from 'vitest';
import {
  normalizeQuoteText,
  parseParagraphRange,
  isSubstantialParagraph,
  classifyNodeMatch,
  locateHighlightSpan,
} from '../../src/content/text-match.js';

describe('text matching contract', () => {
  it('normalizes case, repeated whitespace and supported quotation marks', () => {
    expect(normalizeQuoteText("  «HELLO»\n\t 'World'  ")).toBe('"hello" "world"');
    expect(normalizeQuoteText('')).toBe('');
  });
  it.each([
    ['3-5', [3, 4, 5]],
    ['5-3', []],
    [7, [7]],
    ['2', [2]],
    ['4-4', [4]],
  ])('parses paragraph %s', (input, expected) => {
    expect([...parseParagraphRange(input)]).toEqual(expected);
  });
  it('yields an absurdly large range lazily instead of allocating it', () => {
    const range = parseParagraphRange('1-99999999999');
    expect(range.next().value).toBe(1);
    expect(range.next().value).toBe(2);
  });
  it('numbers only paragraphs longer than twenty characters', () => {
    expect(isSubstantialParagraph('a'.repeat(21))).toBe(true);
    expect(isSubstantialParagraph('a'.repeat(20))).toBe(false);
    expect(isSubstantialParagraph('short')).toBe(false);
    expect(isSubstantialParagraph('')).toBe(false);
  });
  it('classifies an exact match independent of case and repeated spaces', () => {
    const search = 'HELLO   WORLD';
    expect(
      classifyNodeMatch(
        normalizeQuoteText('Before hello world after'),
        search,
        normalizeQuoteText(search),
      ),
    ).toEqual({ searchText: search, exact: true });
  });
  it('finds the first 150 characters of a 200-character quote', () => {
    const search = 'a'.repeat(150) + 'b'.repeat(50);
    expect(
      classifyNodeMatch('prefix ' + 'a'.repeat(150), search, normalizeQuoteText(search)),
    ).toEqual({ searchText: 'a'.repeat(150), exact: false });
  });
  it('requires three significant keywords for an eighty-character search', () => {
    const search = 'planet galaxy cosmos telescope discovery ' + 'x'.repeat(39);
    expect(search).toHaveLength(80);
    expect(
      classifyNodeMatch('cosmos and galaxy near planet', search, normalizeQuoteText(search)),
    ).toEqual({ searchText: search, exact: false, keywordMatch: true });
    expect(classifyNodeMatch('galaxy near planet', search, normalizeQuoteText(search))).toBeNull();
  });
  it('returns no match for unrelated short text alongside a positive match', () => {
    expect(classifyNodeMatch('unrelated passage', 'hello world', 'hello world')).toBeNull();
    expect(classifyNodeMatch('hello world', 'hello world', 'hello world')).toEqual({
      searchText: 'hello world',
      exact: true,
    });
  });
  it('locates the original casing and surrounding text', () => {
    expect(locateHighlightSpan('Before HELLO world after', 'hello world')).toEqual({
      before: 'Before ',
      match: 'HELLO world',
      after: ' after',
    });
  });
  it('locates a quote covering the whole text and rejects an unrelated one', () => {
    expect(locateHighlightSpan('Hello world', 'hello world')).toEqual({
      before: '',
      match: 'Hello world',
      after: '',
    });
    expect(locateHighlightSpan('Hello world', 'different quote')).toBeNull();
  });
});
