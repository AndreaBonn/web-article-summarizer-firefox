import { describe, it, expect } from 'vitest';
import { ContentDetector } from '@utils/ai/content-detector.js';

// ---------------------------------------------------------------------------
// detectContentType()
// ---------------------------------------------------------------------------
describe('ContentDetector.detectContentType()', () => {
  const makeArticle = (title, content) => ({ title, content });

  it('test_detectContentType_terminologiaAccademica_restittuisceScientific', () => {
    const article = makeArticle(
      'Studio clinico randomizzato',
      'The study involved 200 participants and tested the hypothesis using p < 0.05 significance.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('scientific');
  });

  it('test_detectContentType_riferimenTiTemporali_restittuisceNews', () => {
    const article = makeArticle(
      'Economia in ripresa',
      'According to the minister, today the new decree was approved by parliament.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('news');
  });

  it('test_detectContentType_multipleNewsSignals_restittuisceNews', () => {
    const article = makeArticle(
      'Aggiornamento urgente',
      'Breaking: the company reported today a major restructuring plan according to sources close to the CEO.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('news');
  });

  it('test_detectContentType_titoloConHowTo_restittuisceTutorial', () => {
    const article = makeArticle(
      'How to configure nginx on Ubuntu',
      'In this guide we will setup a reverse proxy and install all dependencies.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('tutorial');
  });

  it('test_detectContentType_terminiBusiness_restittuisceBusiness', () => {
    const article = makeArticle(
      'Risultati trimestrali',
      "L'azienda ha registrato un fatturato di €500M con una forte crescita del mercato e una chiara strategia di ROI per i prossimi anni.",
    );
    expect(ContentDetector.detectContentType(article)).toBe('business');
  });

  it('test_detectContentType_onlyMoneyAmountWithSuffix_restituisceBusiness', () => {
    const article = makeArticle('Notizie dal settore', 'Acme closed a seed round of $5M last week.');
    expect(ContentDetector.detectContentType(article)).toBe('business');
  });

  it('test_detectContentType_amountWithoutSuffix_restituisceGeneral', () => {
    const article = makeArticle('Notizie dal settore', 'Acme paid $5 for a coffee last week.');
    expect(ContentDetector.detectContentType(article)).toBe('general');
  });

  it('test_detectContentType_primaPersona_restittuisceOpinion', () => {
    const article = makeArticle(
      'Il futuro dei social network',
      'I believe we should rethink how platforms are regulated. In my view the current system is broken.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('opinion');
  });

  it('test_detectContentType_titoloOpinion_restittuisceOpinion', () => {
    const article = makeArticle(
      'Editorial: perché la riforma è necessaria',
      'Un testo generico senza pattern particolari ma che non contiene termini specifici.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('opinion');
  });

  it('test_detectContentType_contenutoGenerico_restittuisceGeneral', () => {
    const article = makeArticle(
      'Un testo qualsiasi',
      'Testo generico senza pattern particolari che non rientra in nessuna categoria specifica.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('general');
  });

  it('test_detectContentType_scientificHaPrecedenzaSuNews_restittuisceScientific', () => {
    // "study" + "participants" attiva scientific prima di news
    const article = makeArticle(
      'Nuovo studio today',
      'The study with 100 participants showed today that the hypothesis was confirmed.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('scientific');
  });

  it('test_detectContentType_valorePBreaking_restittuisceScientific', () => {
    const article = makeArticle(
      'Ricerca universitaria',
      'I dati mostrano p = 0.001 per il gruppo sperimentale, confermando i risultati preliminari.',
    );
    expect(ContentDetector.detectContentType(article)).toBe('scientific');
  });
});

// ---------------------------------------------------------------------------
// detectLanguage()
// ---------------------------------------------------------------------------
describe('ContentDetector.detectLanguage()', () => {
  it('test_detectLanguage_testoItaliano_restittuisceIt', () => {
    const text =
      "Questo articolo parla della situazione della scuola italiana. La riforma delle università è questo anno nell'agenda politica.";
    expect(ContentDetector.detectLanguage(text)).toBe('it');
  });

  it('test_detectLanguage_testoInglese_restittuisceEn', () => {
    const text =
      'This article discusses the current state of technology. The new generation of devices have been launched this year.';
    expect(ContentDetector.detectLanguage(text)).toBe('en');
  });

  it('test_detectLanguage_testoSpagnolo_restittuisceEs', () => {
    const text =
      'Este artículo habla del mercado económico del país. Los datos del informe son los mejores para esta empresa.';
    expect(ContentDetector.detectLanguage(text)).toBe('es');
  });

  it('test_detectLanguage_testoFrancese_restittuisceFr', () => {
    const text =
      'Cet article parle des nouvelles politiques qui sont dans les actualités. Les données sont très importantes pour nous.';
    expect(ContentDetector.detectLanguage(text)).toBe('fr');
  });

  it('test_detectLanguage_testoTedesco_restittuisceDe', () => {
    const text =
      'Dieser Artikel handelt von der deutschen Wirtschaft. Die Ergebnisse der Studie sind nicht eindeutig für sich.';
    expect(ContentDetector.detectLanguage(text)).toBe('de');
  });

  it('test_detectLanguage_testoVuoto_restittuisceEnDefault', () => {
    // Nessun match → default 'en'
    expect(ContentDetector.detectLanguage('')).toBe('en');
  });
});
