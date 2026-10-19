import { describe, it, expect, beforeEach } from 'vitest';
import { bindMenuButton } from '@utils/core/menu-button.js';

function setup() {
  document.body.innerHTML = `
    <div class="wrap">
      <button id="btn" aria-expanded="false">Menu</button>
      <div id="menu" class="hidden" role="menu">
        <button id="first" role="menuitem">Uno</button>
        <button id="second" role="menuitem">Due</button>
      </div>
    </div>
    <button id="outside">Fuori</button>`;
  const btn = document.getElementById('btn');
  const menu = document.getElementById('menu');
  bindMenuButton(btn, menu);
  return { btn, menu };
}

describe('bindMenuButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('test_click_opensMenuAndFocusesFirstItem', () => {
    const { btn, menu } = setup();
    btn.click();
    expect(menu.classList.contains('hidden')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement.id).toBe('first');
  });

  it('test_secondClick_closesMenu', () => {
    const { btn, menu } = setup();
    btn.click();
    btn.click();
    expect(menu.classList.contains('hidden')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('test_escape_closesMenuAndReturnsFocus', () => {
    const { btn, menu } = setup();
    btn.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu.classList.contains('hidden')).toBe(true);
    expect(document.activeElement).toBe(btn);
  });

  it('test_clickOutside_closesMenu', () => {
    const { btn, menu } = setup();
    btn.click();
    document.getElementById('outside').click();
    expect(menu.classList.contains('hidden')).toBe(true);
  });

  it('test_menuItemClick_closesMenuAndReturnsFocusToButton', () => {
    const { btn, menu } = setup();
    btn.click();
    document.getElementById('second').click();
    expect(menu.classList.contains('hidden')).toBe(true);
    expect(document.activeElement).toBe(btn);
  });

  it('test_arrowDown_movesFocusToNextItem', () => {
    const { btn, menu } = setup();
    btn.click();
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement.id).toBe('second');
  });
});
