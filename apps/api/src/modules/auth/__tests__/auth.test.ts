/**
 * Auth Module – Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authRoutes } from '../../modules/auth/auth.routes.js';
import { errorHandler } from '../../../middleware/error-handler.js';
import { prisma } from '../../../config/db.js';
import { authService } from '../auth.service.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', authRoutes);
  app.use(errorHandler);
  return app;
}

describe('Auth Module', () => {
  beforeEach(async () => {
    // Create a test user
    const hashedPassword = await authService.hashPassword('TestPassword123!');
    await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: hashedPassword,
        role: 'BD_REP',
      },
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'TestPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    it('should reject invalid password', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'Password123!' });

      expect(res.status).toBe(401);
    });

    it('should validate request body', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email' }); // Missing password

      expect(res.status).toBe(400);
    });
  });
});
