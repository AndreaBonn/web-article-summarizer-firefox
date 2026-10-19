// Menu button — a button that opens a small list of actions (export, manage...).
// Closes on Escape, outside click or after choosing an item; arrows move between items.

export function bindMenuButton(button, menu) {
  const items = () => [...menu.querySelectorAll('[role="menuitem"]:not(.hidden)')];

  const close = (returnFocus = false) => {
    if (menu.classList.contains('hidden')) return;
    menu.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
    if (returnFocus) button.focus();
  };

  const open = () => {
    menu.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
    items()[0]?.focus();
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (menu.classList.contains('hidden')) open();
    else close();
  });

  // Back to the button after choosing, so keyboard users keep their place
  menu.addEventListener('click', (event) => {
    if (event.target.closest('[role="menuitem"]')) close(true);
  });

  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const list = items();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const next = (list.indexOf(document.activeElement) + step + list.length) % list.length;
    list[next]?.focus();
  });

  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target) && event.target !== button) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close(true);
  });

  return { open, close };
}
