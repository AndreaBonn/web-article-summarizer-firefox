import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser.storage.local
const store = {};
global.browser = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        const result = {};
        for (const key of keys) {
          if (store[key] !== undefined) result[key] = store[key];
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((data) => {
        Object.assign(store, JSON.parse(JSON.stringify(data)));
        return Promise.resolve();
      }),
    },
  },
  runtime: { lastError: null },
};

// Mock SpeechSynthesisUtterance
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

// Mock speechSynthesis
const mockSynth = {
  speak: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn(() => [
    { name: 'Google italiano', lang: 'it-IT' },
    { name: 'Google English', lang: 'en-US' },
  ]),
  addEventListener: vi.fn(),
};
Object.defineProperty(window, 'speechSynthesis', {
  value: mockSynth,
  writable: true,
});

// Mock Logger
vi.mock('@utils/core/logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { TTSManager } from '@utils/voice/tts-manager.js';

describe('TTSManager', () => {
  let tts;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
    mockSynth.getVoices.mockReturnValue([
      { name: 'Google italiano', lang: 'it-IT' },
      { name: 'Google English', lang: 'en-US' },
    ]);
    tts = new TTSManager();
  });

  // ─── Constructor & Init ───────────────────────────

  describe('constructor', () => {
    it('inizializza stato default', () => {
      expect(tts.isSpeaking).toBe(false);
      expect(tts.isPaused).toBe(false);
      expect(tts.currentUtterance).toBeNull();
      expect(tts.queue).toEqual([]);
    });

    it('config default con lingua it-IT', () => {
      expect(tts.config).toEqual({
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        lang: 'it-IT',
      });
    });
  });

  // ─── loadVoices ───────────────────────────────────

  describe('loadVoices', () => {
    it('carica voci disponibili da speechSynthesis', async () => {
      const voices = await tts.loadVoices();
      expect(voices).toHaveLength(2);
      expect(tts.availableVoices).toHaveLength(2);
    });

    it('attende voiceschanged se getVoices ritorna vuoto', async () => {
      mockSynth.getVoices.mockReturnValueOnce([]);
      mockSynth.addEventListener.mockImplementation((event, cb) => {
        if (event === 'voiceschanged') {
          mockSynth.getVoices.mockReturnValue([{ name: 'V1', lang: 'it-IT' }]);
          cb();
        }
      });
      const voices = await tts.loadVoices();
      expect(voices).toHaveLength(1);
    });
  });

  // ─── loadPreferences / savePreferences ────────────

  describe('preferenze', () => {
    it('carica preferenze vuote se non salvate', async () => {
      await tts.loadPreferences();
      expect(tts.preferences).toEqual({});
    });

    it('carica preferenze salvate', async () => {
      store.ttsPreferences = { 'it-IT': 'Google italiano' };
      await tts.loadPreferences();
      expect(tts.preferences).toEqual({ 'it-IT': 'Google italiano' });
    });

    it('salva preferenze in browser.storage', async () => {
      tts.preferences = { 'en-US': 'Google English' };
      await tts.savePreferences();
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        ttsPreferences: { 'en-US': 'Google English' },
      });
    });
  });

  // ─── setPreferredVoice / getPreferredVoice ────────

  describe('setPreferredVoice', () => {
    it('imposta e persiste voce preferita', async () => {
      tts.preferences = {};
      await tts.setPreferredVoice('it-IT', 'Google italiano');
      expect(tts.preferences['it-IT']).toBe('Google italiano');
      expect(browser.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('getPreferredVoice', () => {
    it('ritorna voce se presente', () => {
      tts.preferences = { 'it-IT': 'Google italiano' };
      expect(tts.getPreferredVoice('it-IT')).toBe('Google italiano');
    });

    it('ritorna null se lingua non configurata', () => {
      tts.preferences = {};
      expect(tts.getPreferredVoice('fr-FR')).toBeNull();
    });
  });

  // ─── getVoicesForLanguage ─────────────────────────

  describe('getVoicesForLanguage', () => {
    it('filtra voci per lingua', () => {
      tts.availableVoices = [
        { name: 'V1', lang: 'it-IT' },
        { name: 'V2', lang: 'en-US' },
        { name: 'V3', lang: 'it-CH' },
      ];
      const itVoices = tts.getVoicesForLanguage('it-IT');
      expect(itVoices).toHaveLength(2);
      expect(itVoices.map((v) => v.name)).toEqual(['V1', 'V3']);
    });

    it('ritorna array vuoto se availableVoices e undefined', () => {
      tts.availableVoices = undefined;
      expect(tts.getVoicesForLanguage('it-IT')).toEqual([]);
    });
  });

  // ─── speak ────────────────────────────────────────

  describe('speak', () => {
    it('chiama speechSynthesis.speak con SpeechSynthesisUtterance', () => {
      tts.speak('Ciao mondo');
      expect(mockSynth.speak).toHaveBeenCalledTimes(1);
      const utterance = mockSynth.speak.mock.calls[0][0];
      expect(utterance).toBeInstanceOf(MockUtterance);
      expect(utterance.text).toBe('Ciao mondo');
      expect(utterance.lang).toBe('it-IT');
      expect(tts.isSpeaking).toBe(true);
    });

    it('ignora testo vuoto', () => {
      tts.speak('');
      expect(mockSynth.speak).not.toHaveBeenCalled();
    });

    it('ignora testo solo spazi', () => {
      tts.speak('   ');
      expect(mockSynth.speak).not.toHaveBeenCalled();
    });

    it('usa lingua custom da options', () => {
      tts.speak('Hello', { lang: 'en-US' });
      const utterance = mockSynth.speak.mock.calls[0][0];
      expect(utterance.lang).toBe('en-US');
    });

    it('usa voce specificata nelle options', () => {
      tts.availableVoices = [{ name: 'CustomVoice', lang: 'it-IT' }];
      tts.speak('Test', { voiceName: 'CustomVoice' });
      const utterance = mockSynth.speak.mock.calls[0][0];
      expect(utterance.voice).toEqual({ name: 'CustomVoice', lang: 'it-IT' });
    });

    it('usa voce preferita se non specificata', () => {
      tts.preferences = { 'it-IT': 'Google italiano' };
      tts.availableVoices = [{ name: 'Google italiano', lang: 'it-IT' }];
      tts.speak('Test');
      const utterance = mockSynth.speak.mock.calls[0][0];
      expect(utterance.voice).toEqual({ name: 'Google italiano', lang: 'it-IT' });
    });

    it('dispatcha evento tts:started', () => {
      const handler = vi.fn();
      window.addEventListener('tts:started', handler);
      tts.speak('Ciao');
      expect(handler).toHaveBeenCalled();
      window.removeEventListener('tts:started', handler);
    });

    it('ferma lettura precedente prima di avviare nuova', () => {
      tts.isSpeaking = true;
      tts.speak('Nuovo testo');
      expect(mockSynth.cancel).toHaveBeenCalled();
    });
  });

  // ─── pause ────────────────────────────────────────

  describe('pause', () => {
    it('pausa se in riproduzione', () => {
      tts.isSpeaking = true;
      tts.isPaused = false;
      tts.pause();
      expect(mockSynth.pause).toHaveBeenCalled();
      expect(tts.isPaused).toBe(true);
    });

    it('non fa nulla se non sta parlando', () => {
      tts.isSpeaking = false;
      tts.pause();
      expect(mockSynth.pause).not.toHaveBeenCalled();
    });

    it('non fa nulla se gia in pausa', () => {
      tts.isSpeaking = true;
      tts.isPaused = true;
      tts.pause();
      expect(mockSynth.pause).not.toHaveBeenCalled();
    });
  });

  // ─── resume ───────────────────────────────────────

  describe('resume', () => {
    it('riprende se in pausa', () => {
      tts.isSpeaking = true;
      tts.isPaused = true;
      tts.resume();
      expect(mockSynth.resume).toHaveBeenCalled();
      expect(tts.isPaused).toBe(false);
    });

    it('non fa nulla se non in pausa', () => {
      tts.isSpeaking = true;
      tts.isPaused = false;
      tts.resume();
      expect(mockSynth.resume).not.toHaveBeenCalled();
    });
  });

  // ─── stop ─────────────────────────────────────────

  describe('stop', () => {
    it('ferma lettura e resetta stato', () => {
      tts.isSpeaking = true;
      tts.isPaused = true;
      tts.currentUtterance = { text: 'test' };
      tts.stop();
      expect(mockSynth.cancel).toHaveBeenCalled();
      expect(tts.isSpeaking).toBe(false);
      expect(tts.isPaused).toBe(false);
      expect(tts.currentUtterance).toBeNull();
    });

    it('dispatcha evento tts:stopped', () => {
      const handler = vi.fn();
      window.addEventListener('tts:stopped', handler);
      tts.isSpeaking = true;
      tts.stop();
      expect(handler).toHaveBeenCalled();
      window.removeEventListener('tts:stopped', handler);
    });

    it('non fa nulla se non sta parlando', () => {
      tts.isSpeaking = false;
      tts.stop();
      expect(mockSynth.cancel).not.toHaveBeenCalled();
    });
  });

  // ─── cleanText ────────────────────────────────────

  describe('cleanText', () => {
    it('rimuove tag HTML', () => {
      expect(tts.cleanText('<b>Bold</b> text')).toBe('Bold text');
    });

    it('converte &nbsp; in spazio', () => {
      expect(tts.cleanText('Hello&nbsp;World')).toBe('Hello World');
    });

    it('rimuove entita HTML', () => {
      expect(tts.cleanText('A &amp; B &lt; C')).toBe('A B C');
    });

    it('normalizza spazi multipli', () => {
      expect(tts.cleanText('Ciao    mondo')).toBe('Ciao mondo');
    });

    it('rimuove caratteri markdown', () => {
      expect(tts.cleanText('**bold** _italic_ ~strike~ `code`')).toBe('bold italic strike code');
    });

    it('fa trim del risultato', () => {
      expect(tts.cleanText('  spazi  ')).toBe('spazi');
    });
  });

  // ─── handleError ──────────────────────────────────

  describe('handleError', () => {
    it('resetta stato e dispatcha tts:error', () => {
      const handler = vi.fn();
      window.addEventListener('tts:error', handler);
      tts.isSpeaking = true;
      tts.isPaused = true;
      tts.handleError({ message: 'test error' });
      expect(tts.isSpeaking).toBe(false);
      expect(tts.isPaused).toBe(false);
      expect(handler).toHaveBeenCalled();
      window.removeEventListener('tts:error', handler);
    });
  });

  // ─── getState ─────────────────────────────────────

  describe('getState', () => {
    it('ritorna stato corrente', () => {
      expect(tts.getState()).toEqual({
        isSpeaking: false,
        isPaused: false,
        currentText: null,
      });
    });

    it('ritorna testo corrente se in lettura', () => {
      tts.isSpeaking = true;
      tts.currentUtterance = { text: 'Ciao' };
      expect(tts.getState().currentText).toBe('Ciao');
    });
  });

  // ─── updateConfig ─────────────────────────────────

  describe('updateConfig', () => {
    it('merge nuova config con esistente', () => {
      tts.updateConfig({ rate: 1.5, lang: 'en-US' });
      expect(tts.config.rate).toBe(1.5);
      expect(tts.config.lang).toBe('en-US');
      expect(tts.config.pitch).toBe(1.0);
    });
  });

  // ─── getAvailableVoices ───────────────────────────

  describe('getAvailableVoices', () => {
    it('ritorna voci gia caricate', async () => {
      tts.availableVoices = [{ name: 'V1', lang: 'it-IT' }];
      const voices = await tts.getAvailableVoices();
      expect(voices).toHaveLength(1);
      expect(voices[0].name).toBe('V1');
    });
  });
});
