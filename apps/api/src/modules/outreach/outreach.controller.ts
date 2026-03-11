/**
 * Outreach Controller — Request Handling
 */

import type { Request, Response } from 'express';
import { outreachService } from './outreach.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const outreachController = {
  /** POST /outreach/pitch — Generate AI pitch */
  generatePitch: asyncHandler(async (req: Request, res: Response) => {
    const { leadId, channel, tone, template, additionalContext } = req.body;
    const pitch = await outreachService.generatePitch(
      leadId, req.user!.userId, channel, tone, template, additionalContext,
    );
    res.status(201).json({ success: true, data: pitch });
  }),

  /** GET /outreach/pitch/:id */
  getPitch: asyncHandler(async (req: Request, res: Response) => {
    const pitch = await outreachService.getPitch(req.params['id']!);
    res.json({ success: true, data: pitch });
  }),

  /** PATCH /outreach/pitch/:id */
  editPitch: asyncHandler(async (req: Request, res: Response) => {
    const pitch = await outreachService.editPitch(req.params['id']!, req.body);
    res.json({ success: true, data: pitch });
  }),

  /** POST /outreach/pitch/:id/approve */
  approvePitch: asyncHandler(async (req: Request, res: Response) => {
    const pitch = await outreachService.approvePitch(req.params['id']!, req.user!.userId);
    res.json({ success: true, data: pitch });
  }),

  /** POST /outreach/pitch/:id/send */
  sendPitch: asyncHandler(async (req: Request, res: Response) => {
    const result = await outreachService.sendPitch(req.params['id']!, req.body.channel ?? 'EMAIL');
    res.status(202).json({ success: true, data: result });
  }),

  /** POST /outreach/followup — Schedule follow-up sequence */
  scheduleFollowup: asyncHandler(async (req: Request, res: Response) => {
    const { leadId, steps } = req.body;
    const sequence = await outreachService.scheduleFollowup(leadId, req.user!.userId, steps);
    res.status(201).json({ success: true, data: sequence });
  }),

  /** GET /outreach/followup/:id */
  getFollowupSequence: asyncHandler(async (req: Request, res: Response) => {
    const sequence = await outreachService.getFollowupSequence(req.params['id']!);
    res.json({ success: true, data: sequence });
  }),

  /** DELETE /outreach/followup/:id — Cancel sequence */
  cancelFollowup: asyncHandler(async (req: Request, res: Response) => {
    const result = await outreachService.cancelFollowup(req.params['id']!);
    res.json({ success: true, data: result });
  }),

  /** GET /outreach/analytics — Outreach metrics */
  getAnalytics: asyncHandler(async (_req: Request, res: Response) => {
    const analytics = await outreachService.getAnalytics();
    res.json({ success: true, data: analytics });
  }),
};
