// Popup Citations Module - Estratto da popup.js
// Gestisce: estrazione, visualizzazione e gestione citazioni

import { state, elements, showError } from './state.js';
import { citationsState, setCurrentCitations } from './features.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { CitationExtractor } from '../../utils/ai/citation-extractor.js';
import { CitationFormatter } from '../../utils/ai/citation-formatter.js';
import { Modal } from '../../utils/core/modal.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { Logger } from '../../utils/core/logger.js';

// Citations System
export async function extractCitations() {
  if (!state.currentArticle || !state.currentResults) {
    showError('Nessun articolo analizzato');
    return;
  }

  const btn = elements.extractCitationsBtn;
  btn.disabled = true;
  btn.textContent = '⏳ Estrazione...';

  try {
    const settings = await StorageManager.getSettings();
    const provider = elements.providerSelect.value;

    // Invia richiesta al background script (come per i riassunti)
    const response = await browser.runtime.sendMessage({
      action: 'extractCitations',
      article: state.currentArticle,
      provider: provider,
      settings: settings,
    });

    if (!response) {
      throw new Error('Il servizio non risponde. Riapri il popup e riprova.');
    }
    if (!response.success) {
      throw new Error(response.error);
    }

    // Aggiorna la variabile di stato condivisa in features.js
    const citationsData = response.result.citations;
    setCurrentCitations(citationsData);

    // Mostra citazioni
    displayCitationsData(citationsData);

    // Mostra badge "Da Cache" se applicabile
    if (response.result.fromCache) {
      const citationsHeader = document.querySelector('#citations-tab');
      if (citationsHeader && !citationsHeader.querySelector('.cache-badge')) {
        const badge = document.createElement('span');
        badge.className = 'cache-badge';
        badge.textContent = 'Da cache';
        badge.style.cssText =
          'background: #4caf50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;';
        citationsHeader.appendChild(badge);
      }
      Logger.info('📚 Citazioni caricate dalla cache');
    } else {
      Logger.info('🔄 Citazioni estratte da API');
    }

    // Salva nella cronologia
    if (state.currentArticle && state.currentArticle.url) {
      await HistoryManager.updateSummaryWithCitations(state.currentArticle.url, citationsData);
      Logger.info('💾 Citazioni salvate in cronologia');
    }
  } catch (error) {
    Logger.error('Errore estrazione citazioni:', error);
    elements.citationsContent.innerHTML = `
      <div class="error-box">
        <p>❌ ${HtmlSanitizer.escape(error.message)}</p>
        <button id="retryCitationsBtn" class="btn btn-primary">🔄 Riprova</button>
      </div>
    `;
    document.getElementById('retryCitationsBtn').addEventListener('click', extractCitations);
  } finally {
    btn.disabled = false;
    btn.textContent = '📖 Estrai Citazioni';
  }
}

export function displayCitations() {
  displayCitationsData(citationsState.value);
}

function displayCitationsData(citationsData) {
  if (!citationsData || !citationsData.citations || citationsData.citations.length === 0) {
    elements.citationsContent.innerHTML = `
      <div class="citations-empty">
        <p>📚 Nessuna citazione trovata in questo articolo</p>
      </div>
    `;
    return;
  }

  // Calcola il numero totale di citazioni con fallback
  const totalCitations =
    citationsData.total_citations || citationsData.totalCount || citationsData.citations.length;

  let html = `
    <div class="citations-header">
      <div class="citations-info">
        <strong>📚 ${totalCitations} citazioni trovate</strong>
      </div>
      <div class="citations-actions">
        <select id="citationStyleSelect" class="citation-style-select" title="Stile bibliografico per la citazione dell'articolo principale">
          <option value="apa">APA (Autore. (Anno). Titolo.)</option>
          <option value="mla">MLA (Autore. "Titolo.")</option>
          <option value="chicago">Chicago (Autore. "Titolo.")</option>
          <option value="ieee">IEEE (Autore, "Titolo,")</option>
          <option value="harvard">Harvard (Autore (Anno) Titolo.)</option>
        </select>
        <button id="copyCitationsBtn" class="btn-icon" title="Copia Bibliografia">📋</button>
      </div>
    </div>

    <div class="article-citation-box">
      <h4>📄 Citazione Articolo Principale</h4>
      <p class="citation-style-hint">Lo stile selezionato sopra si applica a questa citazione</p>
      <div id="mainCitationText" class="citation-text"></div>
    </div>

    <div class="citations-list">
  `;

  citationsData.citations.forEach((citation) => {
    const typeIcon =
      {
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
      }[citation.type] || '📌';

    // Usa quote_text dalla nuova struttura (contenuto sanitizzato)
    const quoteText = citation.quote_text || citation.text || '';
    const escapedText = HtmlSanitizer.escape(quoteText);
    const safeAuthor = HtmlSanitizer.escape(citation.author || '');
    const safeContext = HtmlSanitizer.escape(citation.context || '');
    const safeSource = HtmlSanitizer.escape(citation.source || '');
    const safeParagraph = HtmlSanitizer.escape(String(citation.paragraph || ''));

    html += `
      <div class="citation-item"
           data-citation-id="${HtmlSanitizer.escape(String(citation.id))}"
           data-citation-text="${escapedText}"
           data-paragraph="${safeParagraph}"
           class="citation-item-clickable"
           title="Clicca per evidenziare nell'articolo">
        <div class="citation-header">
          <span class="citation-icon">${typeIcon}</span>
          <span class="citation-number">#${HtmlSanitizer.escape(String(citation.id))}</span>
          ${citation.author ? `<span class="citation-author">${safeAuthor}</span>` : ''}
          ${citation.paragraph ? `<span class="citation-paragraph">§${safeParagraph}</span>` : ''}
        </div>
        ${quoteText ? `<div class="citation-text">"${HtmlSanitizer.escape(quoteText.substring(0, 200))}${quoteText.length > 200 ? '...' : ''}"</div>` : ''}
        ${citation.context ? `<div class="citation-context">${safeContext}</div>` : ''}
        <div class="citation-meta">
          <span class="citation-type">${getCitationTypeLabel(citation.type)}</span>
          ${citation.source ? `<span class="citation-source">📚 ${safeSource}</span>` : ''}
          ${citation.year ? `<span class="citation-year">📅 ${HtmlSanitizer.escape(String(citation.year || ''))}</span>` : ''}
        </div>
      </div>
    `;
  });

  html += `</div>`;

  elements.citationsContent.innerHTML = html;

  // Mostra citazione principale
  updateMainCitation('apa');

  // Event listeners
  document.getElementById('citationStyleSelect').addEventListener('change', (e) => {
    updateMainCitation(e.target.value);
  });

  document
    .getElementById('copyCitationsBtn')
    .addEventListener('click', () => copyCitationsData(citationsData));

  // Click handler per evidenziare citazioni nell'articolo
  document.querySelectorAll('.citation-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const citationText = item.dataset.citationText;
      const paragraph = item.dataset.paragraph;

      // ✨ PRIORITÀ: Cerca sempre il testo della citazione nella pagina
      if (citationText) {
        const success = await highlightCitationInArticle(citationText);

        // Se non trova il testo, prova con il paragrafo come fallback
        if (!success && paragraph) {
          await highlightParagraph(paragraph);
        }
      }
      // Fallback: usa solo il paragrafo se non c'è testo
      else if (paragraph) {
        await highlightParagraph(paragraph);
      }
    });
  });
}

function updateMainCitation(style) {
  // Usa state.currentArticle invece di currentCitations.article
  const citationText = CitationExtractor.formatCitation(state.currentArticle, style);
  document.getElementById('mainCitationText').textContent = citationText;
}

function getCitationTypeLabel(type) {
  return CitationFormatter.getCitationTypeLabel(type);
}

async function copyCitationsData(citationsData) {
  if (!citationsData || !state.currentArticle) return;

  const style = document.getElementById('citationStyleSelect').value;
  const bibliography = CitationExtractor.generateBibliography(
    state.currentArticle,
    citationsData.citations,
    style,
  );

  try {
    await navigator.clipboard.writeText(bibliography);
    const btn = document.getElementById('copyCitationsBtn');
    const originalText = btn.textContent;
    btn.textContent = '✓ Copiato!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  } catch (error) {
    Logger.error('Errore copia citazioni:', error);
    await Modal.error(I18n.t('common.copyError'), I18n.t('modal.errorTitle'));
  }
}

async function highlightParagraph(paragraphNumber) {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    // Invia messaggio al content script per evidenziare il paragrafo
    await browser.tabs.sendMessage(tab.id, {
      action: 'highlightParagraph',
      paragraphNumber: paragraphNumber,
    });

    Logger.debug(`✅ Paragrafo §${paragraphNumber} evidenziato`);
  } catch (error) {
    Logger.error('Errore highlight paragrafo:', error);
    // Fallback: prova con il testo
    return false;
  }
  return true;
}

async function highlightCitationInArticle(citationText) {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    Logger.debug('🔍 Ricerca citazione nella pagina:', citationText.substring(0, 50) + '...');

    // Invia messaggio al content script per evidenziare il testo
    const response = await browser.tabs.sendMessage(tab.id, {
      action: 'highlightText',
      text: citationText,
    });

    if (response && response.success) {
      Logger.debug('✅ Testo citazione evidenziato');
      return true;
    } else {
      Logger.warn('⚠️ Citazione non trovata nella pagina');
      return false;
    }
  } catch (error) {
    Logger.error('❌ Errore highlight citazione:', error);
    // Non mostrare modal per non disturbare l'utente
    return false;
  }
}
