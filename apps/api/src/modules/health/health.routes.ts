/**
 * Health Check Routes
 *
 * GET /health       — Liveness check (always 200 if server is running)
 * GET /health/ready — Readiness check (checks DB, Redis, Ollama connectivity)
 */

import { Router } from 'express';
import { healthController } from './health.controller.js';

const router = Router();

router.get('/health', healthController.liveness);
router.get('/health/ready', healthController.readiness);

export { router as healthRoutes };
