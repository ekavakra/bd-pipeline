/**
 * Async Handler Wrapper
 *
 * Wraps Express route handlers to catch async errors and forward
 * them to the global error handler. Eliminates the need for
 * try/catch blocks in every controller method.
 *
 * Usage:
 *   router.get('/leads', asyncHandler(leadsController.list));
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
