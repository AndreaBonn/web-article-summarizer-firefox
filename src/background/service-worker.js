import { AutoMaintenance } from '../utils/core/auto-maintenance.js';
import { Logger } from '../utils/core/logger.js';
import { openWelcomeOnInstall } from './install-welcome.js';
import { createMessageListener } from './message-router.js';
import * as handlers from './message-handlers.js';

// Initialize automatic cache maintenance
const autoMaintenance = new AutoMaintenance();
autoMaintenance.initialize().catch((err) => Logger.error('AutoMaintenance init failed:', err));

// Persistent alarm listener for MV3 (survives service worker restarts)
browser.alarms.onAlarm.addListener((alarm) => {
  autoMaintenance.handleAlarm(alarm);
});

// MV3 Lifecycle Events
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    Logger.info('AI Article Summarizer installato');
    openWelcomeOnInstall(details).catch((error) =>
      Logger.warn('Impossibile aprire la pagina di benvenuto:', error.message),
    );
  } else if (details.reason === 'update') {
    Logger.info(
      'AI Article Summarizer aggiornato alla versione',
      browser.runtime.getManifest().version,
    );
  }
});

browser.runtime.onMessage.addListener(createMessageListener(handlers));
