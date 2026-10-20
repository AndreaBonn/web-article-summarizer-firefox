/**
 * STTManager - Gestisce il riconoscimento vocale (Speech-to-Text)
 * @module utils/stt-manager
 */
import { Logger } from '../core/logger.js';
import { I18n } from '../i18n/i18n.js';

export class STTManager {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.transcript = '';
    this.config = {
      lang: 'it-IT',
      continuous: false,
      interimResults: true,
      maxAlternatives: 1,
    };

    this.initializeRecognition();
  }

  /**
   * Inizializza Web Speech API
   */
  initializeRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      Logger.error('❌ Speech Recognition non supportato in questo browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.applyConfig();
    this.setupEventListeners();
  }

  /**
   * Applica la configurazione al recognizer
   */
  applyConfig() {
    if (!this.recognition) return;

    this.recognition.lang = this.config.lang;
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.maxAlternatives = this.config.maxAlternatives;
  }

  /**
   * Configura i listener per gli eventi di riconoscimento
   */
  setupEventListeners() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      Logger.info('🎤 Riconoscimento vocale avviato');
      window.dispatchEvent(new CustomEvent('stt:started'));
    };

    this.recognition.onresult = (event) => {
      const results = event.results;
      const lastResult = results[results.length - 1];

      if (lastResult.isFinal) {
        this.transcript = lastResult[0].transcript;
        Logger.info('✅ Trascrizione finale:', this.transcript);

        window.dispatchEvent(
          new CustomEvent('stt:result', {
            detail: {
              transcript: this.transcript,
              confidence: lastResult[0].confidence,
            },
          }),
        );
      } else {
        // Risultato provvisorio
        const interimTranscript = lastResult[0].transcript;
        window.dispatchEvent(
          new CustomEvent('stt:interim', {
            detail: { transcript: interimTranscript },
          }),
        );
      }
    };

    this.recognition.onerror = (event) => {
      Logger.error('❌ Errore STT:', event.error);
      this.handleError(event);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      Logger.info('⏹️ Riconoscimento vocale terminato');
      window.dispatchEvent(new CustomEvent('stt:ended'));
    };

    this.recognition.onnomatch = () => {
      Logger.warn('⚠️ Nessuna corrispondenza trovata');
      window.dispatchEvent(new CustomEvent('stt:nomatch'));
    };

    this.recognition.onspeechend = () => {
      Logger.debug('🔇 Discorso terminato');
    };
  }

  /**
   * Avvia il riconoscimento vocale
   */
  start() {
    if (!this.recognition) {
      Logger.error('❌ Speech Recognition non inizializzato');
      return;
    }

    if (this.isListening) {
      Logger.warn('⚠️ Riconoscimento già in corso');
      return;
    }

    try {
      this.transcript = '';
      this.recognition.start();
    } catch (error) {
      Logger.error('❌ Errore avvio riconoscimento:', error);
      this.handleError(error);
    }
  }

  /**
   * Ferma il riconoscimento vocale
   */
  stop() {
    if (!this.recognition || !this.isListening) return;

    try {
      this.recognition.stop();
    } catch (error) {
      Logger.error('❌ Errore stop riconoscimento:', error);
    }
  }

  /**
   * Annulla il riconoscimento vocale
   */
  abort() {
    if (!this.recognition) return;

    try {
      this.recognition.abort();
      this.isListening = false;
      this.transcript = '';
    } catch (error) {
      Logger.error('❌ Errore abort riconoscimento:', error);
    }
  }

  /**
   * Gestisce gli errori STT
   * @param {Object} error - Oggetto errore
   */
  handleError(error) {
    this.isListening = false;

    let errorMessage = I18n.t('voice.stt.generic');

    const errorType = error.error || error.message;

    switch (errorType) {
      case 'no-speech':
        errorMessage = I18n.t('voice.stt.noSpeech');
        break;
      case 'audio-capture':
        errorMessage = I18n.t('voice.stt.audioCapture');
        break;
      case 'not-allowed':
        errorMessage = I18n.t('voice.stt.notAllowed');
        break;
      case 'network':
        errorMessage = I18n.t('voice.stt.network');
        break;
      case 'aborted':
        errorMessage = I18n.t('voice.stt.aborted');
        break;
    }

    window.dispatchEvent(
      new CustomEvent('stt:error', {
        detail: { error: errorType, message: errorMessage },
      }),
    );
  }

  /**
   * Aggiorna la configurazione
   * @param {Object} newConfig - Nuova configurazione
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.applyConfig();
  }

  /**
   * Verifica supporto browser
   * @returns {boolean} True se supportato
   */
  static isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Ottieni lo stato corrente
   * @returns {Object} Stato STT
   */
  getState() {
    return {
      isListening: this.isListening,
      transcript: this.transcript,
      isSupported: STTManager.isSupported(),
    };
  }
}
