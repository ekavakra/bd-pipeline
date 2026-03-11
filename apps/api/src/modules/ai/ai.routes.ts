/**
 * Notifications & AI Routes
 *
 * AI next-action engine, email generation, NPS collection, upsell flagging,
 * Telegram integration, and notification management.
 */

import { Router } from 'express';
import { aiController } from './ai.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { aiLimiter } from '../../middleware/rate-limit.js';
import {
  nextActionSchema,
  generateEmailSchema,
  editEmailSchema,
  collectNpsSchema,
  flagUpsellSchema,
  notificationQuerySchema,
  telegramSendSchema,
} from '@bd-pipeline/shared';
import { z } from 'zod';

const router = Router();
const uuidParam = z.object({ id: z.string().uuid() });

// ── AI Next-Action Engine ────────────────────

router.post(
  '/ai/next-action',
  authenticate,
  aiLimiter,
  validate({ body: nextActionSchema }),
  aiController.getNextAction,
);

// ── AI Email Generation ──────────────────────

router.post(
  '/ai/email/generate',
  authenticate,
  aiLimiter,
  validate({ body: generateEmailSchema }),
  aiController.generateEmail,
);

router.patch(
  '/ai/email/:id',
  authenticate,
  validate({ params: uuidParam, body: editEmailSchema }),
  aiController.editEmail,
);

// ── NPS Collection ───────────────────────────

router.post(
  '/ai/nps',
  authenticate,
  validate({ body: collectNpsSchema }),
  aiController.collectNps,
);

// ── Upsell Flagging ──────────────────────────

router.post(
  '/ai/upsell',
  authenticate,
  aiLimiter,
  validate({ body: flagUpsellSchema }),
  aiController.flagUpsell,
);

// ── Notifications ────────────────────────────

router.get(
  '/notifications',
  authenticate,
  validate({ query: notificationQuerySchema }),
  aiController.listNotifications,
);

router.patch(
  '/notifications/:id/read',
  authenticate,
  validate({ params: uuidParam }),
  aiController.markNotificationRead,
);

router.post(
  '/notifications/read-all',
  authenticate,
  aiController.markAllRead,
);

// ── Telegram ─────────────────────────────────

router.post(
  '/telegram/send',
  authenticate,
  validate({ body: telegramSendSchema }),
  aiController.sendTelegram,
);

export { router as aiRoutes };
