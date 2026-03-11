/**
 * Proposals Routes
 *
 * AI proposal generation, editing, and deal closing.
 */

import { Router } from 'express';
import { proposalsController } from './proposals.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { aiLimiter } from '../../middleware/rate-limit.js';
import {
  generateProposalSchema,
  editProposalSchema,
  dealCloseSchema,
} from '@bd-pipeline/shared';
import { z } from 'zod';

const router = Router();
const uuidParam = z.object({ id: z.string().uuid() });

// ── Proposals ────────────────────────────────

router.post(
  '/proposals/generate',
  authenticate,
  aiLimiter,
  validate({ body: generateProposalSchema }),
  proposalsController.generate,
);

router.get(
  '/proposals/:id',
  authenticate,
  validate({ params: uuidParam }),
  proposalsController.getById,
);

router.patch(
  '/proposals/:id',
  authenticate,
  validate({ params: uuidParam, body: editProposalSchema }),
  proposalsController.edit,
);

router.post(
  '/proposals/:id/approve',
  authenticate,
  requireRole('ADMIN', 'BD_MANAGER'),
  validate({ params: uuidParam }),
  proposalsController.approve,
);

router.get(
  '/proposals/lead/:leadId',
  authenticate,
  validate({ params: z.object({ leadId: z.string().uuid() }) }),
  proposalsController.listByLead,
);

// ── Deal Close ───────────────────────────────

router.post(
  '/deals/close',
  authenticate,
  requireRole('ADMIN', 'BD_MANAGER'),
  validate({ body: dealCloseSchema }),
  proposalsController.closeDeal,
);

export { router as proposalsRoutes };
