import { describe, it, expect, beforeEach } from 'vitest';
import {
  FONT_SIZES,
  resolveFontSizeIndex,
  createFontSizeControl,
} from '../../src/shared/font-size-control.js';

describe('resolveFontSizeIndex', () => {
  it.each([
    ['S', 0],
    ['M', 1],
    ['L', 2],
    ['XL', 3],
  ])('maps %s to %i', (saved, index) => {
    expect(resolveFontSizeIndex(saved)).toBe(index);
  });

  it('falls back to M for unknown, empty or null values', () => {
    expect(resolveFontSizeIndex('XXL')).toBe(1);
    expect(resolveFontSizeIndex('')).toBe(1);
    expect(resolveFontSizeIndex(null)).toBe(1);
  });

  it('exposes the four sizes in order', () => {
    expect(FONT_SIZES).toEqual(['S', 'M', 'L', 'XL']);
  });
});

describe('createFontSizeControl', () => {
  let label;
  let decreaseBtn;
  let increaseBtn;
  let control;

  beforeEach(() => {
    localStorage.clear();
    document.body.removeAttribute('data-font-size');
    label = document.createElement('span');
    decreaseBtn = document.createElement('button');
    increaseBtn = document.createElement('button');
    control = createFontSizeControl({
      storageKey: 'testFontSize',
      getLabel: () => label,
      getDecreaseBtn: () => decreaseBtn,
      getIncreaseBtn: () => increaseBtn,
    });
  });

  it('loads M by default and persists it', () => {
    control.load();
    expect(document.body.getAttribute('data-font-size')).toBe('M');
    expect(label.textContent).toBe('M');
    expect(localStorage.getItem('testFontSize')).toBe('M');
    expect(decreaseBtn.disabled).toBe(false);
    expect(increaseBtn.disabled).toBe(false);
  });

  it('loads saved XL and disables increase only', () => {
    localStorage.setItem('testFontSize', 'XL');
    control.load();
    expect(label.textContent).toBe('XL');
    expect(increaseBtn.disabled).toBe(true);
    expect(decreaseBtn.disabled).toBe(false);
  });

  it('loads saved S and disables decrease only', () => {
    localStorage.setItem('testFontSize', 'S');
    control.load();
    expect(decreaseBtn.disabled).toBe(true);
    expect(increaseBtn.disabled).toBe(false);
  });

  it('falls back to M for an unknown saved value', () => {
    localStorage.setItem('testFontSize', 'HUGE');
    control.load();
    expect(document.body.getAttribute('data-font-size')).toBe('M');
  });

  it('increase steps up and stops at XL', () => {
    control.load();
    control.increase();
    expect(label.textContent).toBe('L');
    control.increase();
    expect(label.textContent).toBe('XL');
    control.increase();
    expect(label.textContent).toBe('XL');
    expect(localStorage.getItem('testFontSize')).toBe('XL');
  });

  it('decrease steps down and stops at S', () => {
    control.load();
    control.decrease();
    expect(label.textContent).toBe('S');
    control.decrease();
    expect(label.textContent).toBe('S');
    expect(localStorage.getItem('testFontSize')).toBe('S');
  });

  it('tolerates missing elements', () => {
    const bare = createFontSizeControl({
      storageKey: 'bareKey',
      getLabel: () => null,
      getDecreaseBtn: () => null,
      getIncreaseBtn: () => null,
    });
    bare.load();
    bare.increase();
    expect(document.body.getAttribute('data-font-size')).toBe('L');
  });

  it('calls the getters on every application (late-bound elements)', () => {
    let current = null;
    const late = createFontSizeControl({
      storageKey: 'lateKey',
      getLabel: () => current,
      getDecreaseBtn: () => null,
      getIncreaseBtn: () => null,
    });
    late.load();
    current = document.createElement('span');
    late.increase();
    expect(current.textContent).toBe('L');
  });
});
