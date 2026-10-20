// Citation Formatter - Formattazione citazioni in stili bibliografici

export const CitationFormatter = {
  /**
   * Formatta citazioni in diversi stili bibliografici
   */
  formatCitation(article, style = 'apa') {
    // Validazione input
    if (!article || typeof article !== 'object') {
      return 'Articolo non disponibile';
    }

    // Plain text on purpose: most consumers use textContent, PDF, Markdown or the clipboard.
    // HTML sinks (history detail) must escape the result themselves.
    const author = article.author || article.byline || 'Autore Sconosciuto';
    const title = article.title || 'Titolo non disponibile';
    const url = article.url || '';
    const date = article.publishedDate || article.date || new Date().toISOString().split('T')[0];
    const accessDate = article.accessDate || new Date().toISOString().split('T')[0];

    // Estrai nome dominio per il nome del sito
    let siteName = 'Web';
    try {
      const urlObj = new URL(url);
      siteName = urlObj.hostname.replace('www.', '');
    } catch {
      // Ignora errori URL
    }

    const year = date.split('-')[0];
    const [, m, d] = date.split('-');
    const [ay, am, ad] = accessDate.split('-');

    switch (style.toLowerCase()) {
      case 'apa':
        // APA 7th Edition
        return `${author}. (${year}). ${title}. ${siteName}. ${url}`;

      case 'mla': {
        // MLA 9th Edition
        const monthNames = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const accessMonth = monthNames[parseInt(am) - 1];
        return `${author}. "${title}." ${siteName}, ${d} ${monthNames[parseInt(m) - 1]}. ${year}, ${url}. Accessed ${ad} ${accessMonth}. ${ay}.`;
      }

      case 'chicago':
        // Chicago 17th Edition
        return `${author}. "${title}." ${siteName}. ${date}. ${url}.`;

      case 'ieee':
        // IEEE
        return `${author}, "${title}," ${siteName}, ${date}. [Online]. Available: ${url}. [Accessed: ${accessDate}].`;

      case 'harvard':
        // Harvard
        return `${author} (${year}) ${title}. Available at: ${url} (Accessed: ${accessDate}).`;

      default:
        return this.formatCitation(article, 'apa');
    }
  },

  /**
   * Genera bibliografia completa
   */
  generateBibliography(article, citations, style = 'apa') {
    let bibliography = `# Bibliografia\n\n`;
    bibliography += `**Stile:** ${style.toUpperCase()}\n\n`;
    bibliography += `## Articolo Principale\n\n`;
    bibliography += this.formatCitation(article, style) + '\n\n';

    if (citations && citations.length > 0) {
      bibliography += `## Fonti Citate nell'Articolo (${citations.length})\n\n`;
      citations.forEach((citation, index) => {
        // Numero citazione
        bibliography += `${index + 1}. `;

        // Autore
        if (citation.author && citation.author !== 'Non specificato' && citation.author !== 'N/A') {
          bibliography += `**${citation.author}**`;
        } else {
          bibliography += `**Fonte non specificata**`;
        }

        // Anno
        if (citation.year) {
          bibliography += ` (${citation.year})`;
        }

        bibliography += '\n';

        // Testo citazione
        const quoteText = citation.quote_text || citation.text || '';
        if (quoteText) {
          bibliography += `   "${quoteText.substring(0, 150)}${quoteText.length > 150 ? '...' : ''}"\n`;
        }

        // Fonte/Pubblicazione
        if (citation.source && citation.source !== 'N/A') {
          bibliography += `   📚 Fonte: ${citation.source}\n`;
        }

        // Contesto
        if (citation.context) {
          bibliography += `   📝 Contesto: ${citation.context}\n`;
        }

        // Tipo e posizione
        const typeLabel = this.getCitationTypeLabel(citation.type);
        bibliography += `   🏷️ Tipo: ${typeLabel}`;
        if (citation.paragraph) {
          bibliography += ` | 📍 Paragrafo: §${citation.paragraph}`;
        }
        bibliography += '\n';

        // Informazioni aggiuntive
        if (citation.additional_info) {
          const info = citation.additional_info;
          const details = [];
          if (info.study_title) details.push(`Studio: "${info.study_title}"`);
          if (info.journal) details.push(`Journal: ${info.journal}`);
          if (info.doi) details.push(`DOI: ${info.doi}`);
          if (info.url) details.push(`URL: ${info.url}`);

          if (details.length > 0) {
            bibliography += `   ℹ️ ${details.join(' | ')}\n`;
          }
        }

        bibliography += '\n';
      });
    }

    return bibliography;
  },

  getCitationTypeIcon(type) {
    const icons = {
      direct_quote: '💬',
      indirect_quote: '💭',
      study_reference: '🔬',
      statistic: '📊',
      expert_opinion: '👤',
      book_reference: '📖',
      article_reference: '📄',
      report_reference: '📋',
      organization_data: '🏢',
      web_source: '🌐',
    };
    return icons[type] || '📌';
  },

  getCitationTypeLabel(type) {
    const labels = {
      direct_quote: 'Citazione Diretta',
      indirect_quote: 'Citazione Indiretta',
      study_reference: 'Studio/Ricerca',
      statistic: 'Statistica',
      expert_opinion: 'Opinione Esperto',
      book_reference: 'Libro',
      article_reference: 'Articolo',
      report_reference: 'Report',
      organization_data: 'Dati Organizzazione',
      web_source: 'Fonte Web',
    };
    return labels[type] || 'Altro';
  },
};
