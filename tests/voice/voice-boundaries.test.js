import { it, expect, vi, afterEach } from 'vitest';
import { VoiceController } from '@utils/voice/voice-controller.js';
import { buildVoiceSelectorHTML } from '@shared/voice-page-helper.js';

afterEach(() => vi.unstubAllGlobals());

it('test_startListening_starts_recognition_and_returns_final_transcript', async () => {
  let recognition;
  vi.stubGlobal(
    'SpeechRecognition',
    class {
      constructor() {
        recognition = this;
        this.start = vi.fn();
      }
    },
  );
  vi.stubGlobal('speechSynthesis', { getVoices: () => [{ name: 'English', lang: 'en-US' }] });
  vi.stubGlobal('browser', { storage: { local: { get: async () => ({}) } } });
  const controller = new VoiceController();
  await controller.initialize();

  const transcript = controller.startListening('en-US');
  const result = Object.assign([{ transcript: 'What is renewable energy?', confidence: 0.95 }], {
    isFinal: true,
  });
  recognition.onresult({ results: [result] });

  expect(recognition.start).toHaveBeenCalledTimes(1);
  expect(recognition.lang).toBe('en-US');
  await expect(transcript).resolves.toBe('What is renewable energy?');
});

it('test_buildVoiceSelectorHTML_renders_malicious_voice_name_as_text', () => {
  const name = '<img src=x onerror=alert(1)>';
  const container = document.createElement('div');
  container.innerHTML = buildVoiceSelectorHTML(
    [{ voiceName: name, lang: 'it-IT', localService: true }],
    name,
  );

  expect(container.querySelector('.voice-name').innerHTML).toBe(
    '&lt;img src=x onerror=alert(1)&gt;',
  );
  expect(container.querySelector('.voice-name').textContent).toBe(name);
  expect(container.querySelector('.voice-item').dataset.voice).toBe(name);
  expect(container.querySelector('img')).toBeNull();
});
