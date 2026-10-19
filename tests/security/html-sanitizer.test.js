import { describe, it, expect, beforeEach } from 'vitest';
import { HtmlSanitizer } from '@utils/security/html-sanitizer.js';

describe('HtmlSanitizer.escape()', () => {
  it('restituisce la stringa invariata se non contiene caratteri HTML', () => {
    expect(HtmlSanitizer.escape('testo normale senza HTML')).toBe('testo normale senza HTML');
  });

  it('escapa i tag HTML', () => {
    const result = HtmlSanitizer.escape('<b>grassetto</b>');
    expect(result).toBe('&lt;b&gt;grassetto&lt;/b&gt;');
  });

  it('neutralizza payload XSS con onerror: escapa i tag ma non rimuove il testo', () => {
    const xss = '<img src=x onerror=alert(1)>';
    const result = HtmlSanitizer.escape(xss);
    // I tag < > vengono escapati in entità — il codice non può eseguire
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
    // Il testo "onerror" resta come testo innocuo, non come attributo eseguibile
    expect(result).not.toMatch(/<img[^>]*onerror/);
  });

  it('restituisce stringa vuota per input vuoto', () => {
    expect(HtmlSanitizer.escape('')).toBe('');
  });

  it('restituisce stringa vuota per input non-stringa (numero)', () => {
    expect(HtmlSanitizer.escape(42)).toBe('');
  });

  it('restituisce stringa vuota per input non-stringa (null)', () => {
    expect(HtmlSanitizer.escape(null)).toBe('');
  });

  it('restituisce stringa vuota per input non-stringa (oggetto)', () => {
    expect(HtmlSanitizer.escape({ key: 'val' })).toBe('');
  });

  it('escapa tutti i caratteri speciali HTML: &<>"\'', () => {
    expect(HtmlSanitizer.escape('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('escapa le virgolette cosi un valore non chiude un attributo HTML', () => {
    expect(HtmlSanitizer.escape('" onfocus="x')).toBe('&quot; onfocus=&quot;x');
    expect(HtmlSanitizer.escape("' onfocus='x")).toBe('&#39; onfocus=&#39;x');
  });

  it('non fa doppio escape di una stringa gia senza caratteri speciali (accenti, emoji)', () => {
    expect(HtmlSanitizer.escape('perché è così 📚')).toBe('perché è così 📚');
  });

  it('escapa script tag completo', () => {
    const result = HtmlSanitizer.escape('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });
});

describe('HtmlSanitizer.renderText()', () => {
  let element;

  beforeEach(() => {
    element = document.createElement('div');
  });

  it('popola il div con paragrafi separati da doppie newline', () => {
    HtmlSanitizer.renderText('Paragrafo uno\n\nParagrafo due', element);
    const paragraphs = element.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe('Paragrafo uno');
    expect(paragraphs[1].textContent).toBe('Paragrafo due');
  });

  it('non fa nulla se element è null/undefined', () => {
    // Non deve lanciare
    expect(() => HtmlSanitizer.renderText('testo', null)).not.toThrow();
  });

  it('imposta textContent per testo vuoto', () => {
    HtmlSanitizer.renderText('', element);
    expect(element.textContent).toBe('');
  });

  it('escapa contenuto HTML malevolo nei paragrafi', () => {
    HtmlSanitizer.renderText('<script>alert(1)</script>', element);
    expect(element.innerHTML).not.toContain('<script>');
  });

  it('crea un singolo paragrafo per testo senza doppie newline', () => {
    HtmlSanitizer.renderText('Testo singolo senza paragrafi aggiuntivi', element);
    expect(element.querySelectorAll('p')).toHaveLength(1);
  });
});

describe('HtmlSanitizer.renderList()', () => {
  let element;

  beforeEach(() => {
    element = document.createElement('div');
  });

  it('renderizza una lista ul con title e description', () => {
    const items = [
      { title: 'Punto uno', description: 'Descrizione uno' },
      { title: 'Punto due', description: 'Descrizione due' },
    ];
    HtmlSanitizer.renderList(items, element);
    expect(element.querySelector('ul')).toBeTruthy();
    expect(element.querySelectorAll('li')).toHaveLength(2);
    expect(element.querySelector('strong').textContent).toBe('Punto uno');
  });

  it('usa ol quando ordered=true', () => {
    const items = [{ title: 'A', description: 'B' }];
    HtmlSanitizer.renderList(items, element, { ordered: true });
    expect(element.querySelector('ol')).toBeTruthy();
    expect(element.querySelector('ul')).toBeFalsy();
  });

  it('non fa nulla se items non è un array', () => {
    HtmlSanitizer.renderList('stringa', element);
    expect(element.innerHTML).toBe('');
  });

  it('non fa nulla se element è null', () => {
    expect(() => HtmlSanitizer.renderList([{ title: 'A', description: 'B' }], null)).not.toThrow();
  });

  it('escapa contenuto malevolo nel titolo', () => {
    const items = [{ title: '<script>xss</script>', description: 'ok' }];
    HtmlSanitizer.renderList(items, element);
    expect(element.innerHTML).not.toContain('<script>');
  });

  it('usa titleKey e descKey personalizzati', () => {
    const items = [{ name: 'Nome', body: 'Corpo' }];
    HtmlSanitizer.renderList(items, element, { titleKey: 'name', descKey: 'body' });
    expect(element.querySelector('strong').textContent).toBe('Nome');
  });
});

describe('HtmlSanitizer.escape() dentro attributi HTML reali', () => {
  const PAYLOAD = '1" onfocus="alert(1)" x="';

  it('renderKeypointsHtml: point.paragraphs con virgolette non crea attributi extra', async () => {
    const { renderKeypointsHtml } = await import('../../src/pages/popup/analysis-format.js');
    const host = document.createElement('div');
    host.innerHTML = renderKeypointsHtml([
      { paragraphs: PAYLOAD, title: 't', description: 'd' },
    ]);
    const el = host.querySelector('.keypoint');
    expect(el.hasAttribute('onfocus')).toBe(false);
    expect(el.getAttribute('data-paragraph')).toBe(PAYLOAD);
    expect(host.querySelector('.keypoint-ref').getAttribute('title')).toBe(`§${PAYLOAD}`);
  });

  it('renderCitationsHtml: data-citation-text con virgolette non crea attributi extra', async () => {
    const { renderCitationsHtml } = await import('../../src/pages/popup/citations-render.js');
    const host = document.createElement('div');
    host.innerHTML = renderCitationsHtml({
      citations: [{ id: 1, type: 'direct', quote_text: PAYLOAD, paragraph: PAYLOAD }],
    });
    const el = host.querySelector('.citation-item');
    expect(el.hasAttribute('onfocus')).toBe(false);
    expect(el.getAttribute('data-citation-text')).toBe(PAYLOAD);
    expect(el.getAttribute('data-paragraph')).toBe(PAYLOAD);
  });
});
