// Debounce Utility - Ottimizzazione performance per eventi frequenti
// Riduce il numero di chiamate a funzioni costose

export class DebounceUtility {
  /**
   * Debounce con feedback visivo immediato
   * Mostra indicatore "Ricerca in corso..." mentre aspetta
   *
   * @param {Function} func - Funzione da eseguire
   * @param {number} wait - Millisecondi di attesa (default: 300)
   * @param {HTMLElement} feedbackEl - Elemento per feedback visivo
   * @returns {Function} - Funzione debounced con feedback
   *
   * Esempio:
   * const debouncedSearch = DebounceUtility.debounceWithFeedback(
   *   search,
   *   300,
   *   document.getElementById('searchInput')
   * );
   */
  static debounceWithFeedback(func, wait = 300, feedbackEl = null) {
    let timeout;
    return function executedFunction(...args) {
      const context = this;

      // Aggiungi classe "searching" per feedback visivo
      if (feedbackEl) {
        feedbackEl.classList.add('searching');
      }

      const later = () => {
        clearTimeout(timeout);

        // Rimuovi classe "searching"
        if (feedbackEl) {
          feedbackEl.classList.remove('searching');
        }

        func.apply(context, args);
      };

      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}
