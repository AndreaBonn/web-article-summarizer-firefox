import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock di @mozilla/readability — non disponibile in jsdom senza browser reale
vi.mock('@mozilla/readability', () => ({
  Readability: class {
    constructor(_doc) {}
    parse() {
      // Ritorna null di default; i singoli test possono sovrascrivere
      return null;
    }
  },
}));

import { ContentExtractor } from '@utils/core/content-extractor.js';

/**
 * Crea un document jsdom minimale con un articolo a n parole.
 */
function buildDocument({ wordCount = 300, useArticleTag = true, title = 'Titolo Test' } = {}) {
  document.title = title;

  // Ripulisce body
  document.body.innerHTML = '';

  const words = Array.from({ length: wordCount }, (_, i) => `parola${i}`).join(' ');

  // Divide in 5 paragrafi da wordCount/5 parole ciascuno (min 20 char garantito)
  const chunkSize = Math.ceil(wordCount / 5);
  const wordArray = words.split(' ');
  const paragraphs = [];
  for (let i = 0; i < 5; i++) {
    paragraphs.push(wordArray.slice(i * chunkSize, (i + 1) * chunkSize).join(' '));
  }

  const container = useArticleTag
    ? document.createElement('article')
    : document.createElement('main');
  paragraphs.forEach((text) => {
    const p = document.createElement('p');
    p.textContent = text;
    container.appendChild(p);
  });
  document.body.appendChild(container);

  return document;
}

describe('ContentExtractor.extract() — fallback extraction (Readability ritorna null)', () => {
  beforeEach(() => {
    // window.location.href è read-only in jsdom, ma ContentExtractor lo legge
    // Non serve impostarlo — jsdom usa "about:blank" di default
  });

  it('estrae contenuto da un <article> con paragrafi sufficienti', () => {
    buildDocument({ wordCount: 300, useArticleTag: true });
    const result = ContentExtractor.extract(document);

    expect(result).toBeTruthy();
    expect(result.paragraphs.length).toBeGreaterThan(0);
    expect(result.wordCount).toBeGreaterThanOrEqual(200);
    expect(result.title).toBe('Titolo Test');
  });

  it('usa fallback su <main> se non esiste <article>', () => {
    buildDocument({ wordCount: 300, useArticleTag: false });
    const result = ContentExtractor.extract(document);

    expect(result).toBeTruthy();
    expect(result.wordCount).toBeGreaterThanOrEqual(200);
  });

  it('filtra paragrafi troppo corti (<30 caratteri nel fallback)', () => {
    document.body.innerHTML = '';
    const article = document.createElement('article');

    // Paragrafo corto — deve essere filtrato
    const short = document.createElement('p');
    short.textContent = 'Corto';
    article.appendChild(short);

    // 5 paragrafi lunghi con abbastanza parole
    for (let i = 0; i < 5; i++) {
      const p = document.createElement('p');
      p.textContent = Array.from({ length: 50 }, (_, j) => `word${i}_${j}`).join(' ');
      article.appendChild(p);
    }

    document.body.appendChild(article);
    const result = ContentExtractor.extract(document);

    // Il paragrafo "Corto" non deve essere nei paragrafi estratti
    const shortParagraphs = result.paragraphs.filter((p) => p.text === 'Corto');
    expect(shortParagraphs).toHaveLength(0);
  });

  it('lancia errore "Article too short" con meno di 200 parole', () => {
    buildDocument({ wordCount: 50, useArticleTag: true });
    expect(() => ContentExtractor.extract(document)).toThrow('Article too short');
  });

  it('include readingTimeMinutes calcolato correttamente', () => {
    buildDocument({ wordCount: 450, useArticleTag: true }); // 450 / 225 = 2 min
    const result = ContentExtractor.extract(document);
    expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });
});

describe('ContentExtractor.extract() — con Readability che restituisce contenuto', () => {
  it('usa Readability quando disponibile e ritorna articolo strutturato', async () => {
    // Sovrascrive il mock per questo test con Readability funzionante
    const { Readability } = await import('@mozilla/readability');

    // Costruisce HTML sufficiente nel document
    document.body.innerHTML = '';
    const article = document.createElement('article');
    // 300 parole nei paragrafi
    for (let i = 0; i < 5; i++) {
      const p = document.createElement('p');
      p.textContent = Array.from({ length: 60 }, (_, j) => `testo${i}_${j}`).join(' ');
      article.appendChild(p);
    }
    document.body.appendChild(article);
    document.title = 'Titolo da Readability';

    // Fa fallire Readability (ritorna null) → usa fallback
    vi.spyOn(Readability.prototype, 'parse').mockReturnValue(null);

    const result = ContentExtractor.extract(document);

    // Anche con fallback, l'estrazione funziona
    expect(result).toBeTruthy();
    expect(result.title).toBe('Titolo da Readability');
  });
});

describe('ContentExtractor — struttura dati risultante', () => {
  it('restituisce oggetto con tutte le proprietà attese', () => {
    buildDocument({ wordCount: 300 });
    const result = ContentExtractor.extract(document);

    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('author');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('paragraphs');
    expect(result).toHaveProperty('wordCount');
    expect(result).toHaveProperty('readingTimeMinutes');
    expect(result).toHaveProperty('excerpt');
    expect(Array.isArray(result.paragraphs)).toBe(true);
  });

  it('ogni paragrafo ha id numerico e testo non vuoto', () => {
    buildDocument({ wordCount: 300 });
    const result = ContentExtractor.extract(document);

    result.paragraphs.forEach((p) => {
      expect(typeof p.id).toBe('number');
      expect(p.id).toBeGreaterThan(0);
      expect(typeof p.text).toBe('string');
      expect(p.text.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Testi specifici per il noise filtering
// ---------------------------------------------------------------------------

// Testi di testo rumoroso reali usati in tutto il describe block
const NOISE_SAMPLES = [
  '€ 139,99 per il primo anno',
  'ABBONATI Rinnovo automatico. Disattiva quando vuoi',
  'Accedere a tutti gli articoli del quotidiano tramite app e sito',
  'Navigare senza pubblicità',
  'Sfoglia ogni giorno i contenuti di FQ IN EDICOLA',
  'Sconto del 20% sul nostro shop online',
  '$9.99/month cancel anytime',
];

// Testi articolo puliti che NON devono essere filtrati
const CLEAN_SAMPLES = [
  'Il presidente ha firmato il decreto ieri sera a Roma',
  'Le probabilità di una tregua erano stimate al 35%',
  'Uno di questi ha creato un portafoglio alle 10',
];

// Helper: crea un contenitore jsdom con paragrafi arbitrari
function buildContainer(paragraphTexts) {
  const div = document.createElement('div');
  paragraphTexts.forEach((text) => {
    const p = document.createElement('p');
    p.textContent = text;
    div.appendChild(p);
  });
  return div;
}

// Helper: genera testo articolo pulito con almeno `wordCount` parole
function generateCleanText(wordCount = 250) {
  return Array.from({ length: wordCount }, (_, i) => `parola${i}`).join(' ');
}

// Helper: costruisce HTML per processReadabilityArticle con N parole pulite
// più eventuali testi rumorosi aggiuntivi in coda
function buildArticleContent(cleanWordCount = 250, extraParagraphs = []) {
  const cleanText = generateCleanText(cleanWordCount);
  // Suddivide in 5 paragrafi
  const words = cleanText.split(' ');
  const chunkSize = Math.ceil(words.length / 5);
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += `<p>${words.slice(i * chunkSize, (i + 1) * chunkSize).join(' ')}</p>`;
  }
  extraParagraphs.forEach((text) => {
    html += `<p>${text}</p>`;
  });
  return html;
}

// ---------------------------------------------------------------------------
// 1. _isNoiseParagraph
// ---------------------------------------------------------------------------

describe('ContentExtractor._isNoiseParagraph() — rilevamento testo rumoroso', () => {
  it('test_isNoiseParagraph_prezzoAnnuale_returnsTrue', () => {
    expect(ContentExtractor._isNoiseParagraph('€ 139,99 per il primo anno')).toBe(true);
  });

  it('test_isNoiseParagraph_abbonatoConRinnovoAutomatico_returnsTrue', () => {
    expect(
      ContentExtractor._isNoiseParagraph('ABBONATI Rinnovo automatico. Disattiva quando vuoi'),
    ).toBe(true);
  });

  it('test_isNoiseParagraph_rinnovoAutomaticoStandalone_returnsTrue', () => {
    expect(ContentExtractor._isNoiseParagraph('Rinnovo automatico ogni mese')).toBe(true);
  });

  it('test_isNoiseParagraph_disattivaQuandoVuoi_returnsTrue', () => {
    expect(ContentExtractor._isNoiseParagraph('Disattiva quando vuoi')).toBe(true);
  });

  it('test_isNoiseParagraph_accedereATuttiGliArticoli_returnsTrue', () => {
    expect(
      ContentExtractor._isNoiseParagraph(
        'Accedere a tutti gli articoli del quotidiano tramite app e sito',
      ),
    ).toBe(true);
  });

  it('test_isNoiseParagraph_navigareSenzaPubblicita_returnsTrue', () => {
    expect(ContentExtractor._isNoiseParagraph('Navigare senza pubblicità')).toBe(true);
  });

  it('test_isNoiseParagraph_sfogliaOgniGiorno_returnsTrue', () => {
    expect(
      ContentExtractor._isNoiseParagraph('Sfoglia ogni giorno i contenuti di FQ IN EDICOLA'),
    ).toBe(true);
  });

  it('test_isNoiseParagraph_scontoPercentuale_returnsTrue', () => {
    expect(ContentExtractor._isNoiseParagraph('Sconto del 20% sul nostro shop online')).toBe(true);
  });

  it('test_isNoiseParagraph_englishMonthlyPriceWithCancel_returnsTrue', () => {
    expect(ContentExtractor._isNoiseParagraph('$9.99/month cancel anytime')).toBe(true);
  });

  it('test_isNoiseParagraph_cancelAnyoneStandalone_returnsTrue', () => {
    expect(ContentExtractor._isNoiseParagraph('Cancel anytime')).toBe(true);
  });

  it('test_isNoiseParagraph_freeTrial_returnsTrue', () => {
    expect(ContentExtractor._isNoiseParagraph('Start your free trial today')).toBe(true);
  });

  it('test_isNoiseParagraph_cookieBanner_returnsTrue', () => {
    expect(ContentExtractor._isNoiseParagraph('We use cookies and GDPR compliant tracking')).toBe(
      true,
    );
  });

  it('test_isNoiseParagraph_loginCTA_returnsTrue', () => {
    expect(ContentExtractor._isNoiseParagraph('Log in to read the full article')).toBe(true);
  });

  // Testi PULITI che NON devono essere filtrati
  it('test_isNoiseParagraph_cleanItalianNews_returnsFalse', () => {
    expect(
      ContentExtractor._isNoiseParagraph('Il presidente ha firmato il decreto ieri sera a Roma'),
    ).toBe(false);
  });

  it('test_isNoiseParagraph_cleanPercentualeStatistica_returnsFalse', () => {
    // Contiene "%" ma non il pattern "sconto del X%"
    expect(
      ContentExtractor._isNoiseParagraph('Le probabilità di una tregua erano stimate al 35%'),
    ).toBe(false);
  });

  it('test_isNoiseParagraph_cleanArticleWithPortafoglio_returnsFalse', () => {
    // "portafoglio" non è un pattern noise
    expect(
      ContentExtractor._isNoiseParagraph('Uno di questi ha creato un portafoglio alle 10'),
    ).toBe(false);
  });

  it('test_isNoiseParagraph_emptyString_returnsFalse', () => {
    // Stringa vuota non matcha nessun pattern
    expect(ContentExtractor._isNoiseParagraph('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. _deduplicateParagraphs
// ---------------------------------------------------------------------------

describe('ContentExtractor._deduplicateParagraphs() — rimozione duplicati', () => {
  it('test_deduplicateParagraphs_noDuplicates_returnsAllParagraphs', () => {
    const input = [
      { id: 1, text: 'Primo paragrafo articolo' },
      { id: 2, text: 'Secondo paragrafo articolo' },
      { id: 3, text: 'Terzo paragrafo articolo' },
    ];
    const result = ContentExtractor._deduplicateParagraphs(input);
    expect(result).toHaveLength(3);
  });

  it('test_deduplicateParagraphs_exactDuplicates_removesSecondOccurrence', () => {
    const input = [
      { id: 1, text: 'ABBONATI Rinnovo automatico. Disattiva quando vuoi' },
      { id: 2, text: 'Il presidente ha firmato il decreto' },
      { id: 3, text: 'ABBONATI Rinnovo automatico. Disattiva quando vuoi' },
    ];
    const result = ContentExtractor._deduplicateParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('ABBONATI Rinnovo automatico. Disattiva quando vuoi');
    expect(result[1].text).toBe('Il presidente ha firmato il decreto');
  });

  it('test_deduplicateParagraphs_caseInsensitiveDuplicates_removesSecondOccurrence', () => {
    const input = [
      { id: 1, text: 'Abbonati Rinnovo Automatico' },
      { id: 2, text: 'abbonati rinnovo automatico' },
    ];
    const result = ContentExtractor._deduplicateParagraphs(input);
    expect(result).toHaveLength(1);
  });

  it('test_deduplicateParagraphs_extraWhitespaceDuplicates_removesSecondOccurrence', () => {
    const input = [
      { id: 1, text: 'Sfoglia ogni giorno i contenuti' },
      { id: 2, text: '  Sfoglia  ogni  giorno  i  contenuti  ' },
    ];
    const result = ContentExtractor._deduplicateParagraphs(input);
    expect(result).toHaveLength(1);
  });

  it('test_deduplicateParagraphs_multipleNoiseBlocksRepeated_deduplicatesAll', () => {
    const subscriptionBlock = '€ 139,99 per il primo anno';
    const input = [
      { id: 1, text: subscriptionBlock },
      { id: 2, text: subscriptionBlock },
      { id: 3, text: subscriptionBlock },
    ];
    const result = ContentExtractor._deduplicateParagraphs(input);
    expect(result).toHaveLength(1);
  });

  it('test_deduplicateParagraphs_emptyArray_returnsEmptyArray', () => {
    const result = ContentExtractor._deduplicateParagraphs([]);
    expect(result).toHaveLength(0);
  });

  it('test_deduplicateParagraphs_reindexesIdsAfterDedup', () => {
    const input = [
      { id: 10, text: 'Primo testo univoco' },
      { id: 20, text: 'Primo testo univoco' },
      { id: 30, text: 'Secondo testo univoco' },
    ];
    const result = ContentExtractor._deduplicateParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. _extractCleanParagraphs
// ---------------------------------------------------------------------------

describe('ContentExtractor._extractCleanParagraphs() — filtraggio noise da contenitore DOM', () => {
  it('test_extractCleanParagraphs_cleanParagraphsOnly_returnsAllParagraphs', () => {
    const container = buildContainer(CLEAN_SAMPLES);
    const result = ContentExtractor._extractCleanParagraphs(container);
    expect(result).toHaveLength(CLEAN_SAMPLES.length);
  });

  it('test_extractCleanParagraphs_noiseParagraphsOnly_returnsEmptyArray', () => {
    // Tutti i testi rumorosi — nessuno deve passare
    const container = buildContainer(NOISE_SAMPLES);
    const result = ContentExtractor._extractCleanParagraphs(container);
    expect(result).toHaveLength(0);
  });

  it('test_extractCleanParagraphs_mixedContent_returnsOnlyCleanParagraphs', () => {
    const mixed = [...CLEAN_SAMPLES, ...NOISE_SAMPLES];
    const container = buildContainer(mixed);
    const result = ContentExtractor._extractCleanParagraphs(container);
    // Solo i 3 paragrafi puliti devono sopravvivere
    expect(result).toHaveLength(CLEAN_SAMPLES.length);
    result.forEach((p) => {
      expect(CLEAN_SAMPLES).toContain(p.text);
    });
  });

  it('test_extractCleanParagraphs_paragraphBelowMinLength_isSkipped', () => {
    // MIN_PARAGRAPH_LENGTH = 20 caratteri
    const container = buildContainer(['Corto', ...CLEAN_SAMPLES]);
    const result = ContentExtractor._extractCleanParagraphs(container);
    // "Corto" ha meno di 20 caratteri, non deve essere incluso
    expect(result).toHaveLength(CLEAN_SAMPLES.length);
    const texts = result.map((p) => p.text);
    expect(texts).not.toContain('Corto');
  });

  it('test_extractCleanParagraphs_headingsAreExtracted_returnsHeadingText', () => {
    const div = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.textContent = 'Titolo sezione articolo che supera i venti caratteri';
    div.appendChild(h2);
    const result = ContentExtractor._extractCleanParagraphs(div);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Titolo sezione articolo che supera i venti caratteri');
  });

  it('test_extractCleanParagraphs_listItemsAreExtracted_returnsLiText', () => {
    const div = document.createElement('div');
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    li.textContent = 'Voce di lista articolo abbastanza lunga da superare il minimo';
    ul.appendChild(li);
    div.appendChild(ul);
    const result = ContentExtractor._extractCleanParagraphs(div);
    expect(result).toHaveLength(1);
  });

  it('test_extractCleanParagraphs_noiseListItem_isFiltered', () => {
    const div = document.createElement('div');
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    li.textContent = 'Sconto del 50% sul nostro shop online per abbonati';
    ul.appendChild(li);
    div.appendChild(ul);
    const result = ContentExtractor._extractCleanParagraphs(div);
    expect(result).toHaveLength(0);
  });

  it('test_extractCleanParagraphs_assignsSequentialIds_startingFromOne', () => {
    const container = buildContainer(CLEAN_SAMPLES);
    const result = ContentExtractor._extractCleanParagraphs(container);
    result.forEach((p, i) => {
      expect(p.id).toBe(i + 1);
    });
  });

  it('test_extractCleanParagraphs_emptyContainer_returnsEmptyArray', () => {
    const div = document.createElement('div');
    const result = ContentExtractor._extractCleanParagraphs(div);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. _removeNoiseElements
// ---------------------------------------------------------------------------

describe('ContentExtractor._removeNoiseElements() — rimozione elementi DOM rumorosi', () => {
  it('test_removeNoiseElements_scriptTag_isRemoved', () => {
    const div = document.createElement('div');
    div.innerHTML = '<script>alert("xss")</script><p>Testo articolo valido e abbastanza lungo</p>';
    ContentExtractor._removeNoiseElements(div);
    expect(div.querySelector('script')).toBeNull();
  });

  it('test_removeNoiseElements_navTag_isRemoved', () => {
    const div = document.createElement('div');
    div.innerHTML = '<nav><a href="#">Home</a></nav><p>Contenuto articolo valido</p>';
    ContentExtractor._removeNoiseElements(div);
    expect(div.querySelector('nav')).toBeNull();
  });

  it('test_removeNoiseElements_footerTag_isRemoved', () => {
    const div = document.createElement('div');
    div.innerHTML = '<footer>Copyright 2024</footer><p>Contenuto valido rimane</p>';
    ContentExtractor._removeNoiseElements(div);
    expect(div.querySelector('footer')).toBeNull();
  });

  it('test_removeNoiseElements_paywallClass_isRemoved', () => {
    const div = document.createElement('div');
    div.innerHTML = '<div class="paywall">Abbonati per leggere</div><p>Contenuto valido rimane</p>';
    ContentExtractor._removeNoiseElements(div);
    expect(div.querySelector('.paywall')).toBeNull();
  });

  it('test_removeNoiseElements_subscribeClass_isRemoved', () => {
    const div = document.createElement('div');
    div.innerHTML = '<div class="subscribe-box">Subscribe now</div><p>Contenuto valido rimane</p>';
    ContentExtractor._removeNoiseElements(div);
    // La classe contiene "subscribe" → rimossa dal selector [class*="subscribe"]
    expect(div.querySelector('.subscribe-box')).toBeNull();
  });

  it('test_removeNoiseElements_divWithNoiseText_isRemoved', () => {
    const div = document.createElement('div');
    // Un div la cui testContent intera è testo rumoroso
    div.innerHTML =
      '<div>Sconto del 30% sul nostro shop online abbonati</div><p>Contenuto valido lungo abbastanza</p>';
    ContentExtractor._removeNoiseElements(div);
    // Il div rumoroso deve essere rimosso
    const remaining = [...div.querySelectorAll('div')];
    remaining.forEach((el) => {
      expect(ContentExtractor._isNoiseParagraph(el.textContent.trim())).toBe(false);
    });
  });

  it('test_removeNoiseElements_divWithMixedContent_preservesCleanChildren', () => {
    const div = document.createElement('div');
    const outer = document.createElement('div');
    const cleanText = 'Il presidente ha firmato il decreto ieri sera a Roma in diretta televisiva';
    outer.innerHTML = `
      <p>${cleanText}</p>
      <p>Abbonati per accedere a tutti gli articoli a € 10 al mese</p>
    `;
    div.appendChild(outer);

    ContentExtractor._removeNoiseElements(div);
    const paragraphs = ContentExtractor._extractCleanParagraphs(div);

    expect(paragraphs).toEqual([{ id: 1, text: cleanText }]);
  });

  it('test_removeNoiseElements_cleanArticleContent_isPreserved', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <p>Il presidente ha firmato il decreto ieri sera a Roma</p>
      <p>Le probabilità di una tregua erano stimate al 35%</p>
      <p>Uno di questi ha creato un portafoglio alle 10</p>
    `;
    const initialPCount = div.querySelectorAll('p').length;
    ContentExtractor._removeNoiseElements(div);
    // I paragrafi puliti devono rimanere
    expect(div.querySelectorAll('p').length).toBe(initialPCount);
  });

  it('test_removeNoiseElements_adClass_isRemoved', () => {
    const div = document.createElement('div');
    div.innerHTML = '<div class="ad">Pubblicità</div><p>Contenuto articolo valido</p>';
    ContentExtractor._removeNoiseElements(div);
    expect(div.querySelector('.ad')).toBeNull();
  });

  it('test_removeNoiseElements_newsletterClass_isRemoved', () => {
    const div = document.createElement('div');
    div.innerHTML =
      '<div class="newsletter">Iscriviti alla newsletter</div><p>Contenuto valido</p>';
    ContentExtractor._removeNoiseElements(div);
    expect(div.querySelector('.newsletter')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Integration: processReadabilityArticle — noise stripping
// ---------------------------------------------------------------------------

describe('ContentExtractor.processReadabilityArticle() — stripping noise da output Readability', () => {
  // Simula un oggetto article come restituito da Readability
  function buildReadabilityArticle(
    content,
    { title = 'Test Article', byline = 'Autore Test' } = {},
  ) {
    return {
      title,
      byline,
      content,
      publishedTime: null,
      excerpt: 'Excerpt breve',
    };
  }

  it('test_processReadabilityArticle_cleanContent_returnsStructuredArticle', () => {
    const content = buildArticleContent(250);
    const article = buildReadabilityArticle(content);
    const result = ContentExtractor.processReadabilityArticle(article, document);

    expect(result).toHaveProperty('title', 'Test Article');
    expect(result).toHaveProperty('author', 'Autore Test');
    expect(result.wordCount).toBeGreaterThanOrEqual(200);
    expect(Array.isArray(result.paragraphs)).toBe(true);
    expect(result.paragraphs.length).toBeGreaterThan(0);
  });

  it('test_processReadabilityArticle_noiseInContent_noiseIsStripped', () => {
    // Aggiunge testi noise in coda ai paragrafi puliti
    const content = buildArticleContent(250, NOISE_SAMPLES);
    const article = buildReadabilityArticle(content);
    const result = ContentExtractor.processReadabilityArticle(article, document);

    // Nessun paragrafo risultante deve matchare i noise pattern
    result.paragraphs.forEach((p) => {
      expect(ContentExtractor._isNoiseParagraph(p.text)).toBe(false);
    });
  });

  it('test_processReadabilityArticle_duplicateNoiseBlocks_deduplicatedAndStripped', () => {
    // Aggiunge lo stesso blocco noise 3 volte
    const repeatedNoise = '€ 139,99 per il primo anno';
    const extraNoise = [repeatedNoise, repeatedNoise, repeatedNoise];
    const content = buildArticleContent(250, extraNoise);
    const article = buildReadabilityArticle(content);
    const result = ContentExtractor.processReadabilityArticle(article, document);

    // Il testo noise non deve comparire
    const noiseInResult = result.paragraphs.filter((p) => p.text === repeatedNoise);
    expect(noiseInResult).toHaveLength(0);
  });

  it('test_processReadabilityArticle_tooShortAfterNoiseStripping_throwsError', () => {
    // Contenuto quasi tutto noise — dopo stripping rimangono poche parole
    const noisyContent = NOISE_SAMPLES.map((t) => `<p>${t}</p>`).join('');
    const article = buildReadabilityArticle(noisyContent);

    expect(() => ContentExtractor.processReadabilityArticle(article, document)).toThrow(
      'Article too short',
    );
  });

  it('test_processReadabilityArticle_paywallDivInContent_paywallIsRemoved', () => {
    const cleanParas = buildArticleContent(250);
    // Aggiunge un div con classe paywall che Readability ha lasciato passare
    const withPaywall = cleanParas + '<div class="paywall"><p>Abbonati per leggere tutto</p></div>';
    const article = buildReadabilityArticle(withPaywall);
    const result = ContentExtractor.processReadabilityArticle(article, document);

    // Verifica che non ci sia testo paywall nei paragrafi
    const paywallTexts = result.paragraphs.filter((p) => p.text.toLowerCase().includes('abbonati'));
    expect(paywallTexts).toHaveLength(0);
  });

  it('test_processReadabilityArticle_usesArticleTitleFallbackFromDocument', () => {
    document.title = 'Titolo dal documento';
    const content = buildArticleContent(250);
    // article.title è vuoto — deve usare document.title
    const article = buildReadabilityArticle(content, { title: '' });
    const result = ContentExtractor.processReadabilityArticle(article, document);

    expect(result.title).toBe('Titolo dal documento');
  });

  it('test_processReadabilityArticle_paragraphsHaveSequentialIds', () => {
    const content = buildArticleContent(250);
    const article = buildReadabilityArticle(content);
    const result = ContentExtractor.processReadabilityArticle(article, document);

    result.paragraphs.forEach((p, i) => {
      expect(p.id).toBe(i + 1);
    });
  });

  it('test_processReadabilityArticle_readingTimeIsCalculatedCorrectly', () => {
    // 450 parole / 225 wpm = 2 minuti esatti
    const content = buildArticleContent(450);
    const article = buildReadabilityArticle(content);
    const result = ContentExtractor.processReadabilityArticle(article, document);

    expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    expect(typeof result.readingTimeMinutes).toBe('number');
  });

  it('test_processReadabilityArticle_extractionMethodIsReadability', () => {
    const content = buildArticleContent(250);
    const article = buildReadabilityArticle(content);
    const result = ContentExtractor.processReadabilityArticle(article, document);

    expect(result.extractionMethod).toBe('readability');
  });

  it('test_processReadabilityArticle_excerptUsesArticleExcerpt', () => {
    const content = buildArticleContent(250);
    const article = buildReadabilityArticle(content);
    article.excerpt = 'Custom excerpt from Readability';
    const result = ContentExtractor.processReadabilityArticle(article, document);

    expect(result.excerpt).toBe('Custom excerpt from Readability');
  });

  it('test_processReadabilityArticle_noExcerpt_usesFirst200CharsOfContent', () => {
    const content = buildArticleContent(250);
    const article = buildReadabilityArticle(content);
    article.excerpt = '';
    const result = ContentExtractor.processReadabilityArticle(article, document);

    expect(result.excerpt).toContain('...');
  });
});

// ---------------------------------------------------------------------------
// 6. fallbackExtraction — sentence splitting
// ---------------------------------------------------------------------------

describe('ContentExtractor.fallbackExtraction() — sentence splitting edge case', () => {
  it('test_fallbackExtraction_fewParagraphsButEnoughSentences_extractsFromSentences', () => {
    document.body.innerHTML = '';
    // No <article>, no <main> — usa body.
    // Solo 1 paragrafo corto (< 3 paragrafi), ma abbastanza testo in sentences.
    const longText = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ');
    // Splitting on '.' — put whole text in a single <div> (no <p>)
    const div = document.createElement('div');
    div.textContent = longText;
    document.body.appendChild(div);

    const result = ContentExtractor.fallbackExtraction(document);

    expect(result.wordCount).toBeGreaterThanOrEqual(200);
    expect(result.extractionMethod).toBe('fallback');
  });

  it('test_fallbackExtraction_degradedFlagIsSet', () => {
    buildDocument({ wordCount: 300 });
    const result = ContentExtractor.extract(document);

    // Readability è mockato a ritornare null → fallback → degraded = true
    expect(result.degraded).toBe(true);
  });

  it('test_fallbackExtraction_usesBodyWhenNoContainerFound', () => {
    document.body.innerHTML = '';
    // Nessun tag semantico — solo paragrafi in body
    for (let i = 0; i < 5; i++) {
      const p = document.createElement('p');
      p.textContent = Array.from({ length: 60 }, (_, j) => `testo${i}_${j}`).join(' ');
      document.body.appendChild(p);
    }

    const result = ContentExtractor.fallbackExtraction(document);

    expect(result.wordCount).toBeGreaterThanOrEqual(200);
  });
});
