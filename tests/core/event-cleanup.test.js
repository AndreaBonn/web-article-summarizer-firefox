import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventCleanupManager } from '@utils/core/event-cleanup.js';

describe('EventCleanupManager', () => {
  let manager;
  let mockElement;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    manager = new EventCleanupManager();
    mockElement = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  describe('addEventListener()', () => {
    it('test_addEventListener_validElement_registersListener', () => {
      const handler = vi.fn();
      manager.addEventListener(mockElement, 'click', handler);

      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', handler, {});
      expect(manager.listeners.has(mockElement)).toBe(true);
      expect(manager.listeners.get(mockElement)).toHaveLength(1);
    });

    it('test_addEventListener_multipleOnSameElement_tracksAll', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      manager.addEventListener(mockElement, 'click', handler1);
      manager.addEventListener(mockElement, 'mouseover', handler2);

      expect(manager.listeners.get(mockElement)).toHaveLength(2);
    });

    it('test_addEventListener_nullElement_skips', () => {
      manager.addEventListener(null, 'click', vi.fn());
      expect(manager.listeners.size).toBe(0);
    });

    it('test_addEventListener_withOptions_passesThrough', () => {
      const handler = vi.fn();
      const options = { capture: true };
      manager.addEventListener(mockElement, 'click', handler, options);

      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', handler, options);
    });
  });

  describe('capture listeners (real DOM)', () => {
    const setup = () => {
      const el = document.createElement('div');
      const handler = vi.fn();
      return { el, handler };
    };

    it('test_removeEventListener_captureListener_isActuallyRemoved', () => {
      const { el, handler } = setup();
      manager.addEventListener(el, 'click', handler, { capture: true });
      manager.removeEventListener(el, 'click', handler);
      el.dispatchEvent(new Event('click'));
      expect(handler).not.toHaveBeenCalled();
    });

    it('test_removeAllListeners_captureListener_isActuallyRemoved', () => {
      const { el, handler } = setup();
      manager.addEventListener(el, 'click', handler, true);
      manager.removeAllListeners(el);
      el.dispatchEvent(new Event('click'));
      expect(handler).not.toHaveBeenCalled();
    });

    it('test_cleanupAll_captureListener_isActuallyRemoved', () => {
      const { el, handler } = setup();
      manager.addEventListener(el, 'click', handler, { capture: true });
      manager.cleanupAll();
      el.dispatchEvent(new Event('click'));
      expect(handler).not.toHaveBeenCalled();
    });

    it('test_removeEventListener_unremovedListener_stillFires', () => {
      const { el, handler } = setup();
      manager.addEventListener(el, 'click', handler, { capture: true });
      el.dispatchEvent(new Event('click'));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeEventListener()', () => {
    it('test_removeEventListener_registered_removesFromTracking', () => {
      const handler = vi.fn();
      manager.addEventListener(mockElement, 'click', handler);
      manager.removeEventListener(mockElement, 'click', handler);

      expect(mockElement.removeEventListener).toHaveBeenCalledWith('click', handler, {});
      expect(manager.listeners.has(mockElement)).toBe(false);
    });

    it('test_removeEventListener_oneOfTwo_keepsOther', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      manager.addEventListener(mockElement, 'click', handler1);
      manager.addEventListener(mockElement, 'mouseover', handler2);

      manager.removeEventListener(mockElement, 'click', handler1);

      expect(manager.listeners.get(mockElement)).toHaveLength(1);
      expect(manager.listeners.get(mockElement)[0].event).toBe('mouseover');
    });

    it('test_removeEventListener_nullElement_noError', () => {
      expect(() => manager.removeEventListener(null, 'click', vi.fn())).not.toThrow();
    });

    it('test_removeEventListener_unregisteredElement_noError', () => {
      const otherElement = { removeEventListener: vi.fn() };
      expect(() => manager.removeEventListener(otherElement, 'click', vi.fn())).not.toThrow();
    });
  });

  describe('removeAllListeners()', () => {
    it('test_removeAllListeners_element_removesAllAndUnregisters', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      manager.addEventListener(mockElement, 'click', h1);
      manager.addEventListener(mockElement, 'keydown', h2);

      manager.removeAllListeners(mockElement);

      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(2);
      expect(manager.listeners.has(mockElement)).toBe(false);
    });

    it('test_removeAllListeners_unregisteredElement_noError', () => {
      expect(() => manager.removeAllListeners(mockElement)).not.toThrow();
    });
  });

  describe('cleanupAll()', () => {
    it('test_cleanupAll_multipleElements_removesAllListeners', () => {
      const el2 = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
      manager.addEventListener(mockElement, 'click', vi.fn());
      manager.addEventListener(el2, 'scroll', vi.fn());

      manager.cleanupAll();

      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(1);
      expect(el2.removeEventListener).toHaveBeenCalledTimes(1);
      expect(manager.listeners.size).toBe(0);
    });

    it('test_cleanupAll_removeThrows_continuesWithOthers', () => {
      const badElement = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(() => { throw new Error('DOM error'); }),
      };
      const goodElement = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      manager.addEventListener(badElement, 'click', vi.fn());
      manager.addEventListener(goodElement, 'click', vi.fn());

      manager.cleanupAll();

      expect(goodElement.removeEventListener).toHaveBeenCalled();
      expect(manager.listeners.size).toBe(0);
    });
  });

  describe('getStats()', () => {
    it('test_getStats_empty_returnsZeros', () => {
      const stats = manager.getStats();
      expect(stats).toEqual({
        totalElements: 0,
        totalListeners: 0,
        eventTypes: {},
      });
    });

    it('test_getStats_withListeners_returnsCorrectCounts', () => {
      const el2 = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
      manager.addEventListener(mockElement, 'click', vi.fn());
      manager.addEventListener(mockElement, 'click', vi.fn());
      manager.addEventListener(el2, 'scroll', vi.fn());

      const stats = manager.getStats();
      expect(stats.totalElements).toBe(2);
      expect(stats.totalListeners).toBe(3);
      expect(stats.eventTypes).toEqual({ click: 2, scroll: 1 });
    });
  });
});
