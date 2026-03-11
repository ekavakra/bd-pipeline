/**
 * AI & Notification Schemas
 */

import { z } from 'zod';

// ── AI Next Action ───────────────────────────

export const nextActionSchema = z.object({
  clientId: z.string().uuid(),
});

// ── AI Email Generation ──────────────────────

export const generateEmailSchema = z.object({
  clientId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  type: z.enum(['FOLLOWUP', 'ONBOARDING_UPDATE', 'PROPOSAL', 'PITCH', 'CUSTOM']).default('FOLLOWUP'),
  additionalContext: z.string().optional(),
});

export const editEmailSchema = z.object({
  subject: z.string().optional(),
  body: z.string().min(1, 'Body cannot be empty'),
});

// ── NPS ──────────────────────────────────────

export const collectNpsSchema = z.object({
  clientId: z.string().uuid(),
  score: z.number().int().min(0).max(10),
  feedback: z.string().optional(),
});

// ── Upsell Flag ──────────────────────────────

export const flagUpsellSchema = z.object({
  notes: z.string().optional(),
});

// ── Notification Query ───────────────────────

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});

// ── Telegram Webhook ─────────────────────────

export const telegramSendSchema = z.object({
  chatId: z.string(),
  message: z.string().min(1),
  replyMarkup: z.record(z.unknown()).optional(),
});

// ── Common Pagination Response ───────────────

export const paginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

// ── Standardized API Response ────────────────

export const apiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: paginationMetaSchema.optional(),
  });

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    status: z.number(),
    details: z.record(z.unknown()).optional(),
  }),
  requestId: z.string().optional(),
});
