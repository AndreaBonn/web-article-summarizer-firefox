import { describe, it, expect } from 'vitest';
import {
  PROVIDERS,
  getProviderLabel,
  getLanguageLabel,
  getContentTypeLabel,
  formatRelativeDate,
  isSupportedArticleUrl,
} from '@utils/core/display-labels.js';

const NOW = new Date('2026-10-19T12:00:00Z').getTime();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('display-labels', () => {
  describe('getProviderLabel', () => {
    it('test_getProviderLabel_knownIds_returnsBrandNames', () => {
      expect(getProviderLabel('groq')).toBe('Groq');
      expect(getProviderLabel('openai')).toBe('OpenAI');
      expect(getProviderLabel('anthropic')).toBe('Claude');
      expect(getProviderLabel('gemini')).toBe('Gemini');
    });

    it('test_getProviderLabel_unknownId_returnsIdUnchanged', () => {
      expect(getProviderLabel('mistral')).toBe('mistral');
    });

    it('test_PROVIDERS_listsAllFourProvidersInOrder', () => {
      expect(PROVIDERS).toEqual(['groq', 'openai', 'anthropic', 'gemini']);
    });
  });

  describe('getLanguageLabel', () => {
    it('test_getLanguageLabel_italianUi_returnsItalianName', () => {
      expect(getLanguageLabel('it', 'it')).toBe('Italiano');
      expect(getLanguageLabel('en', 'it')).toBe('Inglese');
    });

    it('test_getLanguageLabel_englishUi_returnsEnglishName', () => {
      expect(getLanguageLabel('it', 'en')).toBe('Italian');
      expect(getLanguageLabel('de', 'en')).toBe('German');
    });

    it('test_getLanguageLabel_unknownCode_returnsCodeUnchanged', () => {
      expect(getLanguageLabel('xx', 'it')).toBe('xx');
    });
  });

  describe('getContentTypeLabel', () => {
    it('test_getContentTypeLabel_news_returnsReadableLabelPerUiLanguage', () => {
      expect(getContentTypeLabel('news', 'it')).toBe('Notizia');
      expect(getContentTypeLabel('news', 'en')).toBe('News');
      expect(getContentTypeLabel('tutorial', 'it')).toBe('Guida');
      expect(getContentTypeLabel('scientific', 'en')).toBe('Scientific');
    });

    it('test_getContentTypeLabel_unknownType_returnsTypeUnchanged', () => {
      expect(getContentTypeLabel('poem', 'it')).toBe('poem');
    });
  });

  describe('formatRelativeDate', () => {
    it('test_formatRelativeDate_underOneMinute_returnsNow', () => {
      expect(formatRelativeDate(NOW - 10_000, NOW, 'it')).toBe('ora');
      expect(formatRelativeDate(NOW - 10_000, NOW, 'en')).toBe('now');
    });

    it('test_formatRelativeDate_minutesAndHours_returnsLocalizedPhrase', () => {
      expect(formatRelativeDate(NOW - 5 * MIN, NOW, 'it')).toBe('5 minuti fa');
      expect(formatRelativeDate(NOW - 3 * HOUR, NOW, 'it')).toBe('3 ore fa');
      expect(formatRelativeDate(NOW - 3 * HOUR, NOW, 'en')).toBe('3 hours ago');
    });

    it('test_formatRelativeDate_oneDay_returnsYesterdayNotOneDays', () => {
      expect(formatRelativeDate(NOW - 1.3 * DAY, NOW, 'it')).toBe('ieri');
      expect(formatRelativeDate(NOW - 1.3 * DAY, NOW, 'en')).toBe('yesterday');
    });

    it('test_formatRelativeDate_severalDays_returnsDaysAgo', () => {
      expect(formatRelativeDate(NOW - 2.6 * DAY, NOW, 'it')).toBe('l’altro ieri');
      expect(formatRelativeDate(NOW - 3.2 * DAY, NOW, 'it')).toBe('3 giorni fa');
      expect(formatRelativeDate(NOW - 2.6 * DAY, NOW, 'en')).toBe('2 days ago');
    });

    it('test_formatRelativeDate_olderThanAWeek_returnsCalendarDate', () => {
      const old = new Date('2024-01-15T10:00:00Z').getTime();
      expect(formatRelativeDate(old, NOW, 'it')).toBe('15/01/2024');
      expect(formatRelativeDate(old, NOW, 'en')).toBe('01/15/2024');
    });
  });

  describe('isSupportedArticleUrl', () => {
    it('test_isSupportedArticleUrl_httpsPage_returnsTrue', () => {
      expect(isSupportedArticleUrl('https://esempio.it/articolo')).toBe(true);
    });

    it('test_isSupportedArticleUrl_firefoxInternalAndHttp_returnsFalse', () => {
      expect(isSupportedArticleUrl('about:newtab')).toBe(false);
      expect(isSupportedArticleUrl('moz-extension://abc/page.html')).toBe(false);
      expect(isSupportedArticleUrl('http://esempio.it/articolo')).toBe(false);
      expect(isSupportedArticleUrl('file:///home/a.html')).toBe(false);
    });

    it('test_isSupportedArticleUrl_excludedSites_returnsFalse', () => {
      expect(isSupportedArticleUrl('https://accounts.google.com/signin')).toBe(false);
      expect(isSupportedArticleUrl('https://www.banking.com/conto')).toBe(false);
      expect(isSupportedArticleUrl('https://banking.com/conto')).toBe(false);
      expect(isSupportedArticleUrl('https://notbanking.com/articolo')).toBe(true);
    });

    it('test_isSupportedArticleUrl_missingOrInvalid_returnsFalse', () => {
      expect(isSupportedArticleUrl(undefined)).toBe(false);
      expect(isSupportedArticleUrl('')).toBe(false);
      expect(isSupportedArticleUrl('not a url')).toBe(false);
    });
  });
});
