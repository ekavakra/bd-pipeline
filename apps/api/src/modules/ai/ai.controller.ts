/**
 * AI Controller — Request Handling
 */

import type { Request, Response } from 'express';
import { aiService } from './ai.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const aiController = {
  /** POST /ai/next-action */
  getNextAction: asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.getNextAction(req.body.clientId);
    res.json({ success: true, data: result });
  }),

  /** POST /ai/email/generate */
  generateEmail: asyncHandler(async (req: Request, res: Response) => {
    const { clientId, purpose, context } = req.body;
    const email = await aiService.generateEmail(clientId, req.user!.userId, purpose, context);
    res.status(201).json({ success: true, data: email });
  }),

  /** PATCH /ai/email/:id */
  editEmail: asyncHandler(async (req: Request, res: Response) => {
    const email = await aiService.editEmail(req.params['id']!, req.body);
    res.json({ success: true, data: email });
  }),

  /** POST /ai/nps */
  collectNps: asyncHandler(async (req: Request, res: Response) => {
    const { clientId, score, feedback } = req.body;
    const response = await aiService.collectNps(clientId, score, feedback);
    res.status(201).json({ success: true, data: response });
  }),

  /** POST /ai/upsell */
  flagUpsell: asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.flagUpsell(req.body.clientId);
    res.json({ success: true, data: result });
  }),

  /** GET /notifications */
  listNotifications: asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.listNotifications(req.user!.userId, req.query as never);
    res.json({ success: true, data: { notifications: result.notifications, meta: result.meta } });
  }),

  /** PATCH /notifications/:id/read */
  markNotificationRead: asyncHandler(async (req: Request, res: Response) => {
    const notification = await aiService.markNotificationRead(req.params['id']!, req.user!.userId);
    res.json({ success: true, data: notification });
  }),

  /** POST /notifications/read-all */
  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.markAllRead(req.user!.userId);
    res.json({ success: true, data: result });
  }),

  /** POST /telegram/send */
  sendTelegram: asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.sendTelegram(req.body.chatId, req.body.message);
    res.status(202).json({ success: true, data: result });
  }),
};
