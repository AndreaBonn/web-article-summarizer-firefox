// History - testo da leggere per tab del modal dettaglio
import { formatKeyPointsForSpeech, formatQAForSpeech } from '../../shared/speech-text.js';

/**
 * Testo TTS del tab indicato per una voce di cronologia, o null.
 *
 * @param {string} tabName
 * @param {object} entry - voce di cronologia
 * @returns {string|null}
 */
export function getModalSpeechText(tabName, entry) {
  switch (tabName) {
    case 'summary':
      return entry.summary || null;

    case 'keypoints':
      if (!entry.keyPoints) return null;
      return formatKeyPointsForSpeech(entry.keyPoints);

    case 'translation':
      if (!entry.translation) return null;
      return entry.translation.text || entry.translation;

    case 'citations':
      if (!entry.citations?.citations) return null;
      return entry.citations.citations
        .map((citation, index) => {
          let text = `Citazione ${index + 1}. `;
          if (citation.author) text += `${citation.author}. `;
          if (citation.quote_text || citation.text) text += citation.quote_text || citation.text;
          return text;
        })
        .join('. ');

    case 'qa':
      if (!entry.qa || entry.qa.length === 0) return null;
      return formatQAForSpeech(entry.qa);

    case 'notes':
      return entry.notes || null;

    default:
      return null;
  }
}
