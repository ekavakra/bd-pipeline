/**
 * Lead Discovery Agent
 *
 * Autonomous agent that discovers new leads via SearXNG + web scraping + LLM extraction.
 * Uses existing services (web-search, scraper, lead-discovery) orchestrated autonomously.
 *
 * Capabilities:
 * - Run scheduled lead discovery based on configured filters
 * - Score newly discovered leads
 * - Auto-approve high-score leads
 * - Publish LEAD_DISCOVERED events
 */

import { BaseAgent, type AgentTask, type AgentResult } from './base.agent.js';
import { EVENTS } from '../services/event-bus.service.js';
import { prisma } from '../config/db.js';
import { leadSearchQueue, aiScoringQueue } from '../config/queue.js';

class LeadDiscoveryAgent extends BaseAgent {
  constructor() {
    super('lead-discovery');
  }

  async initialize(): Promise<void> {
    this.logger.info('Lead Discovery Agent initialized');
  }

  /**
   * Execute a specific discovery task from the job queue.
   */
  async executeTask(task: AgentTask): Promise<AgentResult> {
    this.logger.info({ taskType: task.type }, 'Executing lead discovery task');

    try {
      switch (task.type) {
        case 'discover': {
          const filters = task.payload['filters'] as Record<string, unknown>;
          const userId = (task.payload['userId'] as string) ?? 'system';

          // Queue a lead search job (reuses existing pipeline)
          const job = await leadSearchQueue.add('lead-search', {
            userId,
            filters,
            source: 'agent',
          });

          await this.logAction(
            'discover_leads',
            'lead_search_job',
            job.id ?? 'unknown',
            'success',
            'Scheduled autonomous lead discovery',
            { filters },
          );

          return { success: true, data: { jobId: job.id } };
        }

        case 'score-new': {
          // Find un-scored leads and queue them for AI scoring
          const unscoredLeads = await prisma.lead.findMany({
            where: { aiScore: null, status: 'DISCOVERED' },
            select: { id: true },
            take: (task.payload['batchSize'] as number) ?? 20,
          });

          if (unscoredLeads.length === 0) {
            return { success: true, data: { scored: 0 } };
          }

          const leadIds = unscoredLeads.map((l: { id: string }) => l.id);
          await aiScoringQueue.add('ai-scoring', { leadIds });

          await this.logAction(
            'score_new_leads',
            'lead',
            leadIds[0]!,
            'success',
            `Queued ${leadIds.length} leads for AI scoring`,
            { count: leadIds.length },
          );

          return { success: true, data: { scored: leadIds.length } };
        }

        case 'auto-qualify': {
          // Auto-approve leads with high scores
          const threshold = (task.payload['threshold'] as number) ?? 70;
          const highScoreLeads = await prisma.lead.findMany({
            where: {
              aiScore: { gte: threshold },
              status: 'PENDING_REVIEW',
            },
            select: { id: true, companyName: true, aiScore: true },
            take: 50,
          });

          if (highScoreLeads.length === 0) {
            return { success: true, data: { qualified: 0 } };
          }

          // Auto-approve them
          await prisma.lead.updateMany({
            where: { id: { in: highScoreLeads.map((l: { id: string }) => l.id) } },
            data: { status: 'APPROVED', reviewNotes: 'Auto-approved by agent (high AI score)' },
          });

          // Publish events
          for (const lead of highScoreLeads) {
            await this.publishEvent(EVENTS.LEAD_QUALIFIED, {
              leadId: lead.id,
              companyName: lead.companyName,
              score: lead.aiScore,
            });
          }

          await this.logAction(
            'auto_qualify_leads',
            'lead',
            highScoreLeads[0]!.id,
            'success',
            `Auto-approved ${highScoreLeads.length} high-score leads (threshold: ${threshold})`,
            { count: highScoreLeads.length, threshold },
          );

          return { success: true, data: { qualified: highScoreLeads.length } };
        }

        default:
          return { success: false, error: `Unknown task type: ${task.type}` };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err }, 'Lead discovery task failed');
      await this.logAction('discover_leads', 'system', 'n/a', 'failed', error);
      return { success: false, error };
    }
  }

  /**
   * Scheduled task — runs discovery pipeline and scores new leads.
   */
  async runScheduledTask(config: Record<string, unknown>): Promise<AgentResult> {
    this.logger.info('Running scheduled lead discovery');

    // Step 1: Score any un-scored leads
    const scoreResult = await this.executeTask({
      id: `scheduled-score-${Date.now()}`,
      type: 'score-new',
      payload: { batchSize: config['batchSize'] ?? 20 },
    });

    // Step 2: Auto-qualify high-score leads
    const qualifyResult = await this.executeTask({
      id: `scheduled-qualify-${Date.now()}`,
      type: 'auto-qualify',
      payload: { threshold: config['minScore'] ?? 70 },
    });

    return {
      success: true,
      data: {
        scored: scoreResult.data,
        qualified: qualifyResult.data,
      },
    };
  }
}

export const leadDiscoveryAgent = new LeadDiscoveryAgent();
