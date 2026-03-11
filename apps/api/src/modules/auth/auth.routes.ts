/**
 * Auth Routes
 *
 * POST /auth/login     — Login with email/password, returns JWT
 * POST /auth/refresh   — Refresh access token
 * POST /auth/logout    — Invalidate refresh token
 * GET  /users/me       — Get current user profile
 * GET  /users          — List all users (admin only)
 * PATCH /users/:id/role — Update user role (admin only)
 */

import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { loginSchema, refreshTokenSchema, updateRoleSchema, changePasswordSchema, updateProfileSchema } from '@bd-pipeline/shared';
import { z } from 'zod';

const router = Router();

// ── Auth ─────────────────────────────────────

router.post(
  '/auth/login',
  authLimiter,
  validate({ body: loginSchema }),
  authController.login,
);

router.post(
  '/auth/refresh',
  validate({ body: refreshTokenSchema }),
  authController.refresh,
);

router.post(
  '/auth/logout',
  authenticate,
  authController.logout,
);

// ── Users ────────────────────────────────────

router.get(
  '/users/me',
  authenticate,
  authController.me,
);

router.patch(
  '/users/me',
  authenticate,
  validate({ body: updateProfileSchema }),
  authController.updateProfile,
);

router.post(
  '/users/me/password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

router.get(
  '/users',
  authenticate,
  requireRole('ADMIN'),
  authController.listUsers,
);

router.patch(
  '/users/:id/role',
  authenticate,
  requireRole('ADMIN'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: updateRoleSchema,
  }),
  authController.updateRole,
);

export { router as authRoutes };
