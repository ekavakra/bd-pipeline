/**
 * Shared TypeScript Types — inferred from Zod schemas
 *
 * These types are used across the entire stack:
 * - Backend: request validation, response shaping
 * - Frontend: form validation, API response typing
 */

import type { z } from 'zod';
import type {
  loginSchema,
  loginResponseSchema,
  userProfileSchema,
  updateRoleSchema,
  leadSearchSchema,
  createLeadSchema,
  updateLeadSchema,
  scoreOverrideSchema,
  reviewLeadSchema,
  bulkReviewSchema,
  leadListQuerySchema,
  leadResponseSchema,
  generatePitchSchema,
  editPitchSchema,
  pitchResponseSchema,
  scheduleFollowupSchema,
  createClientSchema,
  updateClientSchema,
  dealCloseSchema,
  advanceStageSchema,
  setStageSchema,
  updateChecklistItemSchema,
  createRequirementSchema,
  clientListQuerySchema,
  clientResponseSchema,
  createMeetingSchema,
  updateMeetingSchema,
  createMeetingNoteSchema,
  documentMetadataSchema,
  createCallSchema,
  editProposalSchema,
  generateEmailSchema,
  editEmailSchema,
  collectNpsSchema,
  paginationMetaSchema,
  apiErrorSchema,
} from '../schemas/index';

// ── Auth Types ───────────────────────────────
export type LoginInput = z.infer<typeof loginSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

// ── Lead Types ───────────────────────────────
export type LeadSearchInput = z.infer<typeof leadSearchSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ScoreOverrideInput = z.infer<typeof scoreOverrideSchema>;
export type ReviewLeadInput = z.infer<typeof reviewLeadSchema>;
export type BulkReviewInput = z.infer<typeof bulkReviewSchema>;
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
export type LeadResponse = z.infer<typeof leadResponseSchema>;

// ── Outreach Types ───────────────────────────
export type GeneratePitchInput = z.infer<typeof generatePitchSchema>;
export type EditPitchInput = z.infer<typeof editPitchSchema>;
export type PitchResponse = z.infer<typeof pitchResponseSchema>;
export type ScheduleFollowupInput = z.infer<typeof scheduleFollowupSchema>;

// ── Client & Onboarding Types ────────────────
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type DealCloseInput = z.infer<typeof dealCloseSchema>;
export type AdvanceStageInput = z.infer<typeof advanceStageSchema>;
export type SetStageInput = z.infer<typeof setStageSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
export type ClientResponse = z.infer<typeof clientResponseSchema>;

// ── Meeting & Document Types ─────────────────
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
export type CreateMeetingNoteInput = z.infer<typeof createMeetingNoteSchema>;
export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;
export type CreateCallInput = z.infer<typeof createCallSchema>;
export type EditProposalInput = z.infer<typeof editProposalSchema>;

// ── AI & Notification Types ──────────────────
export type GenerateEmailInput = z.infer<typeof generateEmailSchema>;
export type EditEmailInput = z.infer<typeof editEmailSchema>;
export type CollectNpsInput = z.infer<typeof collectNpsSchema>;

// ── Common Types ─────────────────────────────
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

/** Standardized success response wrapper */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/** Standardized error response wrapper */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

/** Union of all API response types */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
