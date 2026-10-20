// Voice Page Helper - Funzionalità TTS/STT condivise tra le pagine
// Usato da: popup/voice.js, reading-mode/voice.js, history/voice.js

import { VoiceController } from '../utils/voice/voice-controller.js';
import { HtmlSanitizer } from '../utils/security/html-sanitizer.js';
import { Logger } from '../utils/core/logger.js';
import { I18n } from '../utils/i18n/i18n.js';

// ============================================
// INIZIALIZZAZIONE
// ============================================

/**
 * Inizializza un VoiceController e lo assegna alla destinazione indicata.
 *
 * @param {object} options
 * @param {object|null}   options.state         - Oggetto state su cui impostare voiceController (opzionale)
 * @param {string}        [options.stateKey]    - Chiave su state dove salvare il controller (default: 'voiceController')
 * @param {object|null}   [options.localHolder] - Oggetto con property 'value' per riferimento locale (opzionale)
 * @returns {Promise<VoiceController>}
 */
export async function initVoiceForPage({
  state = null,
  stateKey = 'voiceController',
  localHolder = null,
} = {}) {
  const controller = new VoiceController();
  await controller.initialize();

  if (state !== null) {
    state[stateKey] = controller;
  }
  if (localHolder !== null) {
    localHolder.value = controller;
  }

  return controller;
}

// ============================================
// AGGIORNAMENTO STATO PULSANTI TTS (play/pause/stop)
// ============================================

/**
 * Aggiorna la visibilità e lo stato dei tre pulsanti TTS standard.
 *
 * Supporta due modalità di risoluzione dei pulsanti:
 * - Via oggetto elements con property ttsPlayBtn/ttsPauseBtn/ttsStopBtn
 * - Via funzione getButtons() che ritorna { playBtn, pauseBtn, stopBtn }
 *
 * @param {'playing'|'paused'|'stopped'} buttonState
 * @param {object} options
 * @param {object|null}   [options.elements]   - Oggetto elements con riferimenti DOM diretti
 * @param {Function|null} [options.getButtons] - Funzione che ritorna { playBtn, pauseBtn, stopBtn }
 */
export function updateTTSButtonState(buttonState, { elements = null, getButtons = null } = {}) {
  let playBtn, pauseBtn, stopBtn;

  if (elements) {
    playBtn = elements.ttsPlayBtn;
    pauseBtn = elements.ttsPauseBtn;
    stopBtn = elements.ttsStopBtn;
  } else if (getButtons) {
    ({ playBtn, pauseBtn, stopBtn } = getButtons());
  }

  if (!playBtn || !pauseBtn || !stopBtn) return;

  switch (buttonState) {
    case 'playing':
      playBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-block';
      stopBtn.style.display = 'inline-block';
      pauseBtn.classList.add('active');
      break;

    case 'paused':
      playBtn.style.display = 'inline-block';
      pauseBtn.style.display = 'none';
      stopBtn.style.display = 'inline-block';
      playBtn.textContent = '▶️';
      playBtn.title = I18n.t('voice.resume');
      break;

    case 'stopped':
      playBtn.style.display = 'inline-block';
      pauseBtn.style.display = 'none';
      stopBtn.style.display = 'none';
      playBtn.textContent = 'Play';
      playBtn.title = I18n.t('reading.ttsPlayTitle');
      pauseBtn.classList.remove('active');
      break;
  }
}

// ============================================
// REGISTRAZIONE LISTENER TTS WINDOW EVENTS
// ============================================

/**
 * Registra i listener sugli eventi TTS globali (tts:started, paused, resumed, stopped, ended, error).
 * Richiama updateTTSButtonState con la risoluzione pulsanti fornita.
 *
 * @param {object} options
 * @param {object|null}   [options.elements]   - Oggetto elements con ttsPlayBtn/ttsPauseBtn/ttsStopBtn
 * @param {Function|null} [options.getButtons] - Funzione che ritorna { playBtn, pauseBtn, stopBtn }
 * @param {Function}      [options.onError]    - Callback per errori TTS: (errorDetail) => void
 */
export function setupTTSEventListeners({
  elements = null,
  getButtons = null,
  onError = null,
} = {}) {
  const resolveOptions = { elements, getButtons };

  window.addEventListener('tts:started', () => {
    updateTTSButtonState('playing', resolveOptions);
  });

  window.addEventListener('tts:paused', () => {
    updateTTSButtonState('paused', resolveOptions);
  });

  window.addEventListener('tts:resumed', () => {
    updateTTSButtonState('playing', resolveOptions);
  });

  window.addEventListener('tts:stopped', () => {
    updateTTSButtonState('stopped', resolveOptions);
  });

  window.addEventListener('tts:ended', () => {
    updateTTSButtonState('stopped', resolveOptions);
  });

  window.addEventListener('tts:error', (event) => {
    Logger.error('TTS Error:', event.detail);
    updateTTSButtonState('stopped', resolveOptions);
    if (onError) {
      onError(event.detail);
    }
  });
}

// ============================================
// LOGICA TTS PLAY/PAUSE/STOP
// ============================================

/**
 * Gestisce play/resume TTS. Se in pausa riprende, altrimenti avvia nuova lettura.
 *
 * @param {VoiceController} voiceController
 * @param {Function} getTextFn - Funzione sincrona che ritorna il testo da leggere (o null)
 * @param {string} lang - Codice lingua BCP-47
 * @param {Function} [onNoText] - Callback invocata se getTextFn ritorna null
 */
export function handleTTSPlay(voiceController, getTextFn, lang, onNoText = null) {
  if (!voiceController) return;

  const ttsState = voiceController.getTTSState();

  if (ttsState.isPaused) {
    voiceController.resumeSpeaking();
    return;
  }

  const text = getTextFn();
  if (!text) {
    if (onNoText) onNoText();
    return;
  }

  voiceController.speak(text, lang);
}

/**
 * Mette in pausa il TTS.
 *
 * @param {VoiceController} voiceController
 */
export function handleTTSPause(voiceController) {
  if (!voiceController) return;
  voiceController.pauseSpeaking();
}

/**
 * Ferma il TTS.
 *
 * @param {VoiceController} voiceController
 */
export function handleTTSStop(voiceController) {
  if (!voiceController) return;
  voiceController.stopSpeaking();
}

// ============================================
// PULSANTE TTS TOGGLE (usato nel popup)
// ============================================

/**
 * Crea un elemento DOM con pulsante TTS toggle (play/stop) e pulsante selezione voce.
 *
 * @param {string}          text            - Testo da leggere
 * @param {string}          lang            - Codice lingua BCP-47
 * @param {string}          label           - Label del pulsante
 * @param {VoiceController} voiceController - Controller da usare
 * @param {Function}        onVoiceSelect   - Callback invocata con (lang) al click sul bottone voce
 * @returns {HTMLElement}
 */
export function createTTSToggleButton(text, lang, label, voiceController, onVoiceSelect) {
  const container = document.createElement('div');
  container.className = 'tts-button-container';

  const button = document.createElement('button');
  button.className = 'tts-button';
  button.innerHTML = `<span>${label}</span>`;
  button.title = label;

  button.addEventListener('click', () => {
    const ttsState = voiceController.getTTSState();

    if (ttsState.isSpeaking) {
      voiceController.stopSpeaking();
      button.classList.remove('active');
      button.innerHTML = `<span>${label}</span>`;
    } else {
      voiceController.speak(text, lang);
      button.classList.add('active');
      button.innerHTML = `<span>${I18n.t('reading.stopText')}</span>`;
    }
  });

  const handleTTSEnd = () => {
    button.classList.remove('active');
    button.innerHTML = `<span>${label}</span>`;
  };
  window.addEventListener('tts:ended', handleTTSEnd);
  window.addEventListener('tts:stopped', handleTTSEnd);

  const voiceBtn = document.createElement('button');
  voiceBtn.className = 'tts-voice-select-btn';
  voiceBtn.innerHTML = '⚙️';
  voiceBtn.title = I18n.t('voice.selectVoice');
  voiceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onVoiceSelect(lang);
  });

  container.appendChild(button);
  container.appendChild(voiceBtn);

  return container;
}

// ============================================
// SELETTORE VOCE (HTML builder)
// ============================================

/**
 * Genera l'HTML della lista voci per il selettore voce.
 *
 * @param {Array<{voiceName: string, lang: string, localService: boolean}>} voices
 * @param {string|null} currentVoice - Nome della voce attualmente selezionata
 * @returns {string} HTML string
 */
export function buildVoiceSelectorHTML(voices, currentVoice) {
  let html = '<div class="voice-list">';

  voices.forEach((voice) => {
    const isSelected = voice.voiceName === currentVoice;
    const localBadge = voice.localService
      ? `<span class="badge-local">${I18n.t('voice.local')}</span>`
      : `<span class="badge-remote">${I18n.t('voice.remote')}</span>`;

    html += `
      <div class="voice-item ${isSelected ? 'selected' : ''}" data-voice="${HtmlSanitizer.escape(voice.voiceName)}">
        <div class="voice-info">
          <div class="voice-name">${HtmlSanitizer.escape(voice.voiceName)}</div>
          <div class="voice-meta">
            <span class="voice-lang">${HtmlSanitizer.escape(voice.lang)}</span>
            ${localBadge}
          </div>
        </div>
        ${isSelected ? '<span class="voice-check">✓</span>' : ''}
      </div>
    `;
  });

  html += '</div>';
  return html;
}
