// First-install welcome: opens the options page on its welcome section,
// so a new user learns where the icon is and that a key is needed.

export const WELCOME_URL = 'src/pages/options/options.html#welcome';

export async function openWelcomeOnInstall(details, api = browser) {
  if (details.reason !== 'install') return false;
  await api.tabs.create({ url: api.runtime.getURL(WELCOME_URL) });
  return true;
}
