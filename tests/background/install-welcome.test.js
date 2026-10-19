import { describe, it, expect, vi } from 'vitest';
import { WELCOME_URL, openWelcomeOnInstall } from '../../src/background/install-welcome.js';

function fakeBrowser() {
  return {
    runtime: { getURL: vi.fn((path) => `moz-extension://id/${path}`) },
    tabs: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe('openWelcomeOnInstall', () => {
  it('test_openWelcomeOnInstall_firstInstall_opensWelcomeTab', async () => {
    const api = fakeBrowser();
    const opened = await openWelcomeOnInstall({ reason: 'install' }, api);
    expect(opened).toBe(true);
    expect(api.tabs.create).toHaveBeenCalledWith({
      url: `moz-extension://id/${WELCOME_URL}`,
    });
  });

  it('test_openWelcomeOnInstall_update_doesNotOpenTab', async () => {
    const api = fakeBrowser();
    const opened = await openWelcomeOnInstall({ reason: 'update' }, api);
    expect(opened).toBe(false);
    expect(api.tabs.create).not.toHaveBeenCalled();
  });

  it('test_WELCOME_URL_pointsToOptionsWelcomeSection', () => {
    expect(WELCOME_URL).toBe('src/pages/options/options.html#welcome');
  });
});
