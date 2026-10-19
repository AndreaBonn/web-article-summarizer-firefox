// Controllo dimensione font condiviso (reading mode, analisi PDF)

export const FONT_SIZES = ['S', 'M', 'L', 'XL'];
const DEFAULT_INDEX = 1; // M

/**
 * Indice in FONT_SIZES del valore salvato; valore assente o ignoto -> M.
 *
 * @param {string|null} saved
 * @returns {number}
 */
export function resolveFontSizeIndex(saved) {
  const index = FONT_SIZES.indexOf(saved || 'M');
  return index >= 0 ? index : DEFAULT_INDEX;
}

/**
 * Crea il controllo; i getter sono invocati a ogni applicazione, così il
 * chiamante decide se leggere un riferimento fisso o rifare il lookup.
 *
 * @param {object} options
 * @param {string} options.storageKey - chiave localStorage
 * @param {() => HTMLElement|null} options.getLabel
 * @param {() => HTMLButtonElement|null} options.getDecreaseBtn
 * @param {() => HTMLButtonElement|null} options.getIncreaseBtn
 * @returns {{load: () => void, increase: () => void, decrease: () => void}}
 */
export function createFontSizeControl({ storageKey, getLabel, getDecreaseBtn, getIncreaseBtn }) {
  let currentIndex = DEFAULT_INDEX;

  function apply() {
    const size = FONT_SIZES[currentIndex];
    document.body.setAttribute('data-font-size', size);

    const label = getLabel();
    if (label) label.textContent = size;

    const decreaseBtn = getDecreaseBtn();
    const increaseBtn = getIncreaseBtn();
    if (decreaseBtn) decreaseBtn.disabled = currentIndex === 0;
    if (increaseBtn) increaseBtn.disabled = currentIndex === FONT_SIZES.length - 1;

    localStorage.setItem(storageKey, size);
  }

  return {
    load() {
      currentIndex = resolveFontSizeIndex(localStorage.getItem(storageKey));
      apply();
    },
    increase() {
      if (currentIndex < FONT_SIZES.length - 1) {
        currentIndex++;
        apply();
      }
    },
    decrease() {
      if (currentIndex > 0) {
        currentIndex--;
        apply();
      }
    },
  };
}
