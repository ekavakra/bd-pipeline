/**
 * Auth Service — Business Logic
 *
 * Handles password hashing (argon2), JWT creation, token refresh,
 * and user CRUD operations.
 */

import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { UnauthorizedError, NotFoundError, ConflictError } from '../../utils/api-error.js';
import type { JwtPayload } from '../../middleware/auth.js';

export const authService = {
  /**
   * Authenticate user with email and password.
   * Returns access token and refresh token on success.
   */
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password with argon2
    const validPassword = await argon2.verify(user.passwordHash, password);
    if (!validPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    // Store refresh token in DB
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info({ userId: user.id }, 'User logged in');

    return {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      userId: user.id,
    };
  },

  /**
   * Generate a new access token from a valid refresh token.
   */
  async refreshAccessToken(refreshToken: string) {
    // Verify the refresh token exists and hasn't been revoked
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      // Clean up expired token
      if (stored) {
        await prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Verify JWT signature
    try {
      jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Generate new access token
    const payload: JwtPayload = {
      userId: stored.user.id,
      email: stored.user.email,
      role: stored.user.role,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    return {
      accessToken,
      expiresIn: 7 * 24 * 60 * 60,
      user: {
        id: stored.user.id,
        name: stored.user.name,
        email: stored.user.email,
        role: stored.user.role,
      },
    };
  },

  /**
   * Invalidate all refresh tokens for a user (logout).
   */
  async logout(userId: string) {
    await prisma.refreshToken.deleteMany({ where: { userId } });
    logger.info({ userId }, 'User logged out — all refresh tokens revoked');
  },

  /**
   * Get user profile by ID.
   */
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        telegramChatId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  },

  /**
   * List all team members.
   */
  async listUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  /**
   * Update a user's role.
   */
  async updateUserRole(userId: string, role: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError('User');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: role as never },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    logger.info({ userId, newRole: role }, 'User role updated');

    return updated;
  },

  /**
   * Update current user's profile.
   */
  async updateProfile(userId: string, data: { name?: string }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, role: true },
    });

    logger.info({ userId }, 'User profile updated');
    return updated;
  },

  /**
   * Change the current user's password.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedError('Current password is incorrect');

    const hash = await argon2.hash(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    logger.info({ userId }, 'Password changed');
  },

  /**
   * Hash a password using argon2.
   * Used for seeding and registration if needed.
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  },
};
