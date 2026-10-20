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
import { createFontSizeControl } from '../../shared/font-size-control.js';
import { getSpeechTextForTab } from './speech.js';
import { I18n } from '../../utils/i18n/i18n.js';

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
      alert(I18n.t('voice.readError') + ' ' + errorDetail.error);
    },
  });

  // STT events
  eventCleanup.addEventListener(window, 'stt:started', () => {
    if (elements.qaVoiceBtn) {
      elements.qaVoiceBtn.classList.add('listening');
      elements.qaVoiceBtn.textContent = I18n.t('reading.voiceText');
      elements.qaVoiceBtn.title = I18n.t('qa.listening');
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
      elements.qaVoiceBtn.textContent = I18n.t('reading.voiceText');
      elements.qaVoiceBtn.title = I18n.t('reading.voiceTitle');
    }
  });

  eventCleanup.addEventListener(window, 'stt:ended', () => {
    if (elements.qaVoiceBtn) {
      elements.qaVoiceBtn.classList.remove('listening');
      elements.qaVoiceBtn.textContent = I18n.t('reading.voiceText');
      elements.qaVoiceBtn.title = I18n.t('reading.voiceTitle');
    }
  });

  eventCleanup.addEventListener(window, 'stt:error', (event) => {
    Logger.error('STT Error:', event.detail);
    if (elements.qaVoiceBtn) {
      elements.qaVoiceBtn.classList.remove('listening');
      elements.qaVoiceBtn.textContent = I18n.t('reading.voiceText');
      elements.qaVoiceBtn.title = I18n.t('reading.voiceTitle');
    }
    alert(event.detail.message || I18n.t('voice.recognitionError'));
  });
}

/**
 * Handle TTS play/resume
 */
export function handleTTSPlay() {
  const lang = state.currentData?.metadata?.language || 'it';
  const voiceLang = VoiceController.mapLanguageCode(lang);

  helperTTSPlay(state.voiceController, getCurrentTabText, voiceLang, () => {
    alert(I18n.t('voice.noText'));
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
    alert(I18n.t('voice.notInitialized'));
    return;
  }

  if (!STTManager.isSupported()) {
    alert(I18n.t('voice.sttUnsupported'));
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

const fontSizeControl = createFontSizeControl({
  storageKey: 'readingModeFontSize',
  getLabel: () => elements.fontSizeLabel,
  getDecreaseBtn: () => elements.fontDecreaseBtn,
  getIncreaseBtn: () => elements.fontIncreaseBtn,
});

/**
 * Load saved font size
 */
export function loadFontSize() {
  fontSizeControl.load();
}

/**
 * Increase font size
 */
export function increaseFontSize() {
  fontSizeControl.increase();
}

/**
 * Decrease font size
 */
export function decreaseFontSize() {
  fontSizeControl.decrease();
}
