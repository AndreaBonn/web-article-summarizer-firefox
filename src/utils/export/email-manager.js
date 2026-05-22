// Email Manager - Gestione email salvate e invio tramite mailto
export class EmailManager {
  // Salva una nuova email nella lista
  static async saveEmail(email) {
    const result = await browser.storage.local.get(['savedEmails']);
    let emails = result.savedEmails || [];

    // Aggiungi solo se non esiste già
    if (!emails.includes(email)) {
      emails.unshift(email); // Aggiungi all'inizio

      // Mantieni max 10 email
      if (emails.length > 10) {
        emails = emails.slice(0, 10);
      }

      await browser.storage.local.set({ savedEmails: emails });
    }
  }

  // Ottieni tutte le email salvate
  static async getSavedEmails() {
    const result = await browser.storage.local.get(['savedEmails']);
    return result.savedEmails || [];
  }

  // Rimuovi un'email dalla lista
  static async removeEmail(email) {
    const result = await browser.storage.local.get(['savedEmails']);
    let emails = result.savedEmails || [];
    emails = emails.filter((e) => e !== email);
    await browser.storage.local.set({ savedEmails: emails });
  }

  // Valida formato email
  static isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // Genera il contenuto dell'email formattato
  static formatEmailContent(article, summary, keyPoints, translation = null, qaList = null) {
    let content = '';

    // Oggetto
    const subject = `Riassunto: ${(article.title || '').replace(/[\r\n]/g, ' ')}`;

    // Corpo
    content += `RIASSUNTO ARTICOLO\n`;
    content += `${'='.repeat(60)}\n\n`;

    content += `📄 Titolo: ${article.title}\n`;
    content += `🔗 URL: ${article.url}\n`;
    content += `📊 Lunghezza: ${article.wordCount} parole • ${article.readingTimeMinutes} min lettura\n`;
    content += `📅 Generato il: ${new Date().toLocaleDateString('it-IT')}\n\n`;

    content += `${'='.repeat(60)}\n\n`;

    // Riassunto (if included)
    if (summary) {
      content += `📝 RIASSUNTO\n`;
      content += `${'-'.repeat(60)}\n\n`;
      content += `${summary}\n\n`;
      content += `${'='.repeat(60)}\n\n`;
    }

    // Punti chiave (if included)
    if (keyPoints && keyPoints.length > 0) {
      content += `🔑 PUNTI CHIAVE\n`;
      content += `${'-'.repeat(60)}\n\n`;

      keyPoints.forEach((point, index) => {
        content += `${index + 1}. ${point.title} (§${point.paragraphs})\n`;
        content += `   ${point.description}\n\n`;
      });

      content += `${'='.repeat(60)}\n\n`;
    }

    // Traduzione (se presente)
    if (translation) {
      content += `🌍 TRADUZIONE\n`;
      content += `${'-'.repeat(60)}\n\n`;
      content += `${translation}\n\n`;
      content += `${'='.repeat(60)}\n\n`;
    }

    // Q&A (se presenti)
    if (qaList && qaList.length > 0) {
      content += `💬 DOMANDE E RISPOSTE\n`;
      content += `${'-'.repeat(60)}\n\n`;

      qaList.forEach((qa, index) => {
        content += `Q${index + 1}: ${qa.question}\n`;
        content += `R${index + 1}: ${qa.answer}\n\n`;
      });

      content += `${'='.repeat(60)}\n\n`;
    }

    // Rimuovi ultimo separatore se presente
    if (content.endsWith(`${'='.repeat(60)}\n\n`)) {
      content = content.slice(0, -`${'='.repeat(60)}\n\n`.length);
    }

    content += `${'='.repeat(60)}\n`;
    content += `Generato con AI Article Summarizer\n`;

    return { subject, body: content };
  }

  // Apri client email con mailto
  static openEmailClient(recipientEmail, subject, body) {
    // Sanitize email to prevent header injection (%0d%0a, newlines)
    const cleanEmail = recipientEmail.replace(/[\r\n\t%]/g, '').trim();
    if (!this.isValidEmail(cleanEmail)) {
      throw new Error('Indirizzo email non valido');
    }

    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    const mailtoLink = `mailto:${encodeURIComponent(cleanEmail)}?subject=${encodedSubject}&body=${encodedBody}`;

    browser.tabs.create({ url: mailtoLink, active: false });
  }
}
