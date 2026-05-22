// Multi-Analysis Manager - Gestione analisi multi-articolo
// Orchestrazione, correlazione, persistenza.
// Generazione AI delegata a multi-analysis-generators.js.

import { StorageManager } from '../storage/storage-manager.js';
import { APIOrchestrator as APIClient } from '../ai/api-orchestrator.js';
import { Logger } from './logger.js';
import {
  generateGlobalSummary,
  generateComparison,
  generateQA,
} from './multi-analysis-generators.js';

export class MultiAnalysisManager {
  static async checkArticlesRelation(articles) {
    // Usa l'AI per analisi semantica intelligente
    const settings = await StorageManager.getSettings();
    const provider = settings.selectedProvider || 'groq';
    const apiKey = await StorageManager.getApiKey(provider);

    if (!apiKey) {
      Logger.warn('API key non disponibile: verifica correlazione saltata');
      return { related: true, reason: 'Verifica saltata: API key non configurata', skipped: true };
    }

    try {
      return await this.checkCorrelationWithAI(articles, provider, apiKey);
    } catch (error) {
      Logger.error('Errore verifica correlazione:', error);
      return { related: true, reason: `Verifica saltata: ${error.message}`, skipped: true };
    }
  }

  static async checkCorrelationWithAI(articles, provider, apiKey) {
    // Prepara sintesi degli articoli per l'analisi
    const articlesInfo = articles
      .map((a, index) => {
        const content = a.translation
          ? a.translation.text.substring(0, 300)
          : a.summary.substring(0, 300);
        return `
ARTICOLO ${index + 1}:
Titolo: ${a.article.title}
Estratto: ${content}...
`;
      })
      .join('\n');

    const systemPrompt = `Sei un esperto analista di contenuti specializzato nell'identificare relazioni tematiche tra articoli.

Analizza i seguenti articoli e determina se sono sufficientemente correlati per un'analisi comparativa.

Rispondi SOLO con un JSON valido nel formato:
{
  "related": true/false,
  "confidence": 0.0-1.0,
  "reason": "spiegazione breve"
}

Considera correlati articoli che:
- Trattano lo stesso argomento da prospettive diverse
- Sono dello stesso dominio (es. tecnologia, politica, scienza)
- Condividono almeno 2-3 temi in comune
- Possono essere comparati in modo significativo

NON considerare correlati articoli che:
- Non hanno NESSUN tema in comune
- Appartengono a domini completamente diversi senza punti di contatto`;

    const userPrompt = `Analizza la correlazione tra questi ${articles.length} articoli:

${articlesInfo}

Rispondi SOLO con il JSON.`;

    try {
      const response = await APIClient.generateCompletion(
        provider,
        apiKey,
        systemPrompt,
        userPrompt,
        {
          temperature: 0.1,
          maxTokens: 500,
          responseFormat: 'json',
        },
      );

      const cleanedResponse = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const result = JSON.parse(cleanedResponse);

      return {
        related: result.related !== false,
        reason: result.reason || null,
        confidence: result.confidence || 0.5,
      };
    } catch (error) {
      Logger.error('Errore parsing correlazione:', error);
      return { related: true, reason: null };
    }
  }

  static async analyzeArticles(articles, options, progressCallback) {
    const result = {
      articles: articles.map((a) => ({
        id: a.id,
        title: a.article.title,
        url: a.article.url,
      })),
      timestamp: Date.now(),
      globalSummary: null,
      comparison: null,
      qa: null,
    };

    const settings = await StorageManager.getSettings();
    const provider = settings.selectedProvider || 'groq';
    const apiKey = await StorageManager.getApiKey(provider);

    if (!apiKey) {
      throw new Error('API key non configurata. Vai nelle impostazioni.');
    }

    result.metadata = { provider };

    if (options.globalSummary) {
      progressCallback('Generazione riassunto globale...', 30);
      result.globalSummary = await generateGlobalSummary(articles, provider, apiKey);
    }

    if (options.comparison) {
      progressCallback('Confronto idee tra articoli...', 55);
      result.comparison = await generateComparison(articles, provider, apiKey);
    }

    if (options.qa) {
      progressCallback('Generazione Q&A...', 75);
      const qaResult = await generateQA(articles, provider, apiKey);
      result.qa = {
        interactive: true,
        articles: articles.map((a) => ({
          id: a.id,
          title: a.article.title,
          summary: a.summary,
          content: a.article.content || a.summary,
        })),
        questions: Array.isArray(qaResult) ? qaResult : qaResult.questions || [],
      };
    }

    progressCallback('Completamento...', 95);

    return result;
  }

  static async saveAnalysis(analysis) {
    const result = await browser.storage.local.get(['multiAnalysisHistory']);
    let history = result.multiAnalysisHistory || [];

    analysis.id = Date.now();

    history.unshift(analysis);

    if (history.length > 30) {
      history = history.slice(0, 30);
    }

    await browser.storage.local.set({ multiAnalysisHistory: history });
  }

  static async getAnalysisHistory() {
    const result = await browser.storage.local.get(['multiAnalysisHistory']);
    return result.multiAnalysisHistory || [];
  }

  static async getAnalysisById(id) {
    const history = await this.getAnalysisHistory();
    return history.find((a) => a.id === id);
  }

  static async deleteAnalysis(id) {
    const history = await this.getAnalysisHistory();
    const filtered = history.filter((a) => a.id !== id);
    await browser.storage.local.set({ multiAnalysisHistory: filtered });
  }
}
