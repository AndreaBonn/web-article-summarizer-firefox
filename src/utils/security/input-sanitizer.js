/**
 * Input Sanitizer per AI API
 * Pulisce e valida il testo prima di inviarlo ai servizi AI
 */

export class InputSanitizer {
  /**
   * Sanitizza il testo per l'invio all'AI
   * @param {string} text - Testo da sanitizzare
   * @param {Object} options - Opzioni di sanitizzazione
   * @returns {string} Testo pulito e sicuro
   */
  static sanitizeForAI(text, options = {}) {
    const {
      maxLength = 10000,
      minLength = 10,
      removeHTML = true,
      removeURLs = false,
      preserveNewlines = true,
      removeCitations = false,
    } = options;

    if (!text || typeof text !== 'string') {
      throw new Error('Input non valido: deve essere una stringa');
    }

    let cleaned = text;

    // 1. Rimuovi HTML se richiesto
    if (removeHTML) {
      cleaned = this.stripHTML(cleaned);
    }

    // 2. Rimuovi URL se richiesto
    if (removeURLs) {
      cleaned = this.removeURLs(cleaned);
    }

    // 3. Rimuovi citazioni se richiesto
    if (removeCitations) {
      cleaned = this.removeCitations(cleaned);
    }

    // 4. Normalizza spazi bianchi
    cleaned = this.normalizeWhitespace(cleaned, preserveNewlines);

    // 5. Rimuovi caratteri di controllo
    cleaned = this.removeControlCharacters(cleaned);

    // 6. Escape prompt injection
    cleaned = this.escapePromptInjection(cleaned);

    // 7. Valida lunghezza
    cleaned = cleaned.trim();

    if (cleaned.length < minLength) {
      throw new Error(`Testo troppo corto (minimo ${minLength} caratteri)`);
    }

    // 8. Tronca se necessario
    if (cleaned.length > maxLength) {
      cleaned = this.truncateText(cleaned, maxLength);
    }

    return cleaned;
  }

  /**
   * Rimuove tag HTML e script
   */
  static stripHTML(html) {
    let text = html;

    // Rimuovi script, style, noscript
    text = text.replace(/<(script|style|noscript)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');

    // Rimuovi commenti HTML
    text = text.replace(/<!--[\s\S]*?-->/g, '');

    // Converti alcuni tag in newline
    text = text.replace(/<(br|hr)[^>]*>/gi, '\n');
    text = text.replace(/<\/(p|div|h[1-6]|li|tr|td|th|blockquote|pre)>/gi, '\n');

    // Rimuovi tutti i tag rimanenti
    text = text.replace(/<[^>]+>/g, ' ');

    // Decodifica entità HTML comuni
    text = this.decodeHTMLEntities(text);

    return text;
  }

  /**
   * Decodifica entità HTML
   */
  static decodeHTMLEntities(text) {
    const entities = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&ndash;': '–',
      '&mdash;': '—',
      '&hellip;': '...',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™',
    };

    let decoded = text;
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }

    // Decodifica entità numeriche (&#123; o &#x7B;)
    decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );

    return decoded;
  }

  /**
   * Rimuove URL dal testo
   */
  static removeURLs(text) {
    // Rimuovi URL completi
    let cleaned = text.replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/gi, '');

    // Rimuovi www.example.com
    cleaned = cleaned.replace(/www\.[^\s<>"{}|\\^`[\]]+/gi, '');

    return cleaned;
  }

  /**
   * Rimuove citazioni [1], [2], etc.
   */
  static removeCitations(text) {
    return text.replace(/\[\d+\]/g, '');
  }

  /**
   * Normalizza spazi bianchi
   */
  static normalizeWhitespace(text, preserveNewlines = true) {
    if (preserveNewlines) {
      // Normalizza spazi orizzontali
      text = text.replace(/[ \t]+/g, ' ');

      // Limita newline consecutive a massimo 2
      text = text.replace(/\n{3,}/g, '\n\n');

      // Rimuovi spazi a inizio/fine riga
      text = text.replace(/[ \t]+$/gm, '');
      text = text.replace(/^[ \t]+/gm, '');
    } else {
      // Converti tutto in spazi singoli
      text = text.replace(/\s+/g, ' ');
    }

    return text;
  }

  /**
   * Rimuove caratteri di controllo pericolosi
   */
  static removeControlCharacters(text) {
    // Rimuovi caratteri di controllo tranne tab, newline, carriage return
    // eslint-disable-next-line no-control-regex
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Previene prompt injection
   */
  static escapePromptInjection(text) {
    // Remove zero-width/invisible chars that can bypass pattern matching,
    // then normalize to NFKC (composes back to standard chars after decomposition)
    let normalized = text.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, '');
    normalized = normalized.normalize('NFKC');

    // Pattern pericolosi comuni — EN + IT + FR + ES + DE
    const dangerousPatterns = [
      // English
      /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi,
      /disregard\s+(all\s+)?(previous|above|prior)\s+instructions?/gi,
      /forget\s+(all\s+)?(previous|above|prior)\s+instructions?/gi,
      // Italiano
      /ignora\s+(tutte\s+le\s+)?istruzion[ie]\s+(precedenti|sopra)/gi,
      /dimentica\s+(tutte\s+le\s+)?istruzion[ie]\s+(precedenti|sopra)/gi,
      // Français
      /ignore[rz]?\s+(toutes\s+les\s+)?instructions?\s+(pr[eé]c[eé]dentes?|ci-dessus)/gi,
      /oublie[rz]?\s+(toutes\s+les\s+)?instructions?\s+(pr[eé]c[eé]dentes?|ci-dessus)/gi,
      // Español
      /ignora\s+(todas\s+las\s+)?instrucciones?\s+(anteriores?|previas?)/gi,
      /olvida\s+(todas\s+las\s+)?instrucciones?\s+(anteriores?|previas?)/gi,
      // Deutsch
      /ignorier[en]?\s+(alle\s+)?(vorherigen?\s+)?anweisungen/gi,
      /vergiss\s+(alle\s+)?(vorherigen?\s+)?anweisungen/gi,
      // Special tokens and role markers
      // Role markers at line start or after a sentence end (titles and questions are
      // collapsed to one line), not inside sentences like "operating system: Linux"
      /(?<=^|[.!?;][ \t]+)[ \t]*system\s*:\s*/gim,
      /(?<=^|[.!?;][ \t]+)[ \t]*assistant\s*:\s*/gim,
      /(?<=^|[.!?;][ \t]+)[ \t]*user\s*:\s*/gim,
      /<\|.*?\|>/g, // Special tokens tipo <|endoftext|>
      /\[INST\]/gi,
      /\[\/INST\]/gi,
    ];

    let safe = normalized;
    dangerousPatterns.forEach((pattern) => {
      safe = safe.replace(pattern, '');
    });

    return safe;
  }

  /**
   * Tronca il testo in modo intelligente
   */
  static truncateText(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }

    // Cerca di troncare a fine frase
    const truncated = text.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclamation = truncated.lastIndexOf('!');

    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);

    if (lastSentenceEnd > maxLength * 0.8) {
      // Se troviamo una fine frase nell'ultimo 20%, usa quella
      return truncated.slice(0, lastSentenceEnd + 1);
    }

    // Altrimenti tronca a fine parola
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.9) {
      return truncated.slice(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Sanitizza specificamente per analisi di pagine web
   */
  static sanitizeWebContent(html, options = {}) {
    return this.sanitizeForAI(html, {
      removeHTML: true,
      removeURLs: false, // Mantieni URL per contesto
      preserveNewlines: true,
      maxLength: 15000,
      ...options,
    });
  }

  /**
   * Sanitizza per domande/prompt utente
   */
  static sanitizeUserPrompt(text, options = {}) {
    return this.sanitizeForAI(text, {
      removeHTML: true,
      removeURLs: false,
      preserveNewlines: false,
      maxLength: 2000,
      minLength: 3,
      ...options,
    });
  }

  /**
   * Valida che il testo sia sicuro (senza eseguire sanitizzazione)
   */
  static validate(text, options = {}) {
    const { maxLength = 10000, minLength = 10 } = options;

    const issues = [];

    if (!text || typeof text !== 'string') {
      issues.push('Input non è una stringa valida');
      return { valid: false, issues };
    }

    if (text.length < minLength) {
      issues.push(`Testo troppo corto (${text.length} < ${minLength})`);
    }

    if (text.length > maxLength) {
      issues.push(`Testo troppo lungo (${text.length} > ${maxLength})`);
    }

    // Controlla pattern pericolosi
    if (/ignore\s+previous\s+instructions/i.test(text)) {
      issues.push('Possibile prompt injection rilevato');
    }

    if (/<script/i.test(text)) {
      issues.push('Script tag rilevato');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
