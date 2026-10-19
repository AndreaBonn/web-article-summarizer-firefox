// Popup Citations Module - Estratto da popup.js
// Gestisce: estrazione, visualizzazione e gestione citazioni

import { state, elements, showError } from './state.js';
import { citationsState, setCurrentCitations } from './features.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { CitationExtractor } from '../../utils/ai/citation-extractor.js';
import { Toast } from '../../utils/core/toast.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { Logger } from '../../utils/core/logger.js';
import { unwrapServiceResponse } from '../../utils/core/service-response.js';
import { highlightCitation, renderCitationsHtml } from './citations-render.js';

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

    const result = unwrapServiceResponse(
      response,
      'Il servizio non risponde. Riapri il popup e riprova.',
    );

    // Aggiorna la variabile di stato condivisa in features.js
    const citationsData = result.citations;
    setCurrentCitations(citationsData);

    // Mostra citazioni
    displayCitationsData(citationsData);

    // Mostra badge "Da Cache" se applicabile
    if (result.fromCache) {
      const citationsHeader = document.getElementById('citationsTab');
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

// Pannello citazioni allo stato iniziale (nessuna estrazione), con il pulsante riagganciato
export function renderCitationsEmpty() {
  elements.citationsContent.innerHTML = `
    <div class="citations-empty">
      <p>${HtmlSanitizer.escape(I18n.t('citations.empty'))}</p>
      <button id="extractCitationsBtn" class="btn btn-primary">
        ${HtmlSanitizer.escape(I18n.t('citations.button'))}
      </button>
    </div>
  `;
  elements.extractCitationsBtn = document.getElementById('extractCitationsBtn');
  elements.extractCitationsBtn.addEventListener('click', extractCitations, { once: true });
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

  elements.citationsContent.innerHTML = renderCitationsHtml(citationsData);

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
      await highlightCitation(
        { citationText: item.dataset.citationText, paragraph: item.dataset.paragraph },
        { highlightText: highlightCitationInArticle, highlightParagraph },
      );
    });
  });
}

function updateMainCitation(style) {
  // Usa state.currentArticle invece di currentCitations.article
  const citationText = CitationExtractor.formatCitation(state.currentArticle, style);
  document.getElementById('mainCitationText').textContent = citationText;
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
    Toast.show(I18n.t('common.copyError'), 'error');
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
