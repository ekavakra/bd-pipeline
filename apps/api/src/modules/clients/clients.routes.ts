/**
 * Clients Routes
 *
 * Client management, onboarding pipeline, stage advancement, checklists, and requirements.
 */

import { Router } from 'express';
import { clientsController } from './clients.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createClientSchema,
  updateClientSchema,
  advanceStageSchema,
  setStageSchema,
  updateChecklistItemSchema,
  createRequirementSchema,
  clientListQuerySchema,
} from '@bd-pipeline/shared';
import { z } from 'zod';

const router = Router();
const uuidParam = z.object({ id: z.string().uuid() });

// ── Client CRUD ──────────────────────────────

router.get(
  '/clients',
  authenticate,
  validate({ query: clientListQuerySchema }),
  clientsController.list,
);

router.post(
  '/clients',
  authenticate,
  requireRole('ADMIN', 'BD_MANAGER'),
  validate({ body: createClientSchema }),
  clientsController.create,
);

router.get(
  '/clients/:id',
  authenticate,
  validate({ params: uuidParam }),
  clientsController.getById,
);

router.patch(
  '/clients/:id',
  authenticate,
  validate({ params: uuidParam, body: updateClientSchema }),
  clientsController.update,
);

// ── Onboarding Pipeline ──────────────────────

router.get(
  '/clients/:id/pipeline',
  authenticate,
  validate({ params: uuidParam }),
  clientsController.getPipeline,
);

router.post(
  '/clients/:id/pipeline/advance',
  authenticate,
  validate({ params: uuidParam, body: advanceStageSchema }),
  clientsController.advanceStage,
);

router.post(
  '/clients/:id/pipeline/set-stage',
  authenticate,
  requireRole('ADMIN', 'BD_MANAGER'),
  validate({ params: uuidParam, body: setStageSchema }),
  clientsController.setStage,
);

// ── Checklist Items ──────────────────────────

router.get(
  '/clients/:id/checklist',
  authenticate,
  validate({ params: uuidParam }),
  clientsController.getChecklist,
);

router.patch(
  '/clients/:id/checklist/:itemId',
  authenticate,
  validate({
    params: z.object({ id: z.string().uuid(), itemId: z.string().uuid() }),
    body: updateChecklistItemSchema,
  }),
  clientsController.updateChecklistItem,
);

// ── Requirements ─────────────────────────────

router.get(
  '/clients/:id/requirements',
  authenticate,
  validate({ params: uuidParam }),
  clientsController.getRequirements,
);

router.post(
  '/clients/:id/requirements',
  authenticate,
  validate({ params: uuidParam, body: createRequirementSchema }),
  clientsController.addRequirement,
);

// ── Customer Health / NPS ────────────────────

router.get(
  '/clients/:id/health',
  authenticate,
  validate({ params: uuidParam }),
  clientsController.getHealth,
);

// ── SLA Dashboard ────────────────────────────

router.get(
  '/clients/sla/breaches',
  authenticate,
  requireRole('ADMIN', 'BD_MANAGER'),
  clientsController.getSlaBreaches,
);

export { router as clientsRoutes };
