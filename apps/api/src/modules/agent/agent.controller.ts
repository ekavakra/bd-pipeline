/**
 * Agent Controller — Request Handling
 */

import type { Request, Response, RequestHandler } from 'express';
import { agentService } from './agent.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const agentController: Record<string, RequestHandler> = {
  /** GET /agent/status — All agent statuses */
  getStatus: asyncHandler(async (_req: Request, res: Response) => {
    const statuses = await agentService.getAllStatus();
    res.json({ success: true, data: statuses });
  }),

  /** GET /agent/activity — Agent activity logs */
  getActivity: asyncHandler(async (req: Request, res: Response) => {
    const { agentType, status, limit, offset } = req.query;
    const result = await agentService.getActivity({
      agentType: agentType as string | undefined,
      status: status as string | undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json({ success: true, data: result });
  }),

  /** GET /agent/config — All agent configs */
  getAllConfigs: asyncHandler(async (_req: Request, res: Response) => {
    const configs = await agentService.getAllConfigs();
    res.json({ success: true, data: configs });
  }),

  /** GET /agent/config/:agentName — Single agent config */
  getConfig: asyncHandler(async (req: Request, res: Response) => {
    const config = await agentService.getConfig(req.params['agentName'] as string);
    res.json({ success: true, data: config });
  }),

  /** PATCH /agent/config/:agentName — Update agent config */
  updateConfig: asyncHandler(async (req: Request, res: Response) => {
    const config = await agentService.updateConfig(
      req.params['agentName'] as string,
      req.body,
    );
    res.json({ success: true, data: config });
  }),

  /** POST /agent/trigger/:agentName — Manually trigger agent */
  triggerAgent: asyncHandler(async (req: Request, res: Response) => {
    const result = await agentService.triggerAgent(
      req.params['agentName'] as string,
      req.body.task,
    );
    res.json({ success: true, data: result });
  }),

  /** GET /agent/events — Recent events */
  getEvents: asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query['limit'] ? Number(req.query['limit']) : 50;
    const events = await agentService.getRecentEvents(limit);
    res.json({ success: true, data: events });
  }),
};
