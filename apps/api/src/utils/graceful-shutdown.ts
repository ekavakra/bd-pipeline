/**
 * Graceful Shutdown Handler
 *
 * Ensures clean shutdown when the process receives SIGTERM/SIGINT:
 * 1. Stop accepting new HTTP connections
 * 2. Wait for active BullMQ jobs to complete
 * 3. Close database and Redis connections
 * 4. Exit cleanly
 */

import type { Server } from 'http';
import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';
import { allQueues } from '../config/queue.js';
import { logger } from '../config/logger.js';

/**
 * Register shutdown handlers on the given HTTP server.
 * Call this once after the server starts listening.
 */
export function registerShutdownHandlers(server: Server): void {
  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, 'Shutdown signal received. Starting graceful shutdown...');

    // 1. Stop accepting new HTTP connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    try {
      // 2. Close all BullMQ queues
      await Promise.all(allQueues.map((q) => q.close()));
      logger.info('BullMQ queues closed');

      // 3. Disconnect from database
      await prisma.$disconnect();
      logger.info('Database disconnected');

      // 4. Disconnect Redis
      redis.disconnect();
      logger.info('Redis disconnected');

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
    shutdown('unhandledRejection');
  });
}
