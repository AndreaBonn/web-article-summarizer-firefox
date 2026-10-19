import { Logger } from '../../utils/core/logger.js';

export async function loadReadingModeData({
  search,
  storage,
  sessionStorage,
  hasExtensionStorage,
}) {
  let currentData;
  try {
    // Try to get data from URL params
    const params = new URLSearchParams(search);
    const historyId = params.get('id');
    const source = params.get('source');

    // Check if loading PDF analysis
    if (source === 'pdf' && hasExtensionStorage) {
      const result = await storage.get(['pdfReadingMode']);
      if (result.pdfReadingMode) {
        currentData = result.pdfReadingMode;
        currentData.isPDF = true;
        // Clean up after loading
        await storage.remove(['pdfReadingMode']);
        Logger.info('Dati PDF caricati:', currentData);
        return currentData;
      }
    }

    if (historyId && hasExtensionStorage) {
      // Load from history using browser.storage (use summaryHistory)
      const result = await storage.get(['summaryHistory']);
      const history = result.summaryHistory || [];
      currentData = history.find((item) => String(item.id) === String(historyId));

      if (!currentData) {
        throw new Error('Riassunto non trovato nella cronologia');
      }

      Logger.info('Dati caricati dalla cronologia:', currentData);
    } else if (hasExtensionStorage) {
      // Try to load from browser.storage (passed from popup)
      const result = await storage.get(['readingModeData']);
      if (result.readingModeData) {
        currentData = result.readingModeData;
        // Clean up after loading
        await storage.remove(['readingModeData']);
      } else {
        // No data available - show helpful message
        throw new Error('NODATA');
      }
    } else {
      // Fallback to sessionStorage (for test files)
      const sessionData = sessionStorage.getItem('readingModeData');
      if (sessionData) {
        try {
          currentData = JSON.parse(sessionData);
        } catch {
          Logger.warn('sessionStorage: dati corrotti, ignorati');
          throw new Error('NODATA');
        }
      } else {
        throw new Error('NODATA');
      }
    }
    return currentData;
  } catch (error) {
    if (error.message === 'NODATA') {
      throw error;
    }
    Logger.error('Error loading data:', error);
    throw error;
  }
}

export function computeSplitPercentage(clientX, rect) {
  const percentage = ((clientX - rect.left) / rect.width) * 100;

  // Limit between 20% and 80%
  if (percentage >= 20 && percentage <= 80) {
    return percentage;
  }
  return null;
}
