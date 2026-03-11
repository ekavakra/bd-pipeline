/**
 * Outreach Schemas — Pitches, follow-ups, sending
 */

import { z } from 'zod';

// ── Pitch Generation ─────────────────────────

export const generatePitchSchema = z.object({
  leadId: z.string().uuid(),
  channel: z.enum(['EMAIL', 'LINKEDIN', 'WHATSAPP']),
  tone: z.enum(['formal', 'casual', 'concise']).default('formal'),
  additionalContext: z.string().optional(),
});

// ── Pitch Edit ───────────────────────────────

export const editPitchSchema = z.object({
  subject: z.string().optional(),
  body: z.string().min(1, 'Body cannot be empty'),
});

// ── Pitch Send ───────────────────────────────

export const sendPitchSchema = z.object({
  channel: z.enum(['EMAIL', 'LINKEDIN', 'WHATSAPP']).optional(),
});

// ── Follow-up Sequence ───────────────────────

export const scheduleFollowupSchema = z.object({
  leadId: z.string().uuid(),
  steps: z
    .array(
      z.object({
        channel: z.enum(['EMAIL', 'LINKEDIN', 'WHATSAPP']),
        subject: z.string().optional(),
        body: z.string().min(1),
        delayHours: z.number().int().min(1).max(720), // max 30 days
      }),
    )
    .min(1, 'At least one follow-up step is required')
    .max(10, 'Maximum 10 follow-up steps'),
});

// ── Pitch Response ───────────────────────────

export const pitchResponseSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  channel: z.enum(['EMAIL', 'LINKEDIN', 'WHATSAPP']),
  subject: z.string().nullable(),
  body: z.string(),
  version: z.number(),
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SENT', 'REJECTED']),
  generatedByAi: z.boolean(),
  approvedAt: z.string().datetime().nullable(),
  sentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
