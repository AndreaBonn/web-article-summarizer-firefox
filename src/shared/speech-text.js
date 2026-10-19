// Testo da leggere ad alta voce (TTS) condiviso tra le pagine

/**
 * Testo TTS dei punti chiave: "1. titolo. descrizione. 2. ..."
 *
 * @param {Array<{title: string, description: string}>} keyPoints
 * @returns {string}
 */
export function formatKeyPointsForSpeech(keyPoints) {
  return keyPoints
    .map((point, index) => `${index + 1}. ${point.title}. ${point.description}`)
    .join('. ');
}

/**
 * Testo TTS delle domande e risposte.
 *
 * @param {Array<{question: string, answer: string}>} qa
 * @returns {string}
 */
export function formatQAForSpeech(qa) {
  return qa.map((item) => `Domanda: ${item.question}. Risposta: ${item.answer}`).join('. ');
}
