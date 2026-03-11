/**
 * Calls Controller — Request Handling
 */

import type { Request, Response } from 'express';
import { callsService } from './calls.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const callsController = {
  /** POST /calls */
  createCall: asyncHandler(async (req: Request, res: Response) => {
    const call = await callsService.createCall({
      ...req.body,
      conductedById: req.user!.userId,
    });
    res.status(201).json({ success: true, data: call });
  }),

  /** GET /calls/:id */
  getCall: asyncHandler(async (req: Request, res: Response) => {
    const call = await callsService.getCall(req.params['id']!);
    res.json({ success: true, data: call });
  }),

  /** POST /calls/:id/transcribe */
  triggerTranscription: asyncHandler(async (req: Request, res: Response) => {
    const result = await callsService.triggerTranscription(req.params['id']!);
    res.status(202).json({ success: true, data: result });
  }),

  /** GET /calls/:id/summary */
  getCallSummary: asyncHandler(async (req: Request, res: Response) => {
    const summary = await callsService.getCallSummary(req.params['id']!);
    res.json({ success: true, data: summary });
  }),

  /** GET /meetings */
  listMeetings: asyncHandler(async (req: Request, res: Response) => {
    const result = await callsService.listMeetings(req.query as never);
    res.json({ success: true, data: { meetings: result.meetings, meta: result.meta } });
  }),

  /** POST /meetings */
  createMeeting: asyncHandler(async (req: Request, res: Response) => {
    const meeting = await callsService.createMeeting({
      ...req.body,
      createdById: req.user!.userId,
    });
    res.status(201).json({ success: true, data: meeting });
  }),

  /** GET /meetings/:id */
  getMeeting: asyncHandler(async (req: Request, res: Response) => {
    const meeting = await callsService.getMeeting(req.params['id']!);
    res.json({ success: true, data: meeting });
  }),

  /** PATCH /meetings/:id */
  updateMeeting: asyncHandler(async (req: Request, res: Response) => {
    const meeting = await callsService.updateMeeting(req.params['id']!, req.body);
    res.json({ success: true, data: meeting });
  }),

  /** POST /meetings/:id/notes */
  addMeetingNote: asyncHandler(async (req: Request, res: Response) => {
    const note = await callsService.addMeetingNote(
      req.params['id']!, req.user!.userId, req.body.body ?? req.body.content,
    );
    res.status(201).json({ success: true, data: note });
  }),

  /** GET /meetings/:id/notes */
  getMeetingNotes: asyncHandler(async (req: Request, res: Response) => {
    const notes = await callsService.getMeetingNotes(req.params['id']!);
    res.json({ success: true, data: notes });
  }),
};
