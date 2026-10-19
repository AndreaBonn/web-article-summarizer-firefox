// Popup setup — first-run key entry and the provider list marked by configuration state.

import { state, elements, showState } from './state.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { Logger } from '../../utils/core/logger.js';
import { Toast } from '../../utils/core/toast.js';
import { validateApiKeyFormat } from '../../utils/core/api-key-rules.js';
import { PROVIDERS, getProviderLabel } from '../../utils/core/display-labels.js';

const SETUP_PROVIDER = 'groq';

/**
 * Fill the provider select: configured services selectable, the others disabled
 * and marked, so nobody starts a summary that can only fail.
 */
export function setupProviderSelect(preferredProvider) {
  const configured = state.configuredProviders;
  const select = elements.providerSelect;
  select.replaceChildren(
    ...PROVIDERS.map((provider) => {
      const option = document.createElement('option');
      option.value = provider;
      const isReady = configured.includes(provider);
      option.disabled = !isReady;
      option.textContent = isReady
        ? getProviderLabel(provider)
        : `${getProviderLabel(provider)} (${I18n.t('start.notConfigured')})`;
      return option;
    }),
  );
  select.value = configured.includes(preferredProvider)
    ? preferredProvider
    : configured[0] || preferredProvider;
}

function setStatus(message, type) {
  elements.setupStatus.textContent = message;
  elements.setupStatus.dataset.type = type;
}

function formatErrorText(formatError) {
  if (formatError.code === 'empty') return I18n.t('setup.error.empty');
  if (formatError.code === 'prefix') {
    return I18n.tf('setup.error.prefix', { expected: formatError.expected });
  }
  return I18n.tf('setup.error.length', { min: formatError.min });
}

/**
 * Check the pasted Groq key with a real request, then save it and open the start view.
 */
export async function saveSetupKey() {
  // Enter can fire again while the previous test is still running
  if (elements.setupSaveBtn.disabled) return;
  const key = elements.setupKeyInput.value.trim();
  const formatError = validateApiKeyFormat(SETUP_PROVIDER, key);
  if (formatError) {
    setStatus(formatErrorText(formatError), 'error');
    elements.setupKeyInput.focus();
    return;
  }

  setStatus(I18n.t('setup.status.testing'), 'loading');
  elements.setupSaveBtn.disabled = true;
  try {
    const response = await browser.runtime.sendMessage({
      action: 'testApiKey',
      provider: SETUP_PROVIDER,
      apiKey: key,
    });
    if (!response?.success) {
      setStatus(
        I18n.tf('setup.error.failed', { error: response?.error || I18n.t('error.noResponse') }),
        'error',
      );
      return;
    }

    await StorageManager.saveApiKey(SETUP_PROVIDER, key);
    const settings = await StorageManager.getSettings();
    settings.selectedProvider = SETUP_PROVIDER;
    await StorageManager.saveSettings(settings);

    state.configuredProviders = await StorageManager.getConfiguredProviders();
    setupProviderSelect(SETUP_PROVIDER);
    elements.setupKeyInput.value = '';
    setStatus('', 'idle');
    showState('initial');
    Toast.show(I18n.t('setup.status.ok'), 'success');
  } catch (error) {
    Logger.error('Errore salvataggio chiave dal popup:', error);
    setStatus(I18n.tf('setup.error.failed', { error: error.message }), 'error');
  } finally {
    elements.setupSaveBtn.disabled = false;
  }
}
