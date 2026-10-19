// Popup Voice Module
// Gestisce: VoiceController locale, handleVoiceQuestion, addTTSButtons, createTTSButton,
//           showVoiceSelector, speakQAAnswer

import { state, elements } from './state.js';
import { translationState } from './features.js';
import { Toast } from '../../utils/core/toast.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { VoiceController } from '../../utils/voice/voice-controller.js';
import { STTManager } from '../../utils/voice/stt-manager.js';
import { askQuestion } from './features.js';
import {
  initVoiceForPage,
  createTTSToggleButton,
  buildVoiceSelectorHTML,
} from '../../shared/voice-page-helper.js';
import { Logger } from '../../utils/core/logger.js';

// Voice Controller locale (il popup non usa state.voiceController)
const voiceHolder = { value: null };

// ============================================
// INIZIALIZZAZIONE
// ============================================

export async function initVoiceController() {
  if (!voiceHolder.value) {
    await initVoiceForPage({ localHolder: voiceHolder });
    Logger.info('Voice Controller inizializzato');
  }
}

// ============================================
// DOMANDA VOCALE (STT)
// ============================================

export async function handleVoiceQuestion() {
  const voiceBtn = document.getElementById('voiceQuestionBtn');
  const listeningIndicator = document.getElementById('listeningIndicator');
  const interimTranscript = document.getElementById('interimTranscript');

  if (!voiceHolder.value) {
    Toast.show(I18n.t('voice.notInitialized'), 'error');
    return;
  }

  if (!STTManager.isSupported()) {
    Toast.show(I18n.t('voice.sttUnsupported'), 'error');
    return;
  }

  try {
    voiceBtn.classList.add('listening');
    listeningIndicator.classList.add('active');
    interimTranscript.classList.remove('hidden');

    const handleInterim = (event) => {
      interimTranscript.textContent = event.detail.transcript;
    };
    window.addEventListener('stt:interim', handleInterim);

    const voiceLang = VoiceController.mapLanguageCode(state.selectedLanguage);
    const transcript = await voiceHolder.value.startListening(voiceLang);

    window.removeEventListener('stt:interim', handleInterim);
    voiceBtn.classList.remove('listening');
    listeningIndicator.classList.remove('active');
    interimTranscript.classList.add('hidden');

    elements.questionInput.value = transcript;
    await askQuestion();
  } catch (error) {
    Logger.error('Errore domanda vocale:', error);
    voiceBtn.classList.remove('listening');
    listeningIndicator.classList.remove('active');
    interimTranscript.classList.add('hidden');
    Toast.show(`${I18n.t('voice.recognitionError')}: ${error.message}`, 'error');
  }
}

// ============================================
// PULSANTI TTS NEI CONTENUTI
// ============================================

export function addTTSButtons() {
  if (!voiceHolder.value) return;

  const voiceLang = VoiceController.mapLanguageCode(state.selectedLanguage);

  const summaryContent = document.getElementById('summaryContent');
  if (summaryContent && !summaryContent.querySelector('.tts-button')) {
    const btn = createTTSButton(state.currentResults.summary, voiceLang, 'Leggi Riassunto');
    summaryContent.insertBefore(btn, summaryContent.firstChild);
  }

  const keypointsContent = document.getElementById('keypointsContent');
  if (keypointsContent && !keypointsContent.querySelector('.tts-button')) {
    const keypointsText = state.currentResults.keyPoints
      .map((kp, i) => `${i + 1}. ${kp.title}. ${kp.description}`)
      .join('. ');
    const btn = createTTSButton(keypointsText, voiceLang, 'Leggi Punti Chiave');
    keypointsContent.insertBefore(btn, keypointsContent.firstChild);
  }

  if (translationState.value) {
    const translationText = document.querySelector('.translation-text');
    if (translationText && !translationText.parentElement.querySelector('.tts-button')) {
      const btn = createTTSButton(translationState.value, voiceLang, 'Leggi Traduzione');
      translationText.parentElement.insertBefore(btn, translationText);
    }
  }
}

export function createTTSButton(text, lang, label = 'Leggi') {
  return createTTSToggleButton(text, lang, label, voiceHolder.value, showVoiceSelector);
}

// ============================================
// SELETTORE VOCE
// ============================================

export async function showVoiceSelector(lang) {
  const voices = voiceHolder.value.ttsManager.getVoicesForLanguage(lang);
  const currentVoice = voiceHolder.value.ttsManager.getPreferredVoice(lang);

  if (voices.length === 0) {
    Toast.show(I18n.t('voice.noVoicesAvailable'), 'info');
    return;
  }

  const modal = document.getElementById('customModal');
  const icon = document.getElementById('modalIcon');
  const title = document.getElementById('modalTitle');
  const message = document.getElementById('modalMessage');
  const confirmBtn = document.getElementById('modalConfirmBtn');
  const cancelBtn = document.getElementById('modalCancelBtn');

  icon.textContent = '🔊';
  title.textContent = I18n.t('voice.selectTitle');
  message.innerHTML = buildVoiceSelectorHTML(voices, currentVoice);
  confirmBtn.textContent = 'Chiudi';
  cancelBtn.classList.add('hidden');
  modal.classList.remove('hidden');

  let selectedVoice = currentVoice;
  document.querySelectorAll('.voice-item').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.voice-item').forEach((i) => {
        i.classList.remove('selected');
        const check = i.querySelector('.voice-check');
        if (check) check.remove();
      });

      item.classList.add('selected');
      const check = document.createElement('span');
      check.className = 'voice-check';
      check.textContent = '✓';
      item.appendChild(check);

      selectedVoice = item.dataset.voice;
    });
  });

  const handleConfirm = async () => {
    if (selectedVoice) {
      await voiceHolder.value.ttsManager.setPreferredVoice(lang, selectedVoice);
      Logger.info(`Voce impostata per ${lang}:`, selectedVoice);
    }
    modal.classList.add('hidden');
    confirmBtn.removeEventListener('click', handleConfirm);
  };

  confirmBtn.addEventListener('click', handleConfirm);

  const overlay = modal.querySelector('.custom-modal-overlay');
  overlay.addEventListener('click', handleConfirm, { once: true });
}

// ============================================
// TTS PER RISPOSTA Q&A
// ============================================

export async function speakQAAnswer(answer) {
  if (!voiceHolder.value) return;

  const voiceLang = VoiceController.mapLanguageCode(state.selectedLanguage);
  voiceHolder.value.speak(answer, voiceLang);
}
