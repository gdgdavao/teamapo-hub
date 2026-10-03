import { describe, it, expect } from 'vitest';
import { logger } from '../../src/utils/logger';
import loggerDefault from '../../src/utils/logger';

describe('logger', () => {
  const expectedMethods = [
    'log', 'info', 'warn', 'error', 'debug',
    'group', 'groupEnd', 'table', 'time', 'timeEnd',
  ] as const;

  it('exposes all expected logging methods', () => {
    for (const method of expectedMethods) {
      expect(logger).toHaveProperty(method);
      expect(typeof logger[method]).toBe('function');
    }
  });

  it('default export is identical to named export', () => {
    expect(loggerDefault).toBe(logger);
  });

  it('all methods are callable without throwing', () => {
    // In test environment import.meta.env.DEV is falsy, so these are no-ops.
    // We verify they do not throw regardless.
    expect(() => logger.log('test')).not.toThrow();
    expect(() => logger.info('test')).not.toThrow();
    expect(() => logger.warn('test')).not.toThrow();
    expect(() => logger.error('test')).not.toThrow();
    expect(() => logger.debug('test')).not.toThrow();
    expect(() => logger.group('group')).not.toThrow();
    expect(() => logger.groupEnd()).not.toThrow();
    expect(() => logger.table({ a: 1 })).not.toThrow();
    expect(() => logger.time('timer')).not.toThrow();
    expect(() => logger.timeEnd('timer')).not.toThrow();
  });
});
