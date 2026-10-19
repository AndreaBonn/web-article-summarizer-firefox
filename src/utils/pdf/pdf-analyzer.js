// PDFAnalyzer - Estrazione e analisi PDF
import * as pdfjsLib from 'pdfjs-dist';
import { Logger } from '../core/logger.js';
import { PDFCacheManager } from './pdf-cache-manager.js';
import { StorageManager } from '../storage/storage-manager.js';
import { getLanguageNameForPrompt } from '../i18n/language-names.js';
import { parseLLMJson } from '../ai/json-repair.js';
import { APIOrchestrator as APIClient } from '../ai/api-orchestrator.js';

export class PDFAnalyzer {
  constructor() {
    this.cacheManager = new PDFCacheManager();
    this.ERROR_MESSAGES = {
      FILE_TOO_LARGE: 'File troppo grande. Massimo 20MB.',
      INVALID_FILE_TYPE: 'File non valido. Carica un file PDF.',
      PASSWORD_PROTECTED: 'PDF protetto da password. Rimuovi la protezione e riprova.',
      EXTRACTION_FAILED:
        'Impossibile estrarre testo. Il PDF potrebbe essere scansionato o corrotto.',
      INSUFFICIENT_TEXT: 'Testo estratto insufficiente. Il PDF potrebbe essere scansionato.',
      API_ERROR: "Errore durante l'analisi. Riprova più tardi.",
      STORAGE_FULL: 'Storage pieno. Elimina alcune analisi dalla cronologia.',
      NETWORK_ERROR: 'Errore di rete. Controlla la connessione.',
    };
  }

  /**
   * Analizza PDF completo (con cache check)
   * @param {File} file - File PDF
   * @param {string} apiProvider - Provider API
   * @param {object} settings - Impostazioni analisi
   * @param {Function} progressCallback - Callback per progress
   * @returns {Promise<object>} Risultati analisi
   */
  async analyzePDF(file, apiProvider = 'groq', settings = {}, progressCallback = null) {
    try {
      // Validazione file
      this.validateFile(file);

      if (progressCallback) progressCallback('📄 Verifica cache...', 10);

      // Check cache
      const cacheResult = await this.cacheManager.checkCache(file);

      if (cacheResult.found) {
        if (progressCallback) progressCallback('✓ Caricato da cache', 100);

        // Ritorna dati dalla cache (senza pdfFile - non serializzabile)
        return {
          ...cacheResult.data.analysis,
          filename: cacheResult.data.filename,
          pageCount: cacheResult.data.pageCount,
          extractedText: cacheResult.data.extractedText,
          hasLivePreview: false, // Sempre false, mostriamo testo estratto
          isFromCache: true,
          fileHash: cacheResult.fileHash,
        };
      }

      // Estrazione testo
      if (progressCallback) progressCallback('📄 Estrazione testo PDF...', 20);
      const { text: extractedText, pageCount, textLength } = await this.extractTextFromPDF(file);

      // Verifica testo sufficiente
      if (textLength < 100) {
        throw new Error(this.ERROR_MESSAGES.INSUFFICIENT_TEXT);
      }

      // Analisi con API
      if (progressCallback) progressCallback('🤖 Analisi con AI...', 40);
      const analysis = await this.callAnalysisAPI(
        extractedText,
        apiProvider,
        settings,
        progressCallback,
      );
      analysis.pageCount = pageCount;

      // Salva in cache
      if (progressCallback) progressCallback('💾 Salvataggio...', 90);
      await this.cacheManager.saveAnalysis(
        file,
        extractedText,
        analysis,
        apiProvider,
        cacheResult.fileHash,
      );

      if (progressCallback) progressCallback('✅ Completato!', 100);

      return {
        ...analysis,
        filename: file.name,
        extractedText,
        hasLivePreview: false, // Sempre false, mostriamo testo estratto
        isFromCache: false,
        fileHash: cacheResult.fileHash,
      };
    } catch (error) {
      Logger.error('Errore analisi PDF:', error);
      throw error;
    }
  }

  /**
   * Valida file PDF
   * @param {File} file
   */
  validateFile(file) {
    const maxSize = 20 * 1024 * 1024; // 20MB

    if (file.type !== 'application/pdf') {
      throw new Error(this.ERROR_MESSAGES.INVALID_FILE_TYPE);
    }

    if (file.size > maxSize) {
      throw new Error(this.ERROR_MESSAGES.FILE_TOO_LARGE);
    }
  }

  /**
   * Estrai testo da PDF usando PDF.js
   * @param {File} file - File PDF
   * @returns {Promise<{text: string, pageCount: number}>}
   */
  async extractTextFromPDF(file) {
    try {
      // Carica PDF.js
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js non caricato');
      }

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const pageCount = pdf.numPages;
      let fullText = '';
      let textLength = 0; // page text only, without the page markers

      // Estrai testo da ogni pagina
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items.map((item) => item.str).join(' ');

        textLength += pageText.trim().length;
        fullText += `\n\n--- Pagina ${pageNum} ---\n\n${pageText}`;
      }

      return {
        text: fullText.trim(),
        pageCount,
        textLength,
      };
    } catch (error) {
      Logger.error('Errore estrazione PDF:', error);

      if (error.name === 'PasswordException') {
        throw new Error(this.ERROR_MESSAGES.PASSWORD_PROTECTED, { cause: error });
      }

      throw new Error(this.ERROR_MESSAGES.EXTRACTION_FAILED, { cause: error });
    }
  }

  /**
   * Chiama API per analisi (riusa logica esistente)
   * @param {string} text - Testo da analizzare
   * @param {string} provider - Provider API
   * @param {object} settings - Impostazioni
   * @param {Function} progressCallback - Callback progress
   * @returns {Promise<object>} Risultati analisi
   */
  async callAnalysisAPI(text, provider, settings = {}, progressCallback = null) {
    try {
      const apiKey = await StorageManager.getApiKey(provider);
      if (!apiKey) {
        throw new Error('API key non configurata per ' + provider);
      }

      // Prepara prompt per PDF
      const systemPrompt = this.buildSystemPrompt(settings);
      const userPrompt = this.buildUserPrompt(text, settings);

      if (progressCallback) progressCallback('🤖 Generazione riassunto...', 50);

      // Chiama API
      const response = await APIClient.generateCompletion(
        provider,
        apiKey,
        systemPrompt,
        userPrompt,
        {
          temperature: 0.3,
          maxTokens: 4000,
        },
      );

      if (progressCallback) progressCallback('🔑 Estrazione punti chiave...', 70);

      // Parse risposta
      const analysis = this.parseAnalysisResponse(response);

      return analysis;
    } catch (error) {
      Logger.error('Errore API:', error);
      throw new Error(this.ERROR_MESSAGES.API_ERROR + ': ' + error.message, { cause: error });
    }
  }

  /**
   * Build system prompt per analisi PDF
   */
  buildSystemPrompt(settings) {
    const language = settings.outputLanguage || 'it';
    return `Sei un esperto analista di documenti. Il tuo compito è analizzare documenti PDF e fornire:
1. Un riassunto chiaro e conciso
2. I punti chiave più importanti
3. Eventuali citazioni rilevanti

Rispondi SEMPRE in ${getLanguageNameForPrompt(language)}.

Formato risposta (JSON):
{
  "summary": "Riassunto del documento...",
  "keyPoints": [
    {"title": "Titolo punto", "description": "Descrizione", "paragraphs": "1-2"},
    ...
  ],
  "quotes": ["Citazione 1", "Citazione 2", ...]
}`;
  }

  /**
   * Build user prompt
   */
  buildUserPrompt(text, settings) {
    const summaryLength = settings.summaryLength || 'detailed';
    const lengthInstructions = {
      short: 'Crea un riassunto breve (circa 40% del contenuto originale)',
      medium: 'Crea un riassunto medio (circa 60% del contenuto originale)',
      detailed: 'Crea un riassunto dettagliato (circa 75% del contenuto originale)',
    };

    return `Analizza questo documento PDF:

${text}

${lengthInstructions[summaryLength]}.

Estrai 5-8 punti chiave con titolo e descrizione.
Identifica 3-5 citazioni o passaggi importanti.

Rispondi in formato JSON come specificato.`;
  }

  /**
   * Parse risposta API
   */
  parseAnalysisResponse(response) {
    try {
      const parsed = parseLLMJson(response);
      return {
        summary: parsed.summary || '',
        keyPoints: parsed.keyPoints || [],
        quotes: parsed.quotes || [],
      };
    } catch (error) {
      Logger.error('Errore parsing risposta:', error);
      return {
        summary: response,
        keyPoints: [],
        quotes: [],
      };
    }
  }

  /**
   * Carica analisi dalla cronologia
   * @param {string} entryId - ID entry
   * @returns {Promise<object>}
   */
  async loadFromHistory(entryId) {
    try {
      const history = await this.cacheManager.getHistory();
      const entry = history.find((e) => e.id === entryId);

      if (!entry) {
        throw new Error('Analisi non trovata');
      }

      return {
        ...entry.analysis,
        filename: entry.filename,
        pageCount: entry.pageCount,
        extractedText: entry.extractedText,
        hasLivePreview: false,
        isFromCache: true,
        timestamp: entry.timestamp,
        apiProvider: entry.apiProvider,
      };
    } catch (error) {
      Logger.error('Errore caricamento da cronologia:', error);
      throw error;
    }
  }
}
