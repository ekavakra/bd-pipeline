/**
 * 404 Not Found Handler
 *
 * Catches requests to undefined routes and returns
 * a standardized error response.
 */

import type { Request, Response } from 'express';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
      status: 404,
    },
    requestId: req.requestId,
  });
}
