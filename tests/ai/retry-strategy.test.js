import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryStrategy, TEMPORARY_ERRORS, PERMANENT_ERRORS } from '@utils/ai/retry-strategy.js';

describe('RetryStrategy', () => {
  let strategy;
  let logApiCall;

  beforeEach(() => {
    vi.useFakeTimers();
    strategy = new RetryStrategy();
    logApiCall = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── extractStatusCode ────────────────────────────────────────────────────

  describe('extractStatusCode', () => {
    it('test_extractStatusCode_fromStatusProperty_returnsCode', () => {
      // Arrange
      const error = new Error('fail');
      error.status = 429;
      // Act
      const code = strategy.extractStatusCode(error);
      // Assert
      expect(code).toBe(429);
    });

    it('test_extractStatusCode_fromMessage_returnsCode', () => {
      // Arrange — covers "status: 500", "code: 503", and leading numeric patterns
      const cases = [
        { msg: 'status: 500', expected: 500 },
        { msg: 'code: 503', expected: 503 },
        { msg: '502 Bad Gateway', expected: 502 },
        { msg: 'errore: 429 rate limit', expected: 429 },
      ];

      for (const { msg, expected } of cases) {
        // Act
        const code = strategy.extractStatusCode(new Error(msg));
        // Assert
        expect(code).toBe(expected);
      }
    });

    it('test_extractStatusCode_noCode_returnsNull', () => {
      // Arrange
      const error = new Error('Something completely generic happened');
      // Act
      const code = strategy.extractStatusCode(error);
      // Assert
      expect(code).toBeNull();
    });
  });

  // ─── callWithRetry ────────────────────────────────────────────────────────

  describe('callWithRetry', () => {
    it('test_callWithRetry_firstAttemptSuccess_returnsResult', async () => {
      // Arrange
      const apiCall = vi.fn().mockResolvedValue('success');
      // Act
      const promise = strategy.callWithRetry(apiCall, {}, logApiCall);
      await vi.runAllTimersAsync();
      const result = await promise;
      // Assert
      expect(result).toBe('success');
      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(logApiCall).toHaveBeenCalledWith(expect.objectContaining({ success: true, attempt: 1 }));
    });

    it('test_callWithRetry_permanentError_throwsImmediately', async () => {
      // Arrange — 401 is in PERMANENT_ERRORS
      const error = new Error('401 Unauthorized');
      const apiCall = vi.fn().mockRejectedValue(error);
      // Act + Assert — permanent errors reject without needing timers
      await expect(
        strategy.callWithRetry(apiCall, { maxRetries: 3 }, logApiCall),
      ).rejects.toThrow('401 Unauthorized');
      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(logApiCall).toHaveBeenCalledWith(expect.objectContaining({ success: false, permanent: true }));
    });

    it('test_callWithRetry_temporaryErrorThenSuccess_retriesAndReturns', async () => {
      // Arrange — first call throws 503, second succeeds
      const error = new Error('503 Service Unavailable');
      const apiCall = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('recovered');
      // Act
      const promise = strategy.callWithRetry(
        apiCall,
        { maxRetries: 2, initialDelay: 100 },
        logApiCall,
      );
      await vi.runAllTimersAsync();
      const result = await promise;
      // Assert
      expect(result).toBe('recovered');
      expect(apiCall).toHaveBeenCalledTimes(2);
    });

    it('test_callWithRetry_allAttemptsFail_throwsLastError', async () => {
      // Arrange — always fails with a 500
      const error = new Error('500 Internal Server Error');
      const apiCall = vi.fn().mockRejectedValue(error);
      // Attach catch before advancing timers to avoid unhandled rejection
      const promise = strategy.callWithRetry(
        apiCall,
        { maxRetries: 2, initialDelay: 100 },
        logApiCall,
      );
      const caught = promise.catch((e) => e);
      // Act
      await vi.runAllTimersAsync();
      const result = await caught;
      // Assert
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('500 Internal Server Error');
      expect(apiCall).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('test_callWithRetry_exponentialBackoff_correctDelays', async () => {
      // Arrange
      const sleepSpy = vi.spyOn(strategy, 'sleep').mockResolvedValue(undefined);
      const error = new Error('500 Internal Server Error');
      const apiCall = vi.fn().mockRejectedValue(error);
      // Attach catch before advancing timers to avoid unhandled rejection
      const promise = strategy.callWithRetry(
        apiCall,
        { maxRetries: 3, initialDelay: 1000, backoffMultiplier: 2, maxDelay: 8000 },
        logApiCall,
      ).catch(() => {});
      // Act
      await vi.runAllTimersAsync();
      await promise;
      // Assert — delays: 1000, 2000, 4000
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000);
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
      expect(sleepSpy).toHaveBeenNthCalledWith(3, 4000);
    });

    it('test_callWithRetry_maxDelay_cappedCorrectly', async () => {
      const attemptTimes = [];
      const apiCall = vi.fn(async () => {
        attemptTimes.push(Date.now());
        if (attemptTimes.length < 4) throw new Error('503 Service Unavailable');
        return 'recovered';
      });
      const promise = strategy.callWithRetry(
        apiCall,
        { maxRetries: 3, initialDelay: 3000, backoffMultiplier: 2, maxDelay: 8000 },
        logApiCall,
      );

      await vi.runAllTimersAsync();

      expect(await promise).toBe('recovered');
      expect(apiCall).toHaveBeenCalledTimes(4);
      expect(attemptTimes.slice(1).map((time, index) => time - attemptTimes[index])).toEqual([
        3000, 6000, 8000,
      ]);
    });

    it('test_callWithRetry_onRetryCallback_calledWithCorrectArgs', async () => {
      // Arrange
      vi.spyOn(strategy, 'sleep').mockResolvedValue(undefined);
      const onRetry = vi.fn();
      const error = new Error('503 Service Unavailable');
      const apiCall = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('ok');
      // Act
      const promise = strategy.callWithRetry(
        apiCall,
        { maxRetries: 2, initialDelay: 1000, onRetry },
        logApiCall,
      );
      await vi.runAllTimersAsync();
      await promise;
      // Assert — onRetry(attempt, maxRetries+1, delay)
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, 3, 1000);
    });

    it('test_callWithRetry_logApiCall_calledOnSuccessAndFailure', async () => {
      // Arrange — one failure then success
      vi.spyOn(strategy, 'sleep').mockResolvedValue(undefined);
      const error = new Error('500 Internal Server Error');
      const apiCall = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('final');
      // Act
      const promise = strategy.callWithRetry(
        apiCall,
        { maxRetries: 2, initialDelay: 100 },
        logApiCall,
      );
      await vi.runAllTimersAsync();
      await promise;
      // Assert — logged once for the failure (retrying) and once for the success
      expect(logApiCall).toHaveBeenCalledTimes(2);
      expect(logApiCall).toHaveBeenCalledWith(expect.objectContaining({ success: false, retrying: true }));
      expect(logApiCall).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ─── exported constants ───────────────────────────────────────────────────

  describe('exported constants', () => {
    it('TEMPORARY_ERRORS contains expected status codes', () => {
      expect(TEMPORARY_ERRORS).toEqual(expect.arrayContaining([429, 500, 502, 503, 504]));
    });

    it('PERMANENT_ERRORS contains expected status codes', () => {
      expect(PERMANENT_ERRORS).toEqual(expect.arrayContaining([400, 401, 403, 404]));
    });
  });
});
