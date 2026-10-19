// Content Detector - Analisi del tipo di contenuto e della lingua
export class ContentDetector {
  static detectContentType(article) {
    const titleLower = article.title.toLowerCase();
    const contentSample = article.content.toLowerCase().slice(0, 2000);

    // Scoring-based detection: count matches per category, highest wins
    const scores = { scientific: 0, news: 0, tutorial: 0, business: 0, opinion: 0 };

    // Scientific: termini accademici (high-confidence markers)
    const scientificTerms = ['methodology', 'hypothesis', 'participants', 'p <', 'study'];
    scientificTerms.forEach((t) => {
      if (contentSample.includes(t)) scores.scientific += 2;
    });
    if (/\bp\s*=\s*0\.\d+/.test(contentSample)) scores.scientific += 3;

    // News: riferimenti temporali e fonti (lower weight per term — common words)
    const newsTerms = /\b(breaking|reported|according to|oggi|ieri)\b/g;
    scores.news += (contentSample.match(newsTerms) || []).length;
    if (/\b(today|yesterday)\b/.test(contentSample)) scores.news += 1;
    const datePattern =
      /\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+\d{4}/i;
    if (datePattern.test(contentSample)) scores.news += 2;

    // Tutorial: istruzioni step-by-step (title match is strong signal)
    if (/\b(how to|tutorial|guide|guida)\b/.test(titleLower)) scores.tutorial += 3;
    if (/\b(step|install|configure|setup|installare|configurare)\b/.test(titleLower))
      scores.tutorial += 2;
    const sequenceTerms =
      /\b(first|second|third|next|then|finally|primo|secondo|terzo|poi|infine)\b/g;
    scores.tutorial += Math.min((contentSample.match(sequenceTerms) || []).length, 3);

    // Business: termini aziendali
    const businessTerms =
      /\b(revenue|market|strategy|roi|growth|company|business|ceo|azienda|mercato|strategia)\b/g;
    scores.business += (contentSample.match(businessTerms) || []).length;
    if (/\$\d+[mbk]|€\d+[mbk]/.test(contentSample)) scores.business += 2;

    // Opinion: prima persona e argomenti
    const opinionTerms =
      /\b(i believe|in my view|i think|we should|we must|credo che|penso che|dovremmo)\b/g;
    scores.opinion += (contentSample.match(opinionTerms) || []).length * 2;
    if (/\b(opinion|editorial|commentary|opinione|editoriale)\b/.test(titleLower))
      scores.opinion += 3;

    // Find highest scoring category (minimum threshold: 2)
    const best = Object.entries(scores).reduce((a, b) => (a[1] >= b[1] ? a : b));
    return best[1] >= 2 ? best[0] : 'general';
  }

  static detectLanguage(text) {
    const sample = text.toLowerCase().slice(0, 1000);

    const patterns = {
      it: [
        /\bche\b/,
        /\bdella\b/,
        /\bdegli\b/,
        /\bdelle\b/,
        /\bquesto\b/,
        /\bquesta\b/,
        /\bsono\b/,
        /\bessere\b/,
        /\bnell\b/,
        /\balla\b/,
      ],
      en: [
        /\bthe\b/,
        /\band\b/,
        /\bthat\b/,
        /\bthis\b/,
        /\bwith\b/,
        /\bfrom\b/,
        /\bhave\b/,
        /\bbeen\b/,
        /\bwhich\b/,
        /\btheir\b/,
      ],
      es: [
        /\bque\b/,
        /\bdel\b/,
        /\blos\b/,
        /\blas\b/,
        /\besta\b/,
        /\beste\b/,
        /\bpara\b/,
        /\bcon\b/,
        /\buna\b/,
        /\bpor\b/,
      ],
      fr: [
        /\bque\b/,
        /\bles\b/,
        /\bdes\b/,
        /\bcette\b/,
        /\bdans\b/,
        /\bpour\b/,
        /\bavec\b/,
        /\bsont\b/,
        /\bqui\b/,
        /\bpas\b/,
      ],
      de: [
        /\bder\b/,
        /\bdie\b/,
        /\bdas\b/,
        /\bund\b/,
        /\bist\b/,
        /\bdes\b/,
        /\bdem\b/,
        /\bden\b/,
        /\bnicht\b/,
        /\bsich\b/,
      ],
    };

    let maxScore = 0;
    let detectedLang = 'en';

    for (const [lang, regexes] of Object.entries(patterns)) {
      const score = regexes.filter((regex) => regex.test(sample)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    return detectedLang;
  }
}
