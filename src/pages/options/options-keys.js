// Options — API key fields: masked loading, autosave with format checks, live test.
import { Logger } from '../../utils/core/logger.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { eventCleanup } from '../../utils/core/event-cleanup.js';
import { validateApiKeyFormat } from '../../utils/core/api-key-rules.js';
import { PROVIDERS } from '../../utils/core/display-labels.js';

const VISIBLE_KEY_CHARS = 4;

export function showStatus(provider, type, message) {
  const statusEl = document.getElementById(`${provider}Status`);
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
}

function formatErrorText(error) {
  if (error.code === 'prefix')
    return I18n.tf('settings.error.prefix', { expected: error.expected });
  if (error.code === 'length') return I18n.tf('settings.error.length', { min: error.min });
  return I18n.t('settings.test.enterKey');
}

export async function loadApiKeys() {
  for (const provider of PROVIDERS) {
    try {
      const key = await StorageManager.getApiKey(provider);
      if (!key) continue;
      const input = document.getElementById(`${provider}Key`);
      // Only the last characters stay readable
      const masked =
        '•'.repeat(Math.max(0, key.length - VISIBLE_KEY_CHARS)) + key.slice(-VISIBLE_KEY_CHARS);
      input.value = masked;
      input.dataset.masked = 'true';
      input.addEventListener('focus', () => {
        if (input.dataset.masked === 'true') {
          input.value = '';
          input.dataset.masked = 'false';
        }
      });
      // Left empty: the saved key is still there, show it again instead of a blank field
      input.addEventListener('blur', () => {
        if (input.value.trim() === '' && input.dataset.masked === 'false') {
          input.value = masked;
          input.dataset.masked = 'true';
        }
      });
      showStatus(provider, 'success', I18n.t('settings.status.configured'));
    } catch (error) {
      Logger.warn(`API key ${provider} in formato obsoleto:`, error.message);
      showStatus(provider, 'error', error.message);
    }
  }
}

/**
 * Save the typed key when its format is valid.
 * @param {boolean} reportErrors - false while typing, true when the field loses focus
 */
async function saveKey(provider, reportErrors) {
  const input = document.getElementById(`${provider}Key`);
  if (input.dataset.masked === 'true') return;
  const key = input.value.trim();
  if (!key) return;

  const formatError = validateApiKeyFormat(provider, key);
  if (formatError) {
    if (reportErrors) showStatus(provider, 'error', formatErrorText(formatError));
    return;
  }
  try {
    await StorageManager.saveApiKey(provider, key);
    showStatus(provider, 'success', I18n.t('settings.status.saved'));
  } catch (error) {
    Logger.error('Errore salvataggio API key:', error);
    showStatus(provider, 'error', I18n.t('settings.error.saveFailed'));
  }
}

async function testApiKey(provider) {
  const input = document.getElementById(`${provider}Key`);
  const key =
    input.dataset.masked === 'true' ? await StorageManager.getApiKey(provider) : input.value.trim();

  if (!key) {
    showStatus(provider, 'error', I18n.t('settings.test.enterKey'));
    return;
  }

  showStatus(provider, 'loading', I18n.t('settings.test.testing'));
  try {
    const response = await browser.runtime.sendMessage({
      action: 'testApiKey',
      provider,
      apiKey: key,
    });
    if (!response) {
      showStatus(provider, 'error', I18n.t('settings.test.genericError'));
    } else if (response.success) {
      showStatus(provider, 'success', I18n.t('settings.test.verified'));
    } else {
      showStatus(provider, 'error', `${I18n.t('settings.test.failed')} ${response.error}`);
    }
  } catch (error) {
    Logger.error('Errore test API key:', error);
    showStatus(provider, 'error', I18n.t('settings.test.genericError'));
  }
}

export function bindKeyInputs() {
  PROVIDERS.forEach((provider) => {
    const input = document.getElementById(`${provider}Key`);
    // A pasted key is complete: save it right away. A typed key is saved on blur only,
    // otherwise it would be stored as soon as it reaches the minimum length, half-typed.
    eventCleanup.addEventListener(input, 'paste', () => {
      setTimeout(() => saveKey(provider, true), 0);
    });
    eventCleanup.addEventListener(input, 'change', () => saveKey(provider, true));
  });
  document.querySelectorAll('.btn-test').forEach((btn) => {
    eventCleanup.addEventListener(btn, 'click', () => testApiKey(btn.dataset.provider));
  });
}

// "#groq" from the popup: bring that provider's field into view
export function focusProviderFromHash(hash) {
  const provider = hash.replace('#', '');
  if (!PROVIDERS.includes(provider)) return false;
  const group = document.getElementById(`${provider}Group`);
  group.scrollIntoView({ block: 'center' });
  group.classList.add('highlight');
  document.getElementById(`${provider}Key`).focus();
  return true;
}
