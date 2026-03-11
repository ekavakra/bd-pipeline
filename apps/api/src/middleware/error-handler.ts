/**
 * Global Error Handler Middleware
 *
 * Catches all errors thrown in route handlers and middleware,
 * formats them into the standardized API error response shape,
 * and reports to Sentry in production.
 *
 * Error response shape:
 * {
 *   success: false,
 *   error: {
 *     code: "LEAD_NOT_FOUND",
 *     message: "Lead not found",
 *     status: 404,
 *     details: {}
 *   },
 *   requestId: "req_abc123"
 * }
 */

import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Known ApiError — expected, return structured response
  if (err instanceof ApiError) {
    logger.warn(
      {
        err: { code: err.code, message: err.message, status: err.status },
        requestId: req.requestId,
        path: req.path,
        method: req.method,
      },
      'API error',
    );

    res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        status: err.status,
        details: err.details,
      },
      requestId: req.requestId,
    });
    return;
  }

  // Unknown error — log full stack, return generic 500
  logger.error(
    {
      err,
      requestId: req.requestId,
      path: req.path,
      method: req.method,
    },
    'Unhandled error',
  );

  // Report to Sentry in production
  if (env.SENTRY_DSN) {
    // Sentry capture will be set up in index.ts
    // @sentry/node automatically captures from Express error handler
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
      status: 500,
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    },
    requestId: req.requestId,
  });
}
