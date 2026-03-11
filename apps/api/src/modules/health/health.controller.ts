/**
 * Health Check Controller
 *
 * Provides liveness and readiness endpoints used by Docker healthcheck
 * and load balancers to determine if the service is operational.
 */

import type { Request, Response } from 'express';
import { prisma } from '../../config/db.js';
import { checkRedisHealth } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export const healthController = {
  /**
   * GET /health — Liveness probe
   * Returns 200 if the server process is running.
   */
  liveness(_req: Request, res: Response): void {
    res.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  },

  /**
   * GET /health/ready — Readiness probe
   * Checks connectivity to all critical dependencies.
   */
  async readiness(_req: Request, res: Response): Promise<void> {
    const checks: Record<string, { status: string; latencyMs?: number }> = {};

    // Check PostgreSQL
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks['database'] = { status: 'ok', latencyMs: Date.now() - dbStart };
    } catch (err) {
      logger.error({ err }, 'Health check: database unreachable');
      checks['database'] = { status: 'error', latencyMs: Date.now() - dbStart };
    }

    // Check Redis
    const redisStart = Date.now();
    const redisOk = await checkRedisHealth();
    checks['redis'] = {
      status: redisOk ? 'ok' : 'error',
      latencyMs: Date.now() - redisStart,
    };

    // Check Ollama
    const ollamaStart = Date.now();
    try {
      const response = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      checks['ollama'] = {
        status: response.ok ? 'ok' : 'error',
        latencyMs: Date.now() - ollamaStart,
      };
    } catch {
      checks['ollama'] = { status: 'error', latencyMs: Date.now() - ollamaStart };
    }

    // Determine overall status
    const allHealthy = Object.values(checks).every((c) => c.status === 'ok');
    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json({
      success: allHealthy,
      data: {
        status: allHealthy ? 'ready' : 'degraded',
        timestamp: new Date().toISOString(),
        services: checks,
      },
    });
  },
};
