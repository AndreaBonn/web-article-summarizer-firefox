import { afterEach, describe, expect, it, vi } from 'vitest';
import { state, elements } from '../../src/pages/reading-mode/state.js';
import { getSpeechTextForTab } from '../../src/pages/reading-mode/speech.js';
import { displayContent } from '../../src/pages/reading-mode/display.js';
import { exportToPDF } from '../../src/pages/reading-mode/export.js';
import { PDFExporter } from '../../src/utils/export/pdf-exporter.js';

vi.mock('../../src/utils/export/pdf-exporter.js', () => ({
  PDFExporter: { exportToPDF: vi.fn().mockResolvedValue(undefined) },
}));

const HISTORY_TRANSLATION = {
  text: 'Testo <tradotto>',
  targetLanguage: 'it',
  originalLanguage: 'en',
};

afterEach(() => {
  state.currentData = null;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('translation stored in history shape, read by reading mode', () => {
  it('test_getSpeechTextForTab_objectTranslation_readsTheText', () => {
    expect(getSpeechTextForTab('translation', { translation: HISTORY_TRANSLATION })).toBe(
      'Testo <tradotto>',
    );
  });

  it('test_displayContent_objectTranslation_rendersTheTextEscaped', () => {
    document.body.innerHTML = `
      <div id="wc"></div><div id="rt"></div><div id="prov"></div><div id="lang"></div>
      <div id="sum"></div><div id="kp"></div><div id="tr"></div><div id="ci"></div>
      <div id="at"></div>`;
    Object.assign(elements, {
      articleWordCount: document.getElementById('wc'),
      articleReadTime: document.getElementById('rt'),
      summaryProvider: document.getElementById('prov'),
      summaryLanguage: document.getElementById('lang'),
      summaryTabContent: document.getElementById('sum'),
      keypointsTabContent: document.getElementById('kp'),
      translationTabContent: document.getElementById('tr'),
      citationsTabContent: document.getElementById('ci'),
      articleText: document.getElementById('at'),
      articleIframe: document.createElement('iframe'),
      viewIframeBtn: document.createElement('button'),
      viewTextBtn: document.createElement('button'),
    });
    state.currentData = {
      article: { title: 'T', content: 'Para uno' },
      summary: 'S',
      keyPoints: [],
      translation: HISTORY_TRANSLATION,
    };

    displayContent();

    expect(document.querySelector('#tr .translation-text').textContent).toBe('Testo <tradotto>');
  });

  it('test_exportToPDF_objectTranslation_passesTheTextToTheExporter', async () => {
    elements.exportBtn = document.createElement('button');
    state.currentData = {
      article: { title: 'T', content: 'c' },
      summary: 'S',
      keyPoints: [],
      translation: HISTORY_TRANSLATION,
    };

    await exportToPDF();

    expect(PDFExporter.exportToPDF.mock.calls[0][4]).toBe('Testo <tradotto>');
  });
});
