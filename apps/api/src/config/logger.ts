/**
 * Logger Configuration — Pino
 *
 * Structured JSON logging with pino-http for request logging.
 * Replaces both Winston (application logs) and Morgan (HTTP logs).
 *
 * In development: pretty-printed output via pino-pretty
 * In production: raw JSON to stdout (consumed by log aggregators)
 */

import pino from 'pino';
import { env } from './env.js';

/** Application-wide logger instance */
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Redact sensitive fields from logs
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'passwordHash', 'token'],
    censor: '[REDACTED]',
  },
});

export default logger;
