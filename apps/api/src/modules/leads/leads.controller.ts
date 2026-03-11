/**
 * Leads Controller — Request Handling
 */

import type { Request, Response } from 'express';
import { leadsService } from './leads.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const leadsController = {
  /** POST /leads — Create a new lead */
  create: asyncHandler(async (req: Request, res: Response) => {
    const lead = await leadsService.create(req.body, req.user!.userId);
    res.status(201).json({ success: true, data: lead });
  }),

  /** GET /leads — List all leads with pagination */
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await leadsService.list(req.query as never);
    res.json({ success: true, data: { leads: result.leads, meta: result.meta } });
  }),

  /** GET /leads/:id — Get single lead detail */
  getById: asyncHandler(async (req: Request, res: Response) => {
    const lead = await leadsService.getById(req.params['id']!);
    res.json({ success: true, data: lead });
  }),

  /** PATCH /leads/:id — Update lead fields */
  update: asyncHandler(async (req: Request, res: Response) => {
    const lead = await leadsService.update(req.params['id']!, req.body);
    res.json({ success: true, data: lead });
  }),

  /** DELETE /leads/:id — Archive lead */
  remove: asyncHandler(async (req: Request, res: Response) => {
    await leadsService.remove(req.params['id']!);
    res.json({ success: true, data: { message: 'Lead archived' } });
  }),

  /** GET /leads/search-jobs — List recent search jobs */
  listSearchJobs: asyncHandler(async (_req: Request, res: Response) => {
    const jobs = await leadsService.listSearchJobs();
    res.json({ success: true, data: jobs });
  }),

  /** POST /leads/search — Trigger AI lead search job */
  triggerSearch: asyncHandler(async (req: Request, res: Response) => {
    const result = await leadsService.triggerSearch(req.user!.userId, req.body);
    res.status(202).json({ success: true, data: result });
  }),

  /** GET /leads/search/status/:jobId — Poll search job status */
  getSearchStatus: asyncHandler(async (req: Request, res: Response) => {
    const job = await leadsService.getSearchStatus(req.params['jobId']!);
    res.json({ success: true, data: job });
  }),

  /** POST /leads/:id/enrich — Trigger lead enrichment */
  enrich: asyncHandler(async (req: Request, res: Response) => {
    const result = await leadsService.enrich(req.params['id']!);
    res.status(202).json({ success: true, data: result });
  }),

  /** POST /leads/score — Batch AI scoring */
  scoreBatch: asyncHandler(async (req: Request, res: Response) => {
    const result = await leadsService.scoreBatch(req.body?.leadIds);
    res.status(202).json({ success: true, data: result });
  }),

  /** GET /leads/:id/score — Get score breakdown */
  getScore: asyncHandler(async (req: Request, res: Response) => {
    const score = await leadsService.getScore(req.params['id']!);
    res.json({ success: true, data: score });
  }),

  /** PATCH /leads/:id/score — Human score override */
  overrideScore: asyncHandler(async (req: Request, res: Response) => {
    const { score, reason } = req.body;
    const lead = await leadsService.overrideScore(
      req.params['id']!, req.user!.userId, score, reason,
    );
    res.json({ success: true, data: lead });
  }),

  /** GET /leads/review/queue — Get leads pending review */
  getReviewQueue: asyncHandler(async (_req: Request, res: Response) => {
    const leads = await leadsService.getReviewQueue();
    res.json({ success: true, data: leads });
  }),

  /** PATCH /leads/:id/review — Review a lead */
  reviewLead: asyncHandler(async (req: Request, res: Response) => {
    const { decision, notes } = req.body;
    const lead = await leadsService.reviewLead(
      req.params['id']!, req.user!.userId, decision, notes,
    );
    res.json({ success: true, data: lead });
  }),

  /** POST /leads/review/bulk — Bulk review leads */
  bulkReview: asyncHandler(async (req: Request, res: Response) => {
    const { leadIds, decision, notes } = req.body;
    const result = await leadsService.bulkReview(
      req.user!.userId, leadIds, decision, notes,
    );
    res.json({ success: true, data: result });
  }),

  /**
   * GET /leads/search/:jobId/stream — SSE real-time progress stream.
   *
   * Runs the AI search inline (or replays if already complete) and streams
   * progress events to the client as SSE messages:
   *   data: {"step":"searching","progress":20,"message":"Querying..."}
   *
   * Authentication: Bearer token OR ?token= query param (EventSource workaround).
   */
  streamSearch: async (req: Request, res: Response) => {
    const { jobId } = req.params;

    // ── SSE housekeeping ──────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    const send = (data: object) => {
      if (!res.destroyed) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Heartbeat keeps the connection alive through proxies
    const heartbeat = setInterval(() => {
      if (!res.destroyed) res.write(': ping\n\n');
    }, 15_000);

    const finish = () => {
      clearInterval(heartbeat);
      if (!res.destroyed) res.end();
    };

    req.on('close', finish);

    try {
      await leadsService.runSearchWithProgress(jobId!, send);
    } catch (err) {
      send({ step: 'error', progress: 0, message: err instanceof Error ? err.message : 'Search failed' });
    } finally {
      finish();
    }
  },
};
