/**
 * Health Module – Integration Tests
 */

import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { healthRoutes } from '../../modules/health/health.routes.js';

// Create a minimal app for testing
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', healthRoutes);
  return app;
}

describe('GET /api/v1/health', () => {
  it('should return 200 with uptime', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('timestamp');
    expect(res.body.data.status).toBe('ok');
  });
});
