/**
 * Auth Schemas — Login, token refresh, user profile
 */

import { z } from 'zod';

// ── Login ────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
});

// ── Token Refresh ────────────────────────────

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// ── User Profile ─────────────────────────────

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'BD_MANAGER', 'ONBOARDING_MANAGER', 'PARTNER']),
  telegramChatId: z.string().nullable(),
  isActive: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

// ── Role Update ──────────────────────────────

export const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'BD_MANAGER', 'ONBOARDING_MANAGER', 'PARTNER']),
});

// ── Password Change ──────────────────────────

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
});

// ── Profile Update ───────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
});
