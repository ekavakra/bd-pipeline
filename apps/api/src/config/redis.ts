/**
 * Redis Client Configuration
 *
 * Creates and exports a singleton Redis connection
 * used by BullMQ queues, caching, and rate limiting.
 */

import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

/** Singleton Redis instance */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    logger.warn({ attempt: times, delay }, 'Redis reconnection attempt');
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

/**
 * Check Redis connectivity
 * @returns true if Redis is reachable
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}
