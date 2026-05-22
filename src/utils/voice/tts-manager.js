/**
 * TTSManager - Gestisce la sintesi vocale (Text-to-Speech)
 * Usa Web Speech API (SpeechSynthesis) compatibile con Firefox
 * @module utils/tts-manager
 */
import { Logger } from '../core/logger.js';

export class TTSManager {
  constructor() {
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentUtterance = null;
    this.queue = [];
    this.config = {
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      lang: 'it-IT',
    };

    this.synth = window.speechSynthesis;
    this.availableVoices = [];
    this.preferences = {};

    this.initializeEventListeners().catch((err) => Logger.warn('TTS init fallita:', err));
  }

  async initializeEventListeners() {
    await this.loadVoices();
    await this.loadPreferences();
  }

  async loadVoices() {
    return new Promise((resolve) => {
      const loadVoiceList = () => {
        this.availableVoices = this.synth.getVoices();
        Logger.info('Voci TTS disponibili:', this.availableVoices.length);
        resolve(this.availableVoices);
      };

      const voices = this.synth.getVoices();
      if (voices.length > 0) {
        this.availableVoices = voices;
        Logger.info('Voci TTS disponibili:', voices.length);
        resolve(voices);
      } else {
        this.synth.addEventListener('voiceschanged', loadVoiceList, { once: true });
      }
    });
  }

  async loadPreferences() {
    const result = await browser.storage.local.get(['ttsPreferences']);
    if (result.ttsPreferences) {
      this.preferences = result.ttsPreferences;
    } else {
      this.preferences = {};
    }
  }

  async savePreferences() {
    await browser.storage.local.set({ ttsPreferences: this.preferences });
  }

  async setPreferredVoice(lang, voiceName) {
    this.preferences[lang] = voiceName;
    await this.savePreferences();
  }

  getPreferredVoice(lang) {
    return this.preferences[lang] || null;
  }

  getVoicesForLanguage(lang) {
    if (!this.availableVoices) return [];

    return this.availableVoices.filter((voice) => {
      return voice.lang && voice.lang.startsWith(lang.split('-')[0]);
    });
  }

  /**
   * @param {string} text - Testo da leggere
   * @param {Object} options - Opzioni aggiuntive
   */
  speak(text, options = {}) {
    if (!text || text.trim().length === 0) {
      Logger.warn('Testo vuoto fornito a TTS');
      return;
    }

    const cleanText = this.cleanText(text);

    this.stop();

    const lang = options.lang || this.config.lang;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    utterance.rate = options.rate || this.config.rate;
    utterance.pitch = options.pitch || this.config.pitch;
    utterance.volume = options.volume || this.config.volume;

    const voiceName = options.voiceName || this.getPreferredVoice(lang);
    if (voiceName) {
      const voice = this.availableVoices.find((v) => v.name === voiceName);
      if (voice) {
        utterance.voice = voice;
      }
    }

    utterance.onstart = () => {
      Logger.debug('TTS iniziato');
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
      Logger.debug('TTS terminato');
      window.dispatchEvent(new CustomEvent('tts:ended'));
    };

    utterance.onerror = (event) => {
      if (event.error === 'canceled') return;
      this.handleError(event);
    };

    utterance.onpause = () => {
      Logger.debug('TTS in pausa');
    };

    utterance.onresume = () => {
      Logger.debug('TTS ripreso');
    };

    this.isSpeaking = true;
    this.currentUtterance = utterance;

    this.synth.speak(utterance);

    window.dispatchEvent(
      new CustomEvent('tts:started', {
        detail: { text: cleanText },
      }),
    );
  }

  pause() {
    if (this.isSpeaking && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
      window.dispatchEvent(new CustomEvent('tts:paused'));
    }
  }

  resume() {
    if (this.isSpeaking && this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
      window.dispatchEvent(new CustomEvent('tts:resumed'));
    }
  }

  stop() {
    if (this.isSpeaking) {
      this.synth.cancel();
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
      window.dispatchEvent(new CustomEvent('tts:stopped'));
    }
  }

  cleanText(text) {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/[*_~`]/g, '')
      .trim();
  }

  handleError(error) {
    Logger.error('Errore TTS:', error);
    this.isSpeaking = false;
    this.isPaused = false;

    window.dispatchEvent(
      new CustomEvent('tts:error', {
        detail: { error },
      }),
    );
  }

  getState() {
    return {
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      currentText: this.currentUtterance?.text || null,
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  async getAvailableVoices() {
    if (this.availableVoices.length > 0) {
      return this.availableVoices;
    }
    return this.loadVoices();
  }
}
