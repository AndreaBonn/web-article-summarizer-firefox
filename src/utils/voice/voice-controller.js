/**
 * VoiceController - Coordina TTS e STT per Q&A vocale
 * @module utils/voice-controller
 */
import { Logger } from '../core/logger.js';
import { TTSManager } from './tts-manager.js';
import { STTManager } from './stt-manager.js';
import { I18n } from '../i18n/i18n.js';

export class VoiceController {
  constructor() {
    this.ttsManager = new TTSManager();
    this.sttManager = new STTManager();
    this.isInitialized = false;
  }

  /**
   * Inizializza il controller vocale
   */
  async initialize() {
    if (this.isInitialized) return;

    // Verifica supporto STT
    if (!STTManager.isSupported()) {
      Logger.warn('⚠️ Riconoscimento vocale non supportato');
    }

    // Carica voci TTS disponibili
    const voices = await this.ttsManager.getAvailableVoices();
    Logger.info(`🔊 ${voices.length} voci TTS disponibili`);

    this.isInitialized = true;
  }

  /**
   * Leggi un testo ad alta voce
   * @param {string} text - Testo da leggere
   * @param {string} lang - Codice lingua (es: 'it-IT', 'en-US')
   */
  speak(text, lang = 'it-IT') {
    this.ttsManager.speak(text, { lang });
  }

  /**
   * Ferma la lettura
   */
  stopSpeaking() {
    this.ttsManager.stop();
  }

  /**
   * Pausa la lettura
   */
  pauseSpeaking() {
    this.ttsManager.pause();
  }

  /**
   * Riprendi la lettura
   */
  resumeSpeaking() {
    this.ttsManager.resume();
  }

  /**
   * Avvia l'ascolto vocale
   * @param {string} lang - Codice lingua (es: 'it-IT', 'en-US')
   * @returns {Promise<string>} Trascrizione finale
   */
  startListening(lang = 'it-IT') {
    return new Promise((resolve, reject) => {
      if (!STTManager.isSupported()) {
        reject(new Error(I18n.t('voice.sttUnsupported')));
        return;
      }

      // Aggiorna lingua
      this.sttManager.updateConfig({ lang });

      // Listener per risultato finale
      const handleResult = (event) => {
        window.removeEventListener('stt:result', handleResult);
        window.removeEventListener('stt:error', handleError);
        resolve(event.detail.transcript);
      };

      // Listener per errori
      const handleError = (event) => {
        window.removeEventListener('stt:result', handleResult);
        window.removeEventListener('stt:error', handleError);
        reject(new Error(event.detail.message));
      };

      window.addEventListener('stt:result', handleResult);
      window.addEventListener('stt:error', handleError);

      // Avvia riconoscimento
      this.sttManager.start();
    });
  }

  /**
   * Ferma l'ascolto
   */
  stopListening() {
    this.sttManager.stop();
  }

  /**
   * Ottieni lo stato TTS
   */
  getTTSState() {
    return this.ttsManager.getState();
  }

  /**
   * Ottieni lo stato STT
   */
  getSTTState() {
    return this.sttManager.getState();
  }

  /**
   * Mappa codice lingua output a codice lingua vocale
   * @param {string} outputLang - Codice lingua output (es: 'it', 'en')
   * @returns {string} Codice lingua vocale (es: 'it-IT', 'en-US')
   */
  static mapLanguageCode(outputLang) {
    const languageMap = {
      it: 'it-IT',
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
    };
    return languageMap[outputLang] || 'it-IT';
  }
}
