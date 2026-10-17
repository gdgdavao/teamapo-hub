import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isSaveDataOrSlowConnection } from '../../src/hooks/usePrefetchEvent';

describe('isSaveDataOrSlowConnection', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('returns false when navigator is undefined', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(isSaveDataOrSlowConnection()).toBe(true);
  });

  it('returns false when navigator.connection is missing (Safari, Firefox)', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
    expect(isSaveDataOrSlowConnection()).toBe(false);
  });

  it('returns true when connection.saveData is true', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        connection: {
          saveData: true,
          effectiveType: '4g',
        },
      },
      writable: true,
      configurable: true,
    });
    expect(isSaveDataOrSlowConnection()).toBe(true);
  });

  it('returns true when connection.effectiveType is 2g or slow-2g', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        connection: {
          saveData: false,
          effectiveType: '2g',
        },
      },
      writable: true,
      configurable: true,
    });
    expect(isSaveDataOrSlowConnection()).toBe(true);

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        connection: {
          saveData: false,
          effectiveType: 'slow-2g',
        },
      },
      writable: true,
      configurable: true,
    });
    expect(isSaveDataOrSlowConnection()).toBe(true);
  });

  it('returns false on standard 4g connection without saveData', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        connection: {
          saveData: false,
          effectiveType: '4g',
        },
      },
      writable: true,
      configurable: true,
    });
    expect(isSaveDataOrSlowConnection()).toBe(false);
  });
});
