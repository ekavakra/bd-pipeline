/**
 * Outreach Routes
 *
 * Endpoints for AI pitch generation, approval workflows, and follow-up sequences.
 */

import { Router } from 'express';
import { outreachController } from './outreach.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { aiLimiter } from '../../middleware/rate-limit.js';
import {
  generatePitchSchema,
  editPitchSchema,
  sendPitchSchema,
  scheduleFollowupSchema,
} from '@bd-pipeline/shared';
import { z } from 'zod';

const router = Router();
const uuidParam = z.object({ id: z.string().uuid() });

// ── Pitch Generation ─────────────────────────

router.post(
  '/outreach/pitch',
  authenticate,
  aiLimiter,
  validate({ body: generatePitchSchema }),
  outreachController.generatePitch,
);

router.get(
  '/outreach/pitch/:id',
  authenticate,
  validate({ params: uuidParam }),
  outreachController.getPitch,
);

router.patch(
  '/outreach/pitch/:id',
  authenticate,
  validate({ params: uuidParam, body: editPitchSchema }),
  outreachController.editPitch,
);

// ── Pitch Approval & Sending ─────────────────

router.post(
  '/outreach/pitch/:id/approve',
  authenticate,
  requireRole('ADMIN', 'BD_MANAGER'),
  validate({ params: uuidParam }),
  outreachController.approvePitch,
);

router.post(
  '/outreach/pitch/:id/send',
  authenticate,
  validate({ params: uuidParam, body: sendPitchSchema }),
  outreachController.sendPitch,
);

// ── Follow-Up Sequences ──────────────────────

router.post(
  '/outreach/followup',
  authenticate,
  validate({ body: scheduleFollowupSchema }),
  outreachController.scheduleFollowup,
);

router.get(
  '/outreach/followup/:id',
  authenticate,
  validate({ params: uuidParam }),
  outreachController.getFollowupSequence,
);

router.delete(
  '/outreach/followup/:id',
  authenticate,
  validate({ params: uuidParam }),
  outreachController.cancelFollowup,
);

// ── Outreach Analytics ───────────────────────

router.get(
  '/outreach/analytics',
  authenticate,
  requireRole('ADMIN', 'BD_MANAGER'),
  outreachController.getAnalytics,
);

export { router as outreachRoutes };
