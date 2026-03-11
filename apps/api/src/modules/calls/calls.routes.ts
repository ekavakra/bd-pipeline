/**
 * Calls Routes
 *
 * Discovery call scheduling, recording, transcription, and meeting notes.
 */

import { Router } from 'express';
import { callsController } from './calls.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { aiLimiter } from '../../middleware/rate-limit.js';
import {
  createCallSchema,
  createMeetingSchema,
  updateMeetingSchema,
  createMeetingNoteSchema,
  meetingListQuerySchema,
} from '@bd-pipeline/shared';
import { z } from 'zod';

const router = Router();
const uuidParam = z.object({ id: z.string().uuid() });

// ── Discovery Calls ──────────────────────────

router.post(
  '/calls',
  authenticate,
  validate({ body: createCallSchema }),
  callsController.createCall,
);

router.get(
  '/calls/:id',
  authenticate,
  validate({ params: uuidParam }),
  callsController.getCall,
);

router.post(
  '/calls/:id/transcribe',
  authenticate,
  aiLimiter,
  validate({ params: uuidParam }),
  callsController.triggerTranscription,
);

router.get(
  '/calls/:id/summary',
  authenticate,
  validate({ params: uuidParam }),
  callsController.getCallSummary,
);

// ── Meetings ─────────────────────────────────

router.get(
  '/meetings',
  authenticate,
  validate({ query: meetingListQuerySchema }),
  callsController.listMeetings,
);

router.post(
  '/meetings',
  authenticate,
  validate({ body: createMeetingSchema }),
  callsController.createMeeting,
);

router.get(
  '/meetings/:id',
  authenticate,
  validate({ params: uuidParam }),
  callsController.getMeeting,
);

router.patch(
  '/meetings/:id',
  authenticate,
  validate({ params: uuidParam, body: updateMeetingSchema }),
  callsController.updateMeeting,
);

// ── Meeting Notes ────────────────────────────

router.post(
  '/meetings/:id/notes',
  authenticate,
  validate({ params: uuidParam, body: createMeetingNoteSchema }),
  callsController.addMeetingNote,
);

router.get(
  '/meetings/:id/notes',
  authenticate,
  validate({ params: uuidParam }),
  callsController.getMeetingNotes,
);

export { router as callsRoutes };
