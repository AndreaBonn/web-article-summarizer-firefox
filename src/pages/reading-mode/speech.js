// Reading Mode - testo da leggere per tab
import { formatKeyPointsForSpeech, formatQAForSpeech } from '../../shared/speech-text.js';

/**
 * Testo TTS del tab indicato, o null se non c'è nulla da leggere.
 *
 * @param {string} tabName
 * @param {object} data - dati correnti del reading mode
 * @returns {string|null}
 */
export function getSpeechTextForTab(tabName, data) {
  switch (tabName) {
    case 'summary':
      return data?.summary || null;

    case 'keypoints':
      if (!data?.keyPoints) return null;
      return formatKeyPointsForSpeech(data.keyPoints);

    case 'translation':
      return data?.translation || null;

    case 'citations':
      if (!data?.citations?.citations) return null;
      return data.citations.citations
        .map((citation, index) => {
          let text = `Citazione ${index + 1}. `;
          if (citation.author) text += `${citation.author}. `;
          if (citation.quote_text) text += citation.quote_text;
          return text;
        })
        .join('. ');

    case 'qa':
      if (!data?.qa || data.qa.length === 0) return null;
      return formatQAForSpeech(data.qa);

    default:
      return null;
  }
}
