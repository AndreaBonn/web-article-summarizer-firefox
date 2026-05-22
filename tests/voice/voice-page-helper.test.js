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

// Mock HtmlSanitizer
vi.mock('@utils/security/html-sanitizer.js', () => ({
  HtmlSanitizer: {
    escape: vi.fn((str) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;')),
  },
}));

import {
  initVoiceForPage,
  updateTTSButtonState,
  setupTTSEventListeners,
  handleTTSPlay,
  handleTTSPause,
  handleTTSStop,
  createTTSToggleButton,
  buildVoiceSelectorHTML,
} from '@shared/voice-page-helper.js';

// ─── Helper: crea pulsanti mock DOM ─────────────────
function createMockButtons() {
  const make = () => {
    const el = document.createElement('button');
    el.style.display = 'inline-block';
    el.classList.add = vi.fn();
    el.classList.remove = vi.fn();
    // keep native classList but spy on add/remove
    const original = el.classList;
    return el;
  };
  return {
    ttsPlayBtn: make(),
    ttsPauseBtn: make(),
    ttsStopBtn: make(),
  };
}

describe('voice-page-helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.runtime.lastError = null;
  });

  // ─── initVoiceForPage ─────────────────────────────

  describe('initVoiceForPage', () => {
    it('ritorna VoiceController inizializzato', async () => {
      const controller = await initVoiceForPage();
      expect(controller).toBeDefined();
      expect(controller.isInitialized).toBe(true);
    });

    it('assegna controller a state[stateKey]', async () => {
      const state = {};
      const controller = await initVoiceForPage({ state });
      expect(state.voiceController).toBe(controller);
    });

    it('usa stateKey custom', async () => {
      const state = {};
      await initVoiceForPage({ state, stateKey: 'vc' });
      expect(state.vc).toBeDefined();
    });

    it('assegna controller a localHolder.value', async () => {
      const holder = { value: null };
      const controller = await initVoiceForPage({ localHolder: holder });
      expect(holder.value).toBe(controller);
    });

    it('funziona senza parametri', async () => {
      const controller = await initVoiceForPage();
      expect(controller.isInitialized).toBe(true);
    });
  });

  // ─── updateTTSButtonState ─────────────────────────

  describe('updateTTSButtonState', () => {
    it('playing: nasconde play, mostra pause e stop', () => {
      const els = createMockButtons();
      updateTTSButtonState('playing', { elements: els });
      expect(els.ttsPlayBtn.style.display).toBe('none');
      expect(els.ttsPauseBtn.style.display).toBe('inline-block');
      expect(els.ttsStopBtn.style.display).toBe('inline-block');
    });

    it('paused: mostra play, nasconde pause, mostra stop', () => {
      const els = createMockButtons();
      updateTTSButtonState('paused', { elements: els });
      expect(els.ttsPlayBtn.style.display).toBe('inline-block');
      expect(els.ttsPauseBtn.style.display).toBe('none');
      expect(els.ttsStopBtn.style.display).toBe('inline-block');
      expect(els.ttsPlayBtn.title).toBe('Riprendi');
    });

    it('stopped: mostra play, nasconde pause e stop', () => {
      const els = createMockButtons();
      updateTTSButtonState('stopped', { elements: els });
      expect(els.ttsPlayBtn.style.display).toBe('inline-block');
      expect(els.ttsPauseBtn.style.display).toBe('none');
      expect(els.ttsStopBtn.style.display).toBe('none');
      expect(els.ttsPlayBtn.textContent).toBe('Play');
    });

    it('funziona con getButtons() invece di elements', () => {
      const els = createMockButtons();
      const getButtons = () => ({
        playBtn: els.ttsPlayBtn,
        pauseBtn: els.ttsPauseBtn,
        stopBtn: els.ttsStopBtn,
      });
      updateTTSButtonState('playing', { getButtons });
      expect(els.ttsPlayBtn.style.display).toBe('none');
    });

    it('non crasha se pulsanti mancanti', () => {
      expect(() => updateTTSButtonState('playing', { elements: {} })).not.toThrow();
    });

    it('non crasha senza options', () => {
      expect(() => updateTTSButtonState('playing')).not.toThrow();
    });
  });

  // ─── setupTTSEventListeners ───────────────────────

  describe('setupTTSEventListeners', () => {
    it('reagisce a tts:started impostando playing', () => {
      const els = createMockButtons();
      setupTTSEventListeners({ elements: els });
      window.dispatchEvent(new CustomEvent('tts:started'));
      expect(els.ttsPlayBtn.style.display).toBe('none');
    });

    it('reagisce a tts:paused impostando paused', () => {
      const els = createMockButtons();
      setupTTSEventListeners({ elements: els });
      window.dispatchEvent(new CustomEvent('tts:paused'));
      expect(els.ttsPauseBtn.style.display).toBe('none');
      expect(els.ttsPlayBtn.title).toBe('Riprendi');
    });

    it('reagisce a tts:resumed impostando playing', () => {
      const els = createMockButtons();
      setupTTSEventListeners({ elements: els });
      window.dispatchEvent(new CustomEvent('tts:resumed'));
      expect(els.ttsPlayBtn.style.display).toBe('none');
    });

    it('reagisce a tts:stopped impostando stopped', () => {
      const els = createMockButtons();
      setupTTSEventListeners({ elements: els });
      window.dispatchEvent(new CustomEvent('tts:stopped'));
      expect(els.ttsPlayBtn.textContent).toBe('Play');
    });

    it('reagisce a tts:ended impostando stopped', () => {
      const els = createMockButtons();
      setupTTSEventListeners({ elements: els });
      window.dispatchEvent(new CustomEvent('tts:ended'));
      expect(els.ttsPlayBtn.textContent).toBe('Play');
    });

    it('chiama onError callback su tts:error', () => {
      const els = createMockButtons();
      const onError = vi.fn();
      setupTTSEventListeners({ elements: els, onError });
      window.dispatchEvent(new CustomEvent('tts:error', { detail: { error: 'test' } }));
      expect(onError).toHaveBeenCalledWith({ error: 'test' });
    });
  });

  // ─── handleTTSPlay ────────────────────────────────

  describe('handleTTSPlay', () => {
    it('riprende se TTS è in pausa', () => {
      const mockVC = {
        getTTSState: () => ({ isSpeaking: true, isPaused: true }),
        resumeSpeaking: vi.fn(),
        speak: vi.fn(),
      };
      handleTTSPlay(mockVC, () => 'text', 'it-IT');
      expect(mockVC.resumeSpeaking).toHaveBeenCalled();
      expect(mockVC.speak).not.toHaveBeenCalled();
    });

    it('avvia nuova lettura se non in pausa', () => {
      const mockVC = {
        getTTSState: () => ({ isSpeaking: false, isPaused: false }),
        resumeSpeaking: vi.fn(),
        speak: vi.fn(),
      };
      handleTTSPlay(mockVC, () => 'testo da leggere', 'it-IT');
      expect(mockVC.speak).toHaveBeenCalledWith('testo da leggere', 'it-IT');
    });

    it('chiama onNoText se getTextFn ritorna null', () => {
      const mockVC = {
        getTTSState: () => ({ isSpeaking: false, isPaused: false }),
        speak: vi.fn(),
      };
      const onNoText = vi.fn();
      handleTTSPlay(mockVC, () => null, 'it-IT', onNoText);
      expect(mockVC.speak).not.toHaveBeenCalled();
      expect(onNoText).toHaveBeenCalled();
    });

    it('non fa nulla se voiceController è null', () => {
      expect(() => handleTTSPlay(null, () => 'text', 'it-IT')).not.toThrow();
    });
  });

  // ─── handleTTSPause ───────────────────────────────

  describe('handleTTSPause', () => {
    it('delega a pauseSpeaking', () => {
      const mockVC = { pauseSpeaking: vi.fn() };
      handleTTSPause(mockVC);
      expect(mockVC.pauseSpeaking).toHaveBeenCalled();
    });

    it('non crasha con null', () => {
      expect(() => handleTTSPause(null)).not.toThrow();
    });
  });

  // ─── handleTTSStop ────────────────────────────────

  describe('handleTTSStop', () => {
    it('delega a stopSpeaking', () => {
      const mockVC = { stopSpeaking: vi.fn() };
      handleTTSStop(mockVC);
      expect(mockVC.stopSpeaking).toHaveBeenCalled();
    });

    it('non crasha con null', () => {
      expect(() => handleTTSStop(null)).not.toThrow();
    });
  });

  // ─── createTTSToggleButton ────────────────────────

  describe('createTTSToggleButton', () => {
    it('crea container con pulsante e bottone voce', () => {
      const mockVC = {
        getTTSState: () => ({ isSpeaking: false }),
        speak: vi.fn(),
        stopSpeaking: vi.fn(),
      };
      const container = createTTSToggleButton('Test', 'it-IT', 'Leggi', mockVC, vi.fn());
      expect(container.className).toBe('tts-button-container');
      expect(container.children).toHaveLength(2);
    });

    it('click su pulsante avvia speak se non in riproduzione', () => {
      const mockVC = {
        getTTSState: () => ({ isSpeaking: false }),
        speak: vi.fn(),
        stopSpeaking: vi.fn(),
      };
      const container = createTTSToggleButton('Testo', 'it-IT', 'Leggi', mockVC, vi.fn());
      const button = container.querySelector('.tts-button');
      button.click();
      expect(mockVC.speak).toHaveBeenCalledWith('Testo', 'it-IT');
    });

    it('click su pulsante ferma se in riproduzione', () => {
      const mockVC = {
        getTTSState: () => ({ isSpeaking: true }),
        speak: vi.fn(),
        stopSpeaking: vi.fn(),
      };
      const container = createTTSToggleButton('Testo', 'it-IT', 'Leggi', mockVC, vi.fn());
      const button = container.querySelector('.tts-button');
      button.click();
      expect(mockVC.stopSpeaking).toHaveBeenCalled();
    });

    it('click su voce bottone invoca onVoiceSelect con lang', () => {
      const mockVC = {
        getTTSState: () => ({ isSpeaking: false }),
        speak: vi.fn(),
      };
      const onVoiceSelect = vi.fn();
      const container = createTTSToggleButton('Testo', 'en-US', 'Read', mockVC, onVoiceSelect);
      const voiceBtn = container.querySelector('.tts-voice-select-btn');
      voiceBtn.click();
      expect(onVoiceSelect).toHaveBeenCalledWith('en-US');
    });
  });

  // ─── buildVoiceSelectorHTML ───────────────────────

  describe('buildVoiceSelectorHTML', () => {
    it('genera HTML con voci', () => {
      const voices = [
        { voiceName: 'Google italiano', lang: 'it-IT', localService: true },
        { voiceName: 'Google English', lang: 'en-US', localService: false },
      ];
      const html = buildVoiceSelectorHTML(voices, 'Google italiano');
      expect(html).toContain('voice-list');
      expect(html).toContain('Google italiano');
      expect(html).toContain('Google English');
    });

    it('marca voce selezionata con classe selected e check', () => {
      const voices = [{ voiceName: 'V1', lang: 'it-IT', localService: true }];
      const html = buildVoiceSelectorHTML(voices, 'V1');
      expect(html).toContain('selected');
      expect(html).toContain('voice-check');
    });

    it('non marca voce non selezionata', () => {
      const voices = [{ voiceName: 'V1', lang: 'it-IT', localService: true }];
      const html = buildVoiceSelectorHTML(voices, 'V2');
      expect(html).not.toContain('selected');
    });

    it('mostra badge Locale per localService true', () => {
      const voices = [{ voiceName: 'V1', lang: 'it-IT', localService: true }];
      const html = buildVoiceSelectorHTML(voices, null);
      expect(html).toContain('badge-local');
      expect(html).toContain('Locale');
    });

    it('mostra badge Remota per localService false', () => {
      const voices = [{ voiceName: 'V1', lang: 'it-IT', localService: false }];
      const html = buildVoiceSelectorHTML(voices, null);
      expect(html).toContain('badge-remote');
      expect(html).toContain('Remota');
    });

    it('gestisce array vuoto', () => {
      const html = buildVoiceSelectorHTML([], null);
      expect(html).toBe('<div class="voice-list"></div>');
    });
  });
});
