import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const maintenance = vi.hoisted(() => ({ initialize: vi.fn(), handleAlarm: vi.fn() }));
vi.mock('../../src/utils/core/auto-maintenance.js', () => ({
  AutoMaintenance: vi.fn(function () {
    return maintenance;
  }),
}));
vi.mock('../../src/utils/core/logger.js', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('../../src/background/install-welcome.js', () => ({
  openWelcomeOnInstall: vi.fn().mockResolvedValue(true),
}));

function fakeBrowser() {
  return {
    runtime: {
      id: 'extension-id',
      getManifest: vi.fn(() => ({ version: '2.2.0' })),
      onInstalled: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn() },
    },
    alarms: { onAlarm: { addListener: vi.fn() } },
  };
}

describe('service worker wiring', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    maintenance.initialize.mockResolvedValue();
    vi.stubGlobal('browser', fakeBrowser());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('test_serviceWorker_import_registersOneListenerAndInitializesMaintenance', async () => {
    await import('../../src/background/service-worker.js');
    const { browser } = globalThis;
    expect(maintenance.initialize).toHaveBeenCalledOnce();
    expect(browser.runtime.onMessage.addListener).toHaveBeenCalledOnce();
    const listener = browser.runtime.onMessage.addListener.mock.calls[0][0];
    expect(listener({ action: 'unknown' }, { id: 'extension-id' }, vi.fn())).toBe(false);
    expect(browser.alarms.onAlarm.addListener).toHaveBeenCalledOnce();
    const alarm = { name: 'maintenance' };
    browser.alarms.onAlarm.addListener.mock.calls[0][0](alarm);
    expect(maintenance.handleAlarm).toHaveBeenCalledWith(alarm);
    expect(browser.runtime.onInstalled.addListener).toHaveBeenCalledOnce();
    const installed = browser.runtime.onInstalled.addListener.mock.calls[0][0];
    const { openWelcomeOnInstall } = await import('../../src/background/install-welcome.js');
    installed({ reason: 'install' });
    expect(openWelcomeOnInstall).toHaveBeenCalledWith({ reason: 'install' });
    installed({ reason: 'update' });
    const { Logger } = await import('../../src/utils/core/logger.js');
    expect(Logger.info).toHaveBeenCalledWith(
      'AI Article Summarizer aggiornato alla versione',
      '2.2.0',
    );
  });

  it('test_serviceWorker_initializationFailure_logsError', async () => {
    const error = new Error('Alarm unavailable');
    maintenance.initialize.mockRejectedValue(error);
    await import('../../src/background/service-worker.js');
    const { browser } = globalThis;
    const { Logger } = await import('../../src/utils/core/logger.js');
    await vi.waitFor(() =>
      expect(Logger.error).toHaveBeenCalledWith('AutoMaintenance init failed:', error),
    );
    expect(browser.runtime.onMessage.addListener).toHaveBeenCalledOnce();
  });
});
