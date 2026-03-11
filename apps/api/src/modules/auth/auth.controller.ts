/**
 * Auth Controller — Request Handling
 *
 * Thin controller layer that delegates to authService.
 * Handles request parsing and response formatting only.
 */

import type { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const authController = {
  /**
   * POST /auth/login — Authenticate & return tokens
   */
  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });

    // Fetch user profile to return with token
    const user = await authService.getUserById(result.userId);

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user,
      },
    });
  }),

  /**
   * POST /auth/refresh — Refresh access token
   */
  refresh: asyncHandler(async (req: Request, res: Response) => {
    // Try cookie first, then body
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    const result = await authService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: result,
    });
  }),

  /**
   * POST /auth/logout — Invalidate refresh tokens
   */
  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.user!.userId);

    // Clear the cookie
    res.clearCookie('refreshToken', { path: '/' });

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  }),

  /**
   * GET /users/me — Get current user profile
   */
  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getUserById(req.user!.userId);

    res.json({
      success: true,
      data: user,
    });
  }),

  /**
   * GET /users — List all team members (admin only)
   */
  listUsers: asyncHandler(async (_req: Request, res: Response) => {
    const users = await authService.listUsers();

    res.json({
      success: true,
      data: users,
    });
  }),

  /**
   * PATCH /users/:id/role — Update user role (admin only)
   */
  updateRole: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;
    const user = await authService.updateUserRole(id!, role);

    res.json({
      success: true,
      data: user,
    });
  }),

  /**
   * PATCH /users/me — Update current user profile
   */
  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.updateProfile(req.user!.userId, req.body);
    res.json({ success: true, data: user });
  }),

  /**
   * POST /users/me/password — Change password
   */
  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ success: true, data: { message: 'Password changed successfully' } });
  }),
};
