// API Resilience Manager - Facade che compone RetryStrategy, FallbackStrategy, RateLimiter
import { Logger } from '../core/logger.js';
import { RetryStrategy, TEMPORARY_ERRORS, PERMANENT_ERRORS } from './retry-strategy.js';
import { FallbackStrategy } from './fallback-strategy.js';
import { RateLimiter } from './rate-limiter.js';

const MAX_API_LOGS = 100;
const MAX_FALLBACK_LOGS = 50;

export class APIResilience {
  constructor() {
    this._retry = new RetryStrategy();
    this._fallback = new FallbackStrategy();
    this._rateLimiter = new RateLimiter();

    // Esponi stato rate limiter per backward compatibility
    Object.defineProperty(this, 'requestQueue', {
      get: () => this._rateLimiter.requestQueue,
    });
    Object.defineProperty(this, 'isProcessing', {
      get: () => this._rateLimiter.isProcessing,
    });
    Object.defineProperty(this, 'rateLimits', {
      get: () => this._rateLimiter.rateLimits,
    });
  }

  // Costanti statiche esposte per backward compatibility
  static TEMPORARY_ERRORS = TEMPORARY_ERRORS;
  static PERMANENT_ERRORS = PERMANENT_ERRORS;

  /**
   * Chiama API con retry logic e exponential backoff
   * @param {Function} apiCall - Funzione che esegue la chiamata API
   * @param {Object} options - Opzioni di retry
   * @returns {Promise} Risultato della chiamata API
   */
  async callWithRetry(apiCall, options = {}) {
    return this._retry.callWithRetry(apiCall, options, (entry) => this.logApiCall(entry));
  }

  /**
   * Chiama API con fallback automatico su altri provider
   * @param {Object} params - Parametri della chiamata
   * @returns {Promise} Risultato della chiamata API
   */
  async callWithFallback(params) {
    return this._fallback.callWithFallback(
      params,
      (fn, opts) => this.callWithRetry(fn, opts),
      (entry) => this.logFallback(entry),
    );
  }

  /**
   * Determina l'ordine di fallback basato sul provider primario
   */
  getFallbackOrder(primaryProvider, apiKeys) {
    return this._fallback.getFallbackOrder(primaryProvider, apiKeys);
  }

  /**
   * Accoda richiesta e gestisce rate limiting
   */
  async enqueueRequest(provider, apiCall, onQueueUpdate = null) {
    return this._rateLimiter.enqueueRequest(provider, apiCall, onQueueUpdate);
  }

  /**
   * Processa la coda di richieste rispettando i rate limits
   */
  async processQueue(onQueueUpdate = null) {
    return this._rateLimiter.processQueue(onQueueUpdate);
  }

  /**
   * Controlla se possiamo fare una richiesta al provider
   */
  canMakeRequest(provider) {
    return this._rateLimiter.canMakeRequest(provider);
  }

  /**
   * Consuma un token dal rate limit
   */
  consumeToken(provider) {
    return this._rateLimiter.consumeToken(provider);
  }

  /**
   * Calcola tempo di attesa per il prossimo token
   */
  getWaitTime(provider) {
    return this._rateLimiter.getWaitTime(provider);
  }

  /**
   * Estrae status code dall'errore
   */
  extractStatusCode(error) {
    return this._retry.extractStatusCode(error);
  }

  /**
   * Log chiamata API per telemetria
   */
  async logApiCall(logEntry) {
    try {
      const result = await browser.storage.local.get(['apiLogs']);
      const logs = result.apiLogs || [];

      // Mantieni solo gli ultimi MAX_API_LOGS log
      logs.push(logEntry);
      if (logs.length > MAX_API_LOGS) {
        logs.shift();
      }

      await browser.storage.local.set({ apiLogs: logs });
    } catch (error) {
      Logger.error('Errore nel salvare log API:', error);
    }
  }

  /**
   * Log fallback per telemetria
   */
  async logFallback(logEntry) {
    try {
      const result = await browser.storage.local.get(['fallbackLogs']);
      const logs = result.fallbackLogs || [];

      logs.push(logEntry);
      if (logs.length > MAX_FALLBACK_LOGS) {
        logs.shift();
      }

      await browser.storage.local.set({ fallbackLogs: logs });
    } catch (error) {
      Logger.error('Errore nel salvare log fallback:', error);
    }
  }

  /**
   * Ottieni statistiche API
   */
  async getStats() {
    try {
      const result = await browser.storage.local.get(['apiLogs', 'fallbackLogs']);
      const apiLogs = result.apiLogs || [];
      const fallbackLogs = result.fallbackLogs || [];

      const successCount = apiLogs.filter((log) => log.success).length;
      const failureCount = apiLogs.filter((log) => !log.success && !log.retrying).length;
      const retryCount = apiLogs.filter((log) => log.retrying).length;
      const fallbackCount = fallbackLogs.length;

      const successRate =
        apiLogs.length > 0 ? ((successCount / apiLogs.length) * 100).toFixed(1) : 0;

      return {
        totalCalls: apiLogs.length,
        successCount,
        failureCount,
        retryCount,
        fallbackCount,
        successRate: parseFloat(successRate),
        recentLogs: apiLogs.slice(-10),
        recentFallbacks: fallbackLogs.slice(-10),
      };
    } catch (error) {
      Logger.error('Errore lettura statistiche API:', error);
      return null;
    }
  }

  /**
   * Pulisci log vecchi
   */
  async clearLogs() {
    try {
      await browser.storage.local.remove(['apiLogs', 'fallbackLogs']);
    } catch (error) {
      Logger.error('Errore pulizia log API:', error);
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
