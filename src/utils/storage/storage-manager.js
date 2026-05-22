// Storage Manager - Gestione API keys e impostazioni
// Le API key sono salvate in browser.storage.local che è sandboxed per estensione.
// Non viene usata cifratura custom perché in un'estensione Chrome il codice sorgente
// è sempre leggibile — un segreto hardcoded non offre protezione reale.

import { TranslationCache } from './translation-cache.js';
import { Logger } from '../core/logger.js';

export class StorageManager {
  // API Keys management
  static async saveApiKey(provider, apiKey) {
    const result = await browser.storage.local.get(['apiKeys']);
    const apiKeys = result.apiKeys || {};
    apiKeys[provider] = apiKey;
    await browser.storage.local.set({ apiKeys });
  }

  static async getApiKey(provider) {
    const result = await browser.storage.local.get(['apiKeys']);
    if (!result.apiKeys || !result.apiKeys[provider]) {
      return null;
    }
    const stored = result.apiKeys[provider];
    // Legacy v1.x keys were encrypted objects — prompt user to re-enter
    if (typeof stored === 'object' && stored.encrypted) {
      throw new Error(
        `La API key di ${provider} è in un formato obsoleto (v1.x). Reinserisci la chiave nelle impostazioni.`,
      );
    }
    return stored;
  }

  // Settings management
  static async saveSettings(settings) {
    await browser.storage.local.set({ settings });
  }

  static async getSettings() {
    const result = await browser.storage.local.get(['settings']);
    return (
      result.settings || {
        selectedProvider: 'groq',
        contentType: 'auto',
        summaryLength: 'medium',
        tone: 'neutral',
        saveHistory: true,
      }
    );
  }

  // Language management (output language for AI)
  static async saveSelectedLanguage(language) {
    await browser.storage.local.set({ selectedLanguage: language });
  }

  static async getSelectedLanguage() {
    const result = await browser.storage.local.get(['selectedLanguage']);
    return result.selectedLanguage || 'it'; // Default: Italiano
  }

  // UI Language management (interface language)
  static async saveUILanguage(language) {
    await browser.storage.local.set({ uiLanguage: language });
  }

  static async getUILanguage() {
    const result = await browser.storage.local.get(['uiLanguage']);
    return result.uiLanguage || 'it'; // Default: Italiano
  }

  // Content Type management
  static async saveSelectedContentType(contentType) {
    await browser.storage.local.set({ selectedContentType: contentType });
  }

  static async getSelectedContentType() {
    const result = await browser.storage.local.get(['selectedContentType']);
    return result.selectedContentType || 'auto'; // Default: Rilevamento automatico
  }

  // Translation cache — delegates to TranslationCache module
  static async getCachedTranslation(url, provider, targetLanguage) {
    return TranslationCache.get(url, provider, targetLanguage);
  }

  static async saveCachedTranslation(url, provider, targetLanguage, translation, originalLanguage) {
    return TranslationCache.save(url, provider, targetLanguage, translation, originalLanguage);
  }

  static async clearTranslationCacheEntry(url, provider, targetLanguage) {
    return TranslationCache.clearEntry(url, provider, targetLanguage);
  }

  // Statistics — non-critical, must not break the summary generation flow
  static async updateStats(provider, wordCount, generationTime) {
    try {
      const result = await browser.storage.local.get(['stats']);
      const stats = result.stats || {
        totalSummaries: 0,
        totalWords: 0,
        providerUsage: {},
        totalTime: 0,
      };

      stats.totalSummaries++;
      stats.totalWords += wordCount;
      stats.providerUsage[provider] = (stats.providerUsage[provider] || 0) + 1;
      stats.totalTime += generationTime;

      await browser.storage.local.set({ stats });
    } catch (error) {
      Logger.warn('Impossibile aggiornare statistiche:', error.message);
    }
  }
}
