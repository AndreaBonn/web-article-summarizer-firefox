// Display Labels — turns stored identifiers (provider ids, language codes, content types,
// timestamps, tab URLs) into the words people read in the UI.

export const PROVIDERS = ['groq', 'openai', 'anthropic', 'gemini'];

const PROVIDER_LABELS = {
  groq: 'Groq',
  openai: 'OpenAI',
  anthropic: 'Claude',
  gemini: 'Gemini',
};

const LANGUAGE_LABELS = {
  it: { it: 'Italiano', en: 'Inglese', es: 'Spagnolo', fr: 'Francese', de: 'Tedesco' },
  en: { it: 'Italian', en: 'English', es: 'Spanish', fr: 'French', de: 'German' },
};

const CONTENT_TYPE_LABELS = {
  it: {
    general: 'Generico',
    scientific: 'Scientifico',
    news: 'Notizia',
    tutorial: 'Guida',
    business: 'Business',
    opinion: 'Opinione',
  },
  en: {
    general: 'General',
    scientific: 'Scientific',
    news: 'News',
    tutorial: 'Guide',
    business: 'Business',
    opinion: 'Opinion',
  },
};

const DATE_LOCALES = { it: 'it-IT', en: 'en-US' };

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_DAYS_LIMIT = 7;

// Same exclusions as manifest.json content_scripts: the extractor never runs there.
// "https://accounts.google.com/*" is one host, "https://*.banking.com/*" also covers the apex.
const EXCLUDED_HOSTS = ['accounts.google.com'];
const EXCLUDED_DOMAINS = ['banking.com'];

function uiLang(lang) {
  return lang === 'en' ? 'en' : 'it';
}

export function getProviderLabel(provider) {
  return PROVIDER_LABELS[provider] || provider;
}

export function getLanguageLabel(code, lang = 'it') {
  return LANGUAGE_LABELS[uiLang(lang)][code] || code;
}

export function getContentTypeLabel(type, lang = 'it') {
  return CONTENT_TYPE_LABELS[uiLang(lang)][type] || type;
}

/**
 * Relative date in the UI language ("ieri", "3 ore fa", "2 days ago"),
 * calendar date beyond a week.
 */
export function formatRelativeDate(timestamp, now = Date.now(), lang = 'it') {
  const locale = DATE_LOCALES[uiLang(lang)];
  const diffMs = now - timestamp;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffMs < MINUTE_MS) return rtf.format(0, 'second');
  if (diffMs < HOUR_MS) return rtf.format(-Math.floor(diffMs / MINUTE_MS), 'minute');
  if (diffMs < DAY_MS) return rtf.format(-Math.floor(diffMs / HOUR_MS), 'hour');

  const diffDays = Math.floor(diffMs / DAY_MS);
  if (diffDays < RELATIVE_DAYS_LIMIT) return rtf.format(-diffDays, 'day');

  return new Date(timestamp).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * True when the content script can read the page: https only, minus excluded hosts.
 */
export function isSupportedArticleUrl(url) {
  if (!url) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname;
  if (EXCLUDED_HOSTS.includes(host)) return false;
  return !EXCLUDED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
