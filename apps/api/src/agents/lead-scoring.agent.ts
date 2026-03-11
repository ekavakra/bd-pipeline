/**
 * Lead Scoring Agent
 *
 * Autonomous agent that scores leads using the existing AI scoring pipeline.
 * Monitors for newly discovered leads and auto-triggers scoring.
 *
 * Capabilities:
 * - Score individual leads on demand
 * - Batch score all un-scored leads
 * - Publish LEAD_SCORED events
 */

import { BaseAgent, type AgentTask, type AgentResult } from './base.agent.js';
import { EVENTS } from '../services/event-bus.service.js';
import { prisma } from '../config/db.js';
import { aiScoringQueue } from '../config/queue.js';

class LeadScoringAgent extends BaseAgent {
  constructor() {
    super('lead-scoring');
  }

  async initialize(): Promise<void> {
    // Subscribe to lead discovered events — auto-trigger scoring
    this.subscribeToEvent(EVENTS.LEAD_DISCOVERED, async (event) => {
      const leadId = event.payload['leadId'] as string;
      if (leadId) {
        this.logger.info({ leadId }, 'New lead discovered — queueing for scoring');
        await aiScoringQueue.add('ai-scoring', { leadIds: [leadId] });
      }
    });

    this.logger.info('Lead Scoring Agent initialized');
  }

  async executeTask(task: AgentTask): Promise<AgentResult> {
    try {
      switch (task.type) {
        case 'score-lead': {
          const leadId = task.payload['leadId'] as string;
          await aiScoringQueue.add('ai-scoring', { leadIds: [leadId] });

          await this.logAction('score_lead', 'lead', leadId, 'success', 'Queued lead for AI scoring');
          return { success: true, data: { leadId } };
        }

        case 'score-batch': {
          const batchSize = (task.payload['batchSize'] as number) ?? 20;

          const unscoredLeads = await prisma.lead.findMany({
            where: { aiScore: null, status: { in: ['DISCOVERED', 'PENDING_REVIEW'] } },
            select: { id: true },
            take: batchSize,
          });

          if (unscoredLeads.length === 0) {
            return { success: true, data: { count: 0 } };
          }

          const leadIds = unscoredLeads.map((l: { id: string }) => l.id);
          await aiScoringQueue.add('ai-scoring', { leadIds });

          await this.logAction(
            'score_batch',
            'lead',
            leadIds[0]!,
            'success',
            `Queued ${leadIds.length} leads for batch scoring`,
            { count: leadIds.length },
          );

          return { success: true, data: { count: leadIds.length } };
        }

        default:
          return { success: false, error: `Unknown task type: ${task.type}` };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err }, 'Lead scoring task failed');
      return { success: false, error };
    }
  }

  async runScheduledTask(config: Record<string, unknown>): Promise<AgentResult> {
    return this.executeTask({
      id: `scheduled-scoring-${Date.now()}`,
      type: 'score-batch',
      payload: config,
    });
  }
}

export const leadScoringAgent = new LeadScoringAgent();
