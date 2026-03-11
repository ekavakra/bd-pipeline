/**
 * Leads Routes
 *
 * All lead management endpoints: CRUD, search, scoring, review.
 */

import { Router } from 'express';
import { leadsController } from './leads.controller.js';
import { authenticate, authenticateSse } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { aiLimiter } from '../../middleware/rate-limit.js';
import {
  leadSearchSchema,
  createLeadSchema,
  updateLeadSchema,
  scoreOverrideSchema,
  reviewLeadSchema,
  bulkReviewSchema,
  leadListQuerySchema,
} from '@bd-pipeline/shared';
import { z } from 'zod';

const router = Router();
const uuidParam = z.object({ id: z.string().uuid() });

// ── Lead CRUD ────────────────────────────────

router.post(
  '/leads',
  authenticate,
  validate({ body: createLeadSchema }),
  leadsController.create,
);

router.get(
  '/leads',
  authenticate,
  validate({ query: leadListQuerySchema }),
  leadsController.list,
);

// ── Lead Search (AI Job) ─────────────────────
// NOTE: These must come BEFORE /leads/:id to avoid being caught by the :id param

router.get(
  '/leads/search-jobs',
  authenticate,
  leadsController.listSearchJobs,
);

router.post(
  '/leads/search',
  authenticate,
  aiLimiter,
  validate({ body: leadSearchSchema }),
  leadsController.triggerSearch,
);

router.get(
  '/leads/search/status/:jobId',
  authenticate,
  validate({ params: z.object({ jobId: z.string().uuid() }) }),
  leadsController.getSearchStatus,
);

// SSE real-time progress stream for a queued search job
// Uses ?token= query param for auth (EventSource doesn't support headers)
router.get(
  '/leads/search/:jobId/stream',
  authenticateSse,
  validate({ params: z.object({ jobId: z.string().uuid() }) }),
  leadsController.streamSearch,
);

// ── Lead Review Queue ────────────────────────
// Must come before /leads/:id to avoid being treated as an ID

router.get(
  '/leads/review/queue',
  authenticate,
  leadsController.getReviewQueue,
);

router.post(
  '/leads/review/bulk',
  authenticate,
  validate({ body: bulkReviewSchema }),
  leadsController.bulkReview,
);

// ── Scoring ──────────────────────────────────
// Must come before /leads/:id

router.post(
  '/leads/score',
  authenticate,
  aiLimiter,
  leadsController.scoreBatch,
);

// ── Lead CRUD with :id param ─────────────────

router.get(
  '/leads/:id',
  authenticate,
  validate({ params: uuidParam }),
  leadsController.getById,
);

router.patch(
  '/leads/:id',
  authenticate,
  validate({ params: uuidParam, body: updateLeadSchema }),
  leadsController.update,
);

router.delete(
  '/leads/:id',
  authenticate,
  requireRole('ADMIN', 'BD_MANAGER'),
  validate({ params: uuidParam }),
  leadsController.remove,
);

// ── Enrichment ───────────────────────────────

router.post(
  '/leads/:id/enrich',
  authenticate,
  validate({ params: uuidParam }),
  leadsController.enrich,
);

// ── Scoring ──────────────────────────────────

router.get(
  '/leads/:id/score',
  authenticate,
  validate({ params: uuidParam }),
  leadsController.getScore,
);

router.patch(
  '/leads/:id/score',
  authenticate,
  validate({ params: uuidParam, body: scoreOverrideSchema }),
  leadsController.overrideScore,
);

// ── Human Review ─────────────────────────────

router.patch(
  '/leads/:id/review',
  authenticate,
  validate({ params: uuidParam, body: reviewLeadSchema }),
  leadsController.reviewLead,
);

export { router as leadsRoutes };
