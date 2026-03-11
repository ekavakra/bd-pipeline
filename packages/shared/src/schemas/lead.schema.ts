/**
 * Lead Schemas — CRUD, search, scoring, review
 */

import { z } from 'zod';

// ── Lead Search (AI Job Trigger) ─────────────

export const scoringPreferenceSchema = z.object({
  factor: z.string(),       // e.g. 'industry_match', 'location_match'
  label: z.string(),        // Human-readable display label
  weight: z.number().min(0).max(100),  // Priority points (0-100)
});

export const leadSearchSchema = z.object({
  naturalQuery: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  companySize: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  maxResults: z.number().int().min(1).max(100).default(20),
  preferences: z.array(scoringPreferenceSchema).optional(),
});

// ── Lead Create / Update ─────────────────────

export const createLeadSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactLinkedin: z.string().url().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  location: z.string().optional(),
  source: z.enum(['AI_SEARCH', 'MANUAL', 'REFERRAL', 'INBOUND']).default('MANUAL'),
});

export const updateLeadSchema = z.object({
  companyName: z.string().min(1).optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactLinkedin: z.string().url().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  location: z.string().optional(),
  status: z
    .enum([
      'DISCOVERED',
      'PENDING_REVIEW',
      'APPROVED',
      'REJECTED',
      'ON_HOLD',
      'CONTACTED',
      'RESPONDED',
      'IN_DISCOVERY',
      'PROPOSAL_SENT',
      'DEAL_CLOSED',
      'LOST',
    ])
    .optional(),
  notes: z.string().optional(),
});

// ── Lead Scoring ─────────────────────────────

export const scoreOverrideSchema = z.object({
  score: z.number().min(0).max(100),
  reason: z.string().min(1, 'Reason is required for manual override'),
});

// ── Lead Review ──────────────────────────────

export const reviewLeadSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'ON_HOLD']),
  notes: z.string().optional(),
});

export const bulkReviewSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1, 'At least one lead ID required'),
  decision: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().optional(),
});

// ── Lead List Query ──────────────────────────

export const leadListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      'DISCOVERED',
      'PENDING_REVIEW',
      'APPROVED',
      'REJECTED',
      'ON_HOLD',
      'CONTACTED',
      'RESPONDED',
      'IN_DISCOVERY',
      'PROPOSAL_SENT',
      'DEAL_CLOSED',
      'LOST',
    ])
    .optional(),
  searchJobId: z.string().uuid().optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxScore: z.coerce.number().min(0).max(100).optional(),
  assignedTo: z.string().uuid().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'aiScore', 'companyName', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ── Lead Response ────────────────────────────

export const leadResponseSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactLinkedin: z.string().nullable(),
  contactPhone: z.string().nullable(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  companySize: z.string().nullable(),
  location: z.string().nullable(),
  source: z.enum(['AI_SEARCH', 'MANUAL', 'REFERRAL', 'INBOUND']),
  aiScore: z.number().nullable(),
  scoreBreakdown: z.record(z.unknown()).nullable(),
  humanScoreOverride: z.number().nullable(),
  status: z.string(),
  reviewedAt: z.string().datetime().nullable(),
  reviewNotes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
