import { unwrapServiceResponse } from '../core/service-response.js';
import { I18n } from '../i18n/i18n.js';

/**
 * Asks the background service worker for one LLM completion. Extension pages go through here
 * instead of APIOrchestrator so the API key is decrypted only in the service worker.
 * @param {string} provider
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{temperature?: number, maxTokens?: number, responseFormat?: 'json'}} [options]
 * @returns {Promise<string>} the completion text
 */
export async function requestCompletion(provider, systemPrompt, userPrompt, options = {}) {
  const response = await browser.runtime.sendMessage({
    action: 'generateCompletion',
    provider,
    systemPrompt,
    userPrompt,
    options,
  });
  return unwrapServiceResponse(response, I18n.t('error.serviceUnavailable'));
}
