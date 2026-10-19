import { describe, expect, it } from 'vitest';
import { unwrapServiceResponse } from '../../src/utils/core/service-response.js';

describe('unwrapServiceResponse', () => {
  it('returns the successful result unchanged', () => {
    const result = { answer: 'An answer', fromCache: true };
    expect(unwrapServiceResponse({ success: true, result }, 'Unavailable')).toBe(result);
  });

  it.each([undefined, null, false])('throws the supplied message for no response: %s', (response) => {
    expect(() => unwrapServiceResponse(response, 'Service unavailable')).toThrow(
      new Error('Service unavailable'),
    );
  });

  it('throws the service error for an unsuccessful response', () => {
    expect(() =>
      unwrapServiceResponse({ success: false, error: 'Provider unavailable' }, 'No response'),
    ).toThrow(new Error('Provider unavailable'));
  });

  it('throws an Error with an empty message when the service error is undefined', () => {
    expect(() => unwrapServiceResponse({ success: false }, 'No response')).toThrow(
      /^$/,
    );
  });
});
