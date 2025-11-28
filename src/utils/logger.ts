/**
 * Logger utility that only outputs in development mode.
 * In production, all logs are silently suppressed.
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.log('Hello', data);
 *   logger.warn('Warning message');
 *   logger.error('Error occurred', error);
 *   logger.info('Info message');
 *   logger.debug('Debug info');
 */

const isDev = import.meta.env.DEV;

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

const createLogger = (level: LogLevel) => {
  return (...args: unknown[]): void => {
    if (isDev) {
      console[level](...args);
    }
  };
};

export const logger = {
  log: createLogger('log'),
  info: createLogger('info'),
  warn: createLogger('warn'),
  error: createLogger('error'),
  debug: createLogger('debug'),
  
  /** Group logs together (only in dev) */
  group: (label: string): void => {
    if (isDev) {
      console.group(label);
    }
  },
  
  /** End a log group (only in dev) */
  groupEnd: (): void => {
    if (isDev) {
      console.groupEnd();
    }
  },
  
  /** Log with a table format (only in dev) */
  table: (data: unknown): void => {
    if (isDev) {
      console.table(data);
    }
  },
  
  /** Time tracking (only in dev) */
  time: (label: string): void => {
    if (isDev) {
      console.time(label);
    }
  },
  
  /** End time tracking (only in dev) */
  timeEnd: (label: string): void => {
    if (isDev) {
      console.timeEnd(label);
    }
  },
};

export default logger;
