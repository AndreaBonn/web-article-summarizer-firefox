// Reading Mode - Voice Module
// Gestisce: TTS controls, STT per Q&A, font size

import { state, elements } from './state.js';
import { VoiceController } from '../../utils/voice/voice-controller.js';
import { STTManager } from '../../utils/voice/stt-manager.js';
import { Logger } from '../../utils/core/logger.js';
import {
  setupTTSEventListeners,
  handleTTSPlay as helperTTSPlay,
  handleTTSPause as helperTTSPause,
  handleTTSStop as helperTTSStop,
} from '../../shared/voice-page-helper.js';
import { eventCleanup } from '../../utils/core/event-cleanup.js';
import { getSpeechTextForTab } from './speech.js';

// ============================================
// VOICE CONTROLS
// ============================================

/**
 * Setup voice event listeners (TTS + STT)
 */
export function setupVoiceEventListeners() {
  // Pulsanti TTS: risolti via elements (popolati da initElements in reading-mode.js)
  setupTTSEventListeners({
    elements,
    onError: (errorDetail) => {
      alert('Errore nella lettura vocale: ' + errorDetail.error);
    },
  });

  // STT events
  eventCleanup.addEventListener(window, 'stt:started', () => {
    if (elements.qaVoiceBtn) {
      elements.qaVoiceBtn.classList.add('listening');
      elements.qaVoiceBtn.textContent = 'Voce';
      elements.qaVoiceBtn.title = 'Ascolto in corso...';
    }
  });

  eventCleanup.addEventListener(window, 'stt:interim', (event) => {
    if (elements.qaInput) {
      elements.qaInput.value = event.detail.transcript;
      elements.qaInput.style.fontStyle = 'italic';
      elements.qaInput.style.color = 'var(--text-secondary)';
    }
  });

  eventCleanup.addEventListener(window, 'stt:result', (event) => {
    if (elements.qaInput) {
      elements.qaInput.value = event.detail.transcript;
      elements.qaInput.style.fontStyle = 'normal';
      elements.qaInput.style.color = 'var(--text-primary)';
    }
    if (elements.qaVoiceBtn) {
      elements.qaVoiceBtn.classList.remove('listening');
      elements.qaVoiceBtn.textContent = 'Voce';
      elements.qaVoiceBtn.title = 'Domanda vocale';
    }
  });

  eventCleanup.addEventListener(window, 'stt:ended', () => {
    if (elements.qaVoiceBtn) {
      elements.qaVoiceBtn.classList.remove('listening');
      elements.qaVoiceBtn.textContent = 'Voce';
      elements.qaVoiceBtn.title = 'Domanda vocale';
    }
  });

  eventCleanup.addEventListener(window, 'stt:error', (event) => {
    Logger.error('STT Error:', event.detail);
    if (elements.qaVoiceBtn) {
      elements.qaVoiceBtn.classList.remove('listening');
      elements.qaVoiceBtn.textContent = 'Voce';
      elements.qaVoiceBtn.title = 'Domanda vocale';
    }
    alert(event.detail.message || 'Errore nel riconoscimento vocale');
  });
}

/**
 * Handle TTS play/resume
 */
export function handleTTSPlay() {
  const lang = state.currentData?.metadata?.language || 'it';
  const voiceLang = VoiceController.mapLanguageCode(lang);

  helperTTSPlay(state.voiceController, getCurrentTabText, voiceLang, () => {
    alert('Nessun testo da leggere');
  });
}

/**
 * Handle TTS pause
 */
export function handleTTSPause() {
  helperTTSPause(state.voiceController);
}

/**
 * Handle TTS stop
 */
export function handleTTSStop() {
  helperTTSStop(state.voiceController);
}

/**
 * Get text from current active tab
 */
function getCurrentTabText() {
  const activeTab = document.querySelector('.summary-tab.active');
  if (!activeTab) return null;

  return getSpeechTextForTab(activeTab.dataset.tab, state.currentData);
}

/**
 * Handle voice input for Q&A
 */
export async function handleVoiceInput() {
  if (!state.voiceController) {
    alert('Controller vocale non inizializzato');
    return;
  }

  if (!STTManager.isSupported()) {
    alert(
      'Il riconoscimento vocale non è supportato in questo browser. Usa Chrome, Edge o Safari.',
    );
    return;
  }

  const sttState = state.voiceController.getSTTState();

  if (sttState.isListening) {
    state.voiceController.stopListening();
    return;
  }

  try {
    const lang = state.currentData?.metadata?.language || 'it';
    const voiceLang = VoiceController.mapLanguageCode(lang);
    await state.voiceController.startListening(voiceLang);
  } catch (error) {
    Logger.error('Voice input error:', error);
  }
}

// ============================================
// FONT SIZE MANAGEMENT
// ============================================

const FONT_SIZES = ['S', 'M', 'L', 'XL'];
let currentFontSizeIndex = 1; // Default: M

/**
 * Load saved font size
 */
export function loadFontSize() {
  const savedSize = localStorage.getItem('readingModeFontSize') || 'M';
  const index = FONT_SIZES.indexOf(savedSize);
  currentFontSizeIndex = index >= 0 ? index : 1;
  applyFontSize();
}

/**
 * Apply font size to body
 */
function applyFontSize() {
  const size = FONT_SIZES[currentFontSizeIndex];
  document.body.setAttribute('data-font-size', size);

  if (elements.fontSizeLabel) {
    elements.fontSizeLabel.textContent = size;
  }

  if (elements.fontDecreaseBtn) {
    elements.fontDecreaseBtn.disabled = currentFontSizeIndex === 0;
  }
  if (elements.fontIncreaseBtn) {
    elements.fontIncreaseBtn.disabled = currentFontSizeIndex === FONT_SIZES.length - 1;
  }

  localStorage.setItem('readingModeFontSize', size);
}

/**
 * Increase font size
 */
export function increaseFontSize() {
  if (currentFontSizeIndex < FONT_SIZES.length - 1) {
    currentFontSizeIndex++;
    applyFontSize();
  }
}

/**
 * Decrease font size
 */
export function decreaseFontSize() {
  if (currentFontSizeIndex > 0) {
    currentFontSizeIndex--;
    applyFontSize();
  }
}
