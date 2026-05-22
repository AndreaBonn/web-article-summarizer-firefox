import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser APIs
global.browser = {
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
    },
  },
  runtime: { lastError: null },
};

// Mock Web Speech API
class MockUtterance {
  constructor(text) {
    this.text = text;
    this.lang = '';
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.voice = null;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
    this.onpause = null;
    this.onresume = null;
  }
}
global.SpeechSynthesisUtterance = MockUtterance;

Object.defineProperty(window, 'speechSynthesis', {
  value: {
    speak: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn(() => [{ name: 'V1', lang: 'it-IT' }]),
    addEventListener: vi.fn(),
  },
  writable: true,
});

// Mock SpeechRecognition
class MockSpeechRecognition {
  constructor() {
    this.start = vi.fn();
    this.stop = vi.fn();
    this.abort = vi.fn();
    this.continuous = false;
    this.interimResults = false;
    this.maxAlternatives = 1;
    this.lang = '';
    this.onstart = null;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.onnomatch = null;
    this.onspeechend = null;
  }
}

global.window.webkitSpeechRecognition = MockSpeechRecognition;

// Mock Logger
vi.mock('@utils/core/logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { VoiceController } from '@utils/voice/voice-controller.js';

describe('VoiceController', () => {
  let vc;

  beforeEach(() => {
    vi.clearAllMocks();
    browser.runtime.lastError = null;
    vc = new VoiceController();
  });

  // ─── Constructor ──────────────────────────────────

  describe('constructor', () => {
    it('crea ttsManager e sttManager', () => {
      expect(vc.ttsManager).toBeDefined();
      expect(vc.sttManager).toBeDefined();
    });

    it('isInitialized false di default', () => {
      expect(vc.isInitialized).toBe(false);
    });
  });

  // ─── initialize ───────────────────────────────────

  describe('initialize', () => {
    it('imposta isInitialized a true', async () => {
      await vc.initialize();
      expect(vc.isInitialized).toBe(true);
    });

    it('non re-inizializza se già inizializzato', async () => {
      await vc.initialize();
      const spy = vi.spyOn(vc.ttsManager, 'getAvailableVoices');
      await vc.initialize();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── speak ────────────────────────────────────────

  describe('speak', () => {
    it('delega a ttsManager.speak con lang', () => {
      const spy = vi.spyOn(vc.ttsManager, 'speak');
      vc.speak('Ciao', 'it-IT');
      expect(spy).toHaveBeenCalledWith('Ciao', { lang: 'it-IT' });
    });

    it('usa it-IT come lingua default', () => {
      const spy = vi.spyOn(vc.ttsManager, 'speak');
      vc.speak('Test');
      expect(spy).toHaveBeenCalledWith('Test', { lang: 'it-IT' });
    });
  });

  // ─── stopSpeaking ────────────────────────────────

  describe('stopSpeaking', () => {
    it('delega a ttsManager.stop', () => {
      const spy = vi.spyOn(vc.ttsManager, 'stop');
      vc.stopSpeaking();
      expect(spy).toHaveBeenCalled();
    });
  });

  // ─── pauseSpeaking ───────────────────────────────

  describe('pauseSpeaking', () => {
    it('delega a ttsManager.pause', () => {
      const spy = vi.spyOn(vc.ttsManager, 'pause');
      vc.pauseSpeaking();
      expect(spy).toHaveBeenCalled();
    });
  });

  // ─── resumeSpeaking ──────────────────────────────

  describe('resumeSpeaking', () => {
    it('delega a ttsManager.resume', () => {
      const spy = vi.spyOn(vc.ttsManager, 'resume');
      vc.resumeSpeaking();
      expect(spy).toHaveBeenCalled();
    });
  });

  // ─── startListening ──────────────────────────────

  describe('startListening', () => {
    it('rifiuta promise se STT non supportato', async () => {
      const backup = global.window.webkitSpeechRecognition;
      global.window.webkitSpeechRecognition = undefined;
      global.window.SpeechRecognition = undefined;

      await expect(vc.startListening()).rejects.toThrow('non supportato');

      global.window.webkitSpeechRecognition = backup;
    });

    it('aggiorna lingua STT prima di avviare', () => {
      const spy = vi.spyOn(vc.sttManager, 'updateConfig');
      // Non awaitmano perché è una promise pendente
      vc.startListening('en-US');
      expect(spy).toHaveBeenCalledWith({ lang: 'en-US' });
    });

    it('risolve con transcript quando stt:result viene emesso', async () => {
      const promise = vc.startListening('it-IT');

      // Simula risultato
      window.dispatchEvent(
        new CustomEvent('stt:result', {
          detail: { transcript: 'ciao mondo' },
        }),
      );

      const result = await promise;
      expect(result).toBe('ciao mondo');
    });

    it('rifiuta con errore quando stt:error viene emesso', async () => {
      const promise = vc.startListening('it-IT');

      window.dispatchEvent(
        new CustomEvent('stt:error', {
          detail: { message: 'Nessun parlato rilevato. Riprova.' },
        }),
      );

      await expect(promise).rejects.toThrow('Nessun parlato rilevato');
    });
  });

  // ─── stopListening ───────────────────────────────

  describe('stopListening', () => {
    it('delega a sttManager.stop', () => {
      const spy = vi.spyOn(vc.sttManager, 'stop');
      vc.stopListening();
      expect(spy).toHaveBeenCalled();
    });
  });

  // ─── getTTSState / getSTTState ────────────────────

  describe('getTTSState', () => {
    it('ritorna stato TTS', () => {
      const state = vc.getTTSState();
      expect(state).toHaveProperty('isSpeaking');
      expect(state).toHaveProperty('isPaused');
      expect(state).toHaveProperty('currentText');
    });
  });

  describe('getSTTState', () => {
    it('ritorna stato STT', () => {
      const state = vc.getSTTState();
      expect(state).toHaveProperty('isListening');
      expect(state).toHaveProperty('transcript');
      expect(state).toHaveProperty('isSupported');
    });
  });

  // ─── mapLanguageCode (static) ─────────────────────

  describe('mapLanguageCode', () => {
    it('mappa it → it-IT', () => {
      expect(VoiceController.mapLanguageCode('it')).toBe('it-IT');
    });

    it('mappa en → en-US', () => {
      expect(VoiceController.mapLanguageCode('en')).toBe('en-US');
    });

    it('mappa es → es-ES', () => {
      expect(VoiceController.mapLanguageCode('es')).toBe('es-ES');
    });

    it('mappa fr → fr-FR', () => {
      expect(VoiceController.mapLanguageCode('fr')).toBe('fr-FR');
    });

    it('mappa de → de-DE', () => {
      expect(VoiceController.mapLanguageCode('de')).toBe('de-DE');
    });

    it('ritorna it-IT per lingua sconosciuta', () => {
      expect(VoiceController.mapLanguageCode('zh')).toBe('it-IT');
    });
  });
});
