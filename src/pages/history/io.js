// io.js — Barrel file for history I/O operations

import { Logger } from '@utils/core/logger.js';
import { state } from './state.js';

export { sendCurrentEmail } from './io-email.js';
export { downloadHistory, importHistory } from './io-backup.js';

// Open Reading Mode from History
export async function openReadingModeFromHistory() {
  if (!state.currentEntry) return;

  // Prepare data for reading mode (include all available data)
  const readingData = {
    article: state.currentEntry.article,
    summary: state.currentEntry.summary,
    keyPoints: state.currentEntry.keyPoints,
    translation: state.currentEntry.translation || null,
    citations: state.currentEntry.citations || null,
    qa: state.currentEntry.qa || null,
    metadata: state.currentEntry.metadata || {},
  };

  Logger.debug('Opening reading mode with data:', readingData);

  // Save to browser.storage.local (persists across tabs)
  try {
    await browser.storage.local.set({ readingModeData: readingData });
  } catch (error) {
    Logger.error('Errore apertura reading mode da cronologia:', error);
    return;
  }

  // Open reading mode in new tab
  window.open(browser.runtime.getURL('src/pages/reading-mode/reading-mode.html'), '_blank');
}
