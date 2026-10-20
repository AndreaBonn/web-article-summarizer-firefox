import { describe, it, expect } from 'vitest';
import {
  computeUsageSummary,
  createSerialQueue,
  applyPreferences,
  applyPerformanceSettings,
  formatPerformanceStats,
} from '@pages/options/options-stats.js';

describe('options statistics and preferences', () => {
  it('computes empty usage without choosing a provider', () => {
    expect(computeUsageSummary()).toEqual({
      totalSummaries: 0,
      totalWordsLabel: '0',
      mostUsedProvider: undefined,
      timeSavedLabel: '0.0h',
    });
  });

  it('formats words, hours and the most used provider', () => {
    expect(
      computeUsageSummary({
        totalSummaries: 12,
        totalWords: 13500,
        providerUsage: { groq: 3, openai: 9 },
      }),
    ).toEqual({
      totalSummaries: 12,
      totalWordsLabel: (13500).toLocaleString(),
      mostUsedProvider: 'openai',
      timeSavedLabel: '1.0h',
    });
  });

  it('preserves the existing last-provider tie resolution', () => {
    expect(
      computeUsageSummary({
        totalSummaries: 4,
        totalWords: 224,
        providerUsage: { groq: 2, openai: 2 },
      }),
    ).toEqual({
      totalSummaries: 4,
      totalWordsLabel: '224',
      mostUsedProvider: 'openai',
      timeSavedLabel: '0.0h',
    });
  });

  it('applies preferences to a new settings object', () => {
    const settings = { cacheTTL: 7, selectedProvider: 'groq', saveHistory: true };
    expect(
      applyPreferences(settings, {
        defaultProvider: { value: 'anthropic' },
        saveHistory: { checked: false },
      }),
    ).toEqual({
      cacheTTL: 7,
      selectedProvider: 'anthropic',
      saveHistory: false,
      summaryLength: 'detailed',
      tone: 'neutral',
    });
    expect(settings).toEqual({ cacheTTL: 7, selectedProvider: 'groq', saveHistory: true });
  });

  it('applies performance controls while preserving other preferences', () => {
    const settings = { selectedProvider: 'groq', cacheTTL: 7 };
    expect(
      applyPerformanceSettings(settings, {
        enableCache: { checked: false },
        cacheTTL: { value: '14' },
        enableFallback: { checked: true },
        autoCleanup: { checked: true },
      }),
    ).toEqual({
      selectedProvider: 'groq',
      cacheTTL: 14,
      enableCache: false,
      enableFallback: true,
      autoCleanup: true,
    });
    expect(settings).toEqual({ selectedProvider: 'groq', cacheTTL: 7 });
  });

  it.each(['', 'abc', '0', '-3'])(
    'keeps the previous cache TTL when the field holds %j',
    (value) => {
      const form = {
        enableCache: { checked: true },
        cacheTTL: { value },
        enableFallback: { checked: true },
        autoCleanup: { checked: true },
      };
      expect(applyPerformanceSettings({ cacheTTL: 14 }, form).cacheTTL).toBe(14);
      expect(applyPerformanceSettings({}, form).cacheTTL).toBe(7);
    },
  );

  it('formats all performance counters and units', () => {
    expect(
      formatPerformanceStats({
        cacheStats: { validEntries: 8, hitRate: 75, sizeMB: 2, totalHits: 6 },
        apiStats: { successRate: 90, retryCount: 2, fallbackCount: 1, failureCount: 3 },
      }),
    ).toEqual({
      cacheEntries: 8,
      cacheHitRate: '75%',
      cacheSize: '2 MB',
      cacheSaved: 6,
      apiSuccessRate: '90%',
      apiRetries: 2,
      apiFallbacks: 1,
      apiFailures: 3,
    });
    expect(formatPerformanceStats({ cacheStats: null, apiStats: null })).toEqual({});
  });

  it('serializes successful tasks and returns each result', async () => {
    const enqueue = createSerialQueue();
    const events = [];
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const first = enqueue(async () => {
      events.push('first');
      await gate;
      return 11;
    });
    const second = enqueue(() => {
      events.push('second');
      return 22;
    });
    await Promise.resolve();
    expect(events).toEqual(['first']);
    release();
    expect(await Promise.all([first, second])).toEqual([11, 22]);
    expect(events).toEqual(['first', 'second']);
  });

  it('starts the next task after rejection and preserves the first error', async () => {
    const enqueue = createSerialQueue();
    const events = [];
    const error = new Error('Save failed');
    const first = enqueue(() => {
      events.push('failed');
      throw error;
    });
    const second = enqueue(() => {
      events.push('recovered');
      return 'saved';
    });
    await expect(first).rejects.toBe(error);
    await expect(second).resolves.toBe('saved');
    expect(events).toEqual(['failed', 'recovered']);
  });
});
