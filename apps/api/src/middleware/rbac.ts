/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Restricts route access based on user roles.
 * Must be used AFTER the authenticate middleware.
 *
 * Usage:
 *   router.patch('/users/:id/role', authenticate, requireRole('ADMIN'), handler);
 *   router.get('/leads', authenticate, requireRole('ADMIN', 'BD_MANAGER'), handler);
 */

import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/api-error.js';

type UserRole = 'ADMIN' | 'BD_MANAGER' | 'ONBOARDING_MANAGER' | 'PARTNER';

/**
 * Creates middleware that checks if the authenticated user has one of
 * the specified roles. ADMIN role always has access.
 *
 * @param allowedRoles - Roles permitted to access the route
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    // ADMIN always has access
    if (user.role === 'ADMIN') {
      next();
      return;
    }

    if (!allowedRoles.includes(user.role as UserRole)) {
      throw new ForbiddenError(
        `Requires one of: ${allowedRoles.join(', ')}. Your role: ${user.role}`,
      );
    }

    next();
  };
}
