// Error Handler - Gestione centralizzata degli errori con feedback utente
import { Modal } from './modal.js';
import { Logger } from './logger.js';
import { I18n } from '../i18n/i18n.js';

const MAX_ERROR_LOGS = 50;
export const UNSUPPORTED_PAGE_MARKER = '[UNSUPPORTED_PAGE]';

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
      await Modal.error(fullMessage, I18n.t('modal.errorTitle'));
    }

    // Log per telemetria
    await this.logError(error, context);

    return errorMessage;
  }

  /**
   * Error kind that decides which recovery action the UI offers.
   * @returns {'missing_key'|'unsupported_page'|'page_unreachable'|'generic'}
   */
  static classifyError(error) {
    const message = error?.message || String(error);
    if (message.includes('API key non configurata')) return 'missing_key';
    if (message.includes(UNSUPPORTED_PAGE_MARKER)) return 'unsupported_page';
    if (
      message.includes('Could not establish connection') ||
      message.includes('Receiving end does not exist') ||
      message.includes('Impossibile comunicare con la pagina')
    ) {
      return 'page_unreachable';
    }
    return 'generic';
  }

  /**
   * Converte errori tecnici in messaggi user-friendly
   */
  static getErrorMessage(error) {
    const message = error.message || error.toString();

    // Errori di estrazione articolo
    if (message.includes('No article found')) {
      return I18n.t('error.noArticle');
    }
    if (message.includes('Article too short')) {
      return I18n.t('error.tooShort');
    }

    // Errori API
    if (message.includes('API key non configurata')) {
      return I18n.t('errorMsg.missingKey');
    }
    if (message.includes('401') || message.includes('Unauthorized')) {
      return I18n.t('error.invalidKey');
    }
    const rateLimitMatch = message.match(/\[RATE_LIMIT:(\w+)]/);
    if (rateLimitMatch) {
      return I18n.tf('errorMsg.rateLimitProvider', { provider: rateLimitMatch[1] });
    }
    if (message.includes('429') || message.includes('Too Many Requests')) {
      return I18n.t('errorMsg.rateLimit');
    }
    if (message.includes('403') || message.includes('Forbidden')) {
      return I18n.t('errorMsg.forbidden');
    }
    if (message.includes('500') || message.includes('Internal Server Error')) {
      return I18n.t('errorMsg.serverError');
    }
    if (message.includes('503') || message.includes('Service Unavailable')) {
      return I18n.t('errorMsg.unavailable');
    }

    // Errori di rete
    if (message.includes('Network') || message.includes('fetch')) {
      return I18n.t('error.network');
    }
    if (message.toLowerCase().includes('timeout')) {
      return I18n.t('errorMsg.timeout');
    }

    // Pagine che lo script di estrazione non può leggere
    if (message.includes(UNSUPPORTED_PAGE_MARKER)) {
      return I18n.t('errorMsg.unsupportedPage');
    }
    if (
      message.includes('Could not establish connection') ||
      message.includes('Receiving end does not exist') ||
      message.includes('Impossibile comunicare con la pagina')
    ) {
      return I18n.t('errorMsg.pageUnreachable');
    }

    // Errori di cache
    if (message.includes('QUOTA_BYTES')) {
      return I18n.t('errorMsg.storageFull');
    }

    // Errore non riconosciuto — messaggio generico per l'utente
    Logger.error('Errore non classificato:', message);
    return I18n.t('errorMsg.unexpected');
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
