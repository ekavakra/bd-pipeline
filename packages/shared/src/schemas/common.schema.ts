/**
 * Meeting & Document Schemas
 */

import { z } from 'zod';

// ── Meeting Create ───────────────────────────

export const createMeetingSchema = z.object({
  clientId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['DISCOVERY', 'KICKOFF', 'REQUIREMENTS', 'REVIEW', 'TRAINING', 'OTHER']).default('OTHER'),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480).default(60),
  meetLink: z.string().url().optional(),
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(['DISCOVERY', 'KICKOFF', 'REQUIREMENTS', 'REVIEW', 'TRAINING', 'OTHER']).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  meetLink: z.string().url().optional(),
  status: z.enum(['UPCOMING', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).optional(),
});

// ── Meeting Notes ────────────────────────────

export const createMeetingNoteSchema = z.object({
  body: z.string().min(1, 'Note body is required'),
});

// ── Document Upload Metadata ─────────────────

export const documentMetadataSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1, 'Document name is required'),
  category: z.enum(['CONTRACT', 'KYC', 'TECHNICAL_SPEC', 'NDA', 'OTHER']).default('OTHER'),
  expiryDate: z.string().datetime().optional(),
});

// ── Discovery Call ───────────────────────────

export const createCallSchema = z.object({
  leadId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(1).optional(),
  recordingUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

// ── Proposal ─────────────────────────────────

export const editProposalSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
});

export const generateProposalSchema = z.object({
  leadId: z.string().uuid(),
  requirements: z.string().optional(),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  additionalContext: z.string().optional(),
});

// ── Meeting List Query ───────────────────────

export const meetingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  clientId: z.string().uuid().optional(),
  type: z.enum(['DISCOVERY', 'KICKOFF', 'REQUIREMENTS', 'REVIEW', 'TRAINING', 'OTHER']).optional(),
  upcoming: z.coerce.boolean().optional(),
  sortBy: z.enum(['scheduledAt', 'createdAt']).default('scheduledAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
