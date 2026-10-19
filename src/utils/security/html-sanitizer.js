// HTML Sanitizer - Previene XSS sanitizzando contenuto prima dell'inserimento nel DOM
export class HtmlSanitizer {
  /**
   * Escapa caratteri HTML pericolosi per prevenire XSS
   */
  static escape(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    // innerHTML escapa solo & < > (nbsp compreso): le virgolette vanno escapate a mano,
    // altrimenti un valore interpolato in un attributo ne chiude il delimitatore
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Rendering sicuro di contenuto AI in un elemento DOM.
   * Converte linee vuote in paragrafi e preserva la struttura del testo.
   */
  static renderText(text, element) {
    if (!element) return;
    if (typeof text !== 'string' || !text.trim()) {
      element.textContent = text || '';
      return;
    }
    // Splitta in paragrafi su doppie newline, escapa ogni paragrafo
    const paragraphs = text.split(/\n\n+/);
    element.innerHTML = paragraphs
      .map(p => `<p>${HtmlSanitizer.escape(p.trim())}</p>`)
      .join('');
  }

  /**
   * Rendering sicuro di una lista di elementi con titolo e descrizione.
   * Usato per keypoints, citazioni, Q&A.
   */
  static renderList(items, element, options = {}) {
    if (!element || !Array.isArray(items)) return;
    const { titleKey = 'title', descKey = 'description', ordered = false } = options;
    const tag = ordered ? 'ol' : 'ul';
    const html = items.map(item => {
      const title = HtmlSanitizer.escape(item[titleKey] || '');
      const desc = HtmlSanitizer.escape(item[descKey] || '');
      if (title && desc) {
        return `<li><strong>${title}</strong>: ${desc}</li>`;
      }
      return `<li>${title || desc}</li>`;
    }).join('');
    element.innerHTML = `<${tag}>${html}</${tag}>`;
  }
}
