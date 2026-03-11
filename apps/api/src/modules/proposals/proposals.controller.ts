/**
 * Proposals Controller — Request Handling
 */

import type { Request, Response } from 'express';
import { proposalsService } from './proposals.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const proposalsController = {
  /** POST /proposals/generate — AI proposal generation */
  generate: asyncHandler(async (req: Request, res: Response) => {
    const { leadId, requirements, budget, timeline } = req.body;
    const proposal = await proposalsService.generate(
      leadId, req.user!.userId, requirements, budget, timeline,
    );
    res.status(201).json({ success: true, data: proposal });
  }),

  /** GET /proposals/:id */
  getById: asyncHandler(async (req: Request, res: Response) => {
    const proposal = await proposalsService.getById(req.params['id']!);
    res.json({ success: true, data: proposal });
  }),

  /** PATCH /proposals/:id */
  edit: asyncHandler(async (req: Request, res: Response) => {
    const proposal = await proposalsService.edit(req.params['id']!, req.body);
    res.json({ success: true, data: proposal });
  }),

  /** POST /proposals/:id/approve */
  approve: asyncHandler(async (req: Request, res: Response) => {
    const proposal = await proposalsService.approve(req.params['id']!);
    res.json({ success: true, data: proposal });
  }),

  /** GET /proposals/lead/:leadId */
  listByLead: asyncHandler(async (req: Request, res: Response) => {
    const proposals = await proposalsService.listByLead(req.params['leadId']!);
    res.json({ success: true, data: proposals });
  }),

  /** POST /deals/close — Close deal, create client, start onboarding */
  closeDeal: asyncHandler(async (req: Request, res: Response) => {
    const {
      leadId,
      proposalId,
      dealValue,
      contractValue,
      accountManagerId,
      assignedManagerId,
    } = req.body;

    const client = await proposalsService.closeDeal({
      leadId,
      proposalId,
      dealValue: dealValue ?? contractValue,
      accountManagerId: accountManagerId ?? assignedManagerId,
      userId: req.user!.userId,
    });
    res.status(201).json({ success: true, data: client });
  }),
};
