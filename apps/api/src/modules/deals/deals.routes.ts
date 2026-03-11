/**
 * Deals Routes
 *
 * Deal close endpoint — the critical handoff from BD to Onboarding.
 * POST /deals/close: atomic deal closure + client/pipeline creation
 * GET /deals/:id: deal summary (lead + client + pipeline)
 */

import { Router } from 'express';
import { dealsController } from './deals.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { dealCloseSchema } from '@bd-pipeline/shared';
import { z } from 'zod';

const router = Router();

// POST /deals/close — close deal and create client + pipeline
router.post(
  '/deals/close',
  authenticate,
  requireRole('ADMIN', 'BD_MANAGER'),
  validate({ body: dealCloseSchema }),
  dealsController.closeDeal,
);

// GET /deals/:id — get deal summary by lead ID
router.get(
  '/deals/:id',
  authenticate,
  validate({ params: z.object({ id: z.string().uuid() }) }),
  dealsController.getDeal,
);

export { router as dealsRoutes };
