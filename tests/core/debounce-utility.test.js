import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebounceUtility } from '@utils/core/debounce-utility.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// debounce()
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// debounceWithFeedback()
// ---------------------------------------------------------------------------
describe('DebounceUtility.debounceWithFeedback()', () => {
  it('test_debounceWithFeedback_senzaFeedbackEl_esegueNormalmente', () => {
    const fn = vi.fn();
    const debounced = DebounceUtility.debounceWithFeedback(fn, 200, null);

    debounced();
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledOnce();
  });

  it('test_debounceWithFeedback_conFeedbackEl_aggiungeSearingClasseSubito', () => {
    const fn = vi.fn();
    const feedbackEl = { classList: { add: vi.fn(), remove: vi.fn() } };
    const debounced = DebounceUtility.debounceWithFeedback(fn, 200, feedbackEl);

    debounced();

    expect(feedbackEl.classList.add).toHaveBeenCalledWith('searching');
    expect(feedbackEl.classList.remove).not.toHaveBeenCalled();
  });

  it('test_debounceWithFeedback_dopoEsecuzione_rimuoveClasseSearching', () => {
    const fn = vi.fn();
    const feedbackEl = { classList: { add: vi.fn(), remove: vi.fn() } };
    const debounced = DebounceUtility.debounceWithFeedback(fn, 200, feedbackEl);

    debounced();
    vi.advanceTimersByTime(200);

    expect(feedbackEl.classList.remove).toHaveBeenCalledWith('searching');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('test_debounceWithFeedback_chiamateMultiple_soloUltimaEsegue', () => {
    const fn = vi.fn();
    const debounced = DebounceUtility.debounceWithFeedback(fn, 300, null);

    debounced('a');
    debounced('b');
    debounced('c');
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('c');
  });
});

// ---------------------------------------------------------------------------
// throttle()
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// debounceImmediate()
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// debouncePromise()
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// createDebouncer()
// ---------------------------------------------------------------------------
