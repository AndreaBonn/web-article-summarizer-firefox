// Error Handler - Gestione centralizzata degli errori con feedback utente
import { Modal } from './modal.js';
import { Logger } from './logger.js';

const MAX_ERROR_LOGS = 50;

export class ErrorHandler {
  /**
   * Mostra un errore all'utente con feedback visivo
   */
  static async showError(error, context = '') {
    const errorMessage = this.getErrorMessage(error);
    const fullMessage = context ? `${context}: ${errorMessage}` : errorMessage;

    Logger.error('Errore:', error);

    // Mostra notifica visiva all'utente (Modal richiede DOM — non disponibile nel service worker)
    if (typeof document !== 'undefined' && document.getElementById('customModal')) {
      await Modal.error(fullMessage, 'Errore');
    }

    // Log per telemetria
    await this.logError(error, context);

    return errorMessage;
  }

  /**
   * Converte errori tecnici in messaggi user-friendly
   */
  static getErrorMessage(error) {
    const message = error.message || error.toString();

    // Errori di estrazione articolo
    if (message.includes('No article found')) {
      return 'Nessun articolo rilevato in questa pagina. Prova con un articolo di blog o news.';
    }
    if (message.includes('Article too short')) {
      return 'Articolo troppo breve per essere riassunto (minimo 200 parole).';
    }

    // Errori API
    if (message.includes('API key non configurata')) {
      return "API key non configurata. Clicca sull'icona ⚙️ per configurare.";
    }
    if (message.includes('401') || message.includes('Unauthorized')) {
      return 'API key non valida. Verifica la configurazione nelle impostazioni.';
    }
    const rateLimitMatch = message.match(/\[RATE_LIMIT:(\w+)]/);
    if (rateLimitMatch) {
      const provider = rateLimitMatch[1];
      return (
        `Rate limit raggiunto per ${provider}. ` +
        'Non è un problema del sistema: la tua chiave API ha esaurito le richieste disponibili. ' +
        'Puoi cambiare chiave API o passare a un altro provider nelle impostazioni (⚙️).'
      );
    }
    if (message.includes('429') || message.includes('Too Many Requests')) {
      return (
        'Rate limit raggiunto. La tua chiave API ha esaurito le richieste disponibili. ' +
        'Puoi cambiare chiave API o passare a un altro provider nelle impostazioni (⚙️).'
      );
    }
    if (message.includes('403') || message.includes('Forbidden')) {
      return 'Accesso negato. Verifica i permessi della tua API key.';
    }
    if (message.includes('500') || message.includes('Internal Server Error')) {
      return 'Errore del server API. Riprova tra qualche minuto.';
    }
    if (message.includes('503') || message.includes('Service Unavailable')) {
      return 'Servizio temporaneamente non disponibile. Riprova più tardi.';
    }

    // Errori di rete
    if (message.includes('Network') || message.includes('fetch')) {
      return 'Errore di connessione. Verifica la tua connessione internet.';
    }
    if (message.toLowerCase().includes('timeout')) {
      return 'Richiesta scaduta. Il server ha impiegato troppo tempo a rispondere.';
    }

    // Errori di Chrome Extension
    if (message.includes('chrome://') || message.includes('chrome-extension://')) {
      return 'Impossibile analizzare pagine interne di Chrome.';
    }
    if (
      message.includes('Could not establish connection') ||
      message.includes('Receiving end does not exist')
    ) {
      return 'Impossibile comunicare con la pagina. Ricarica la pagina (F5) e riprova.';
    }

    // Errori di cache
    if (message.includes('QUOTA_BYTES')) {
      return 'Spazio di archiviazione esaurito. Pulisci la cache nelle impostazioni.';
    }

    // Errore non riconosciuto — messaggio generico per l'utente
    Logger.error('Errore non classificato:', message);
    return 'Si è verificato un errore imprevisto. Riprova.';
  }

  /**
   * Log errore per telemetria
   */
  static async logError(error, context = '') {
    try {
      const result = await browser.storage.local.get(['errorLogs']);
      const logs = result.errorLogs || [];

      const entry = {
        message: this.getErrorMessage(error),
        originalMessage: (error.message || '').substring(0, 200),
        errorName: error.name,
        context,
        timestamp: Date.now(),
        url: (() => {
          try {
            if (typeof window !== 'undefined' && window.location) {
              const u = new URL(window.location.href);
              return u.origin + u.pathname;
            }
            return 'background-sw';
          } catch {
            return 'unknown';
          }
        })(),
      };

      // Preserve cause chain and stack for debugging
      if (error.cause) {
        entry.cause = error.cause.message || String(error.cause);
      }
      if (error.stack) {
        entry.stack = error.stack.split('\n').slice(0, 5).join('\n');
      }

      logs.push(entry);

      // Mantieni solo gli ultimi MAX_ERROR_LOGS errori
      if (logs.length > MAX_ERROR_LOGS) {
        logs.shift();
      }

      await browser.storage.local.set({ errorLogs: logs });
    } catch (logError) {
      Logger.error('Impossibile salvare log errore:', logError);
    }
  }

  /**
   * Ottieni statistiche errori
   */
  static async getErrorStats() {
    try {
      const result = await browser.storage.local.get(['errorLogs']);
      const logs = result.errorLogs || [];

      const last24h = logs.filter((log) => Date.now() - log.timestamp < 24 * 60 * 60 * 1000);

      const errorTypes = {};
      last24h.forEach((log) => {
        const type = this.categorizeError(log.message);
        errorTypes[type] = (errorTypes[type] || 0) + 1;
      });

      return {
        total: logs.length,
        last24h: last24h.length,
        errorTypes,
      };
    } catch (error) {
      Logger.error('Errore nel calcolare statistiche errori:', error);
      return null;
    }
  }

  /**
   * Categorizza errore per statistiche
   */
  static categorizeError(message) {
    if (message.includes('API') || message.includes('401') || message.includes('429')) {
      return 'API';
    }
    if (message.includes('Network') || message.includes('fetch')) {
      return 'Network';
    }
    if (message.includes('article') || message.includes('extract')) {
      return 'Extraction';
    }
    if (message.includes('cache') || message.includes('storage')) {
      return 'Storage';
    }
    return 'Other';
  }

  /**
   * Pulisci log errori
   */
  static async clearErrorLogs() {
    try {
      await browser.storage.local.remove(['errorLogs']);
    } catch (error) {
      Logger.warn('Impossibile pulire log errori:', error);
    }
  }

  /**
   * Wrapper per try-catch con gestione automatica errori.
   * Mostra l'errore all'utente e lo ri-propaga al chiamante.
   */
  static async handleAsync(asyncFn, context = '') {
    try {
      return await asyncFn();
    } catch (error) {
      await this.showError(error, context);
      throw error;
    }
  }
}
