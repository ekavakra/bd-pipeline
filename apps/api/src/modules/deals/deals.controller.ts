/**
 * Deals Controller — Request Handling
 */

import type { Request, Response } from 'express';
import { dealsService } from './deals.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const dealsController = {
  /** POST /deals/close */
  closeDeal: asyncHandler(async (req: Request, res: Response) => {
    const result = await dealsService.closeDeal(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: result });
  }),

  /** GET /deals/:id */
  getDeal: asyncHandler(async (req: Request, res: Response) => {
    const deal = await dealsService.getDeal(req.params['id']!);
    res.json({ success: true, data: deal });
  }),
};
