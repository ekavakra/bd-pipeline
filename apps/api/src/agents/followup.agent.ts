/**
 * Follow-up Agent
 *
 * Autonomous agent that manages follow-up sequences for approved leads.
 * Monitors for pitch approvals and auto-schedules follow-up sequences.
 *
 * Capabilities:
 * - Auto-create follow-up sequences for contacted leads
 * - Monitor sequence progress
 * - Publish FOLLOWUP_SENT events
 */

import { BaseAgent, type AgentTask, type AgentResult } from './base.agent.js';
import { EVENTS } from '../services/event-bus.service.js';
import { prisma } from '../config/db.js';
import { followUpQueue } from '../config/queue.js';

class FollowupAgent extends BaseAgent {
  constructor() {
    super('followup');
  }

  async initialize(): Promise<void> {
    // Subscribe to pitch sent events — auto-schedule follow-up
    this.subscribeToEvent(EVENTS.PITCH_SENT, async (event) => {
      const leadId = event.payload['leadId'] as string;
      if (leadId) {
        this.logger.info({ leadId }, 'Pitch sent — checking if follow-up sequence needed');
        await this.ensureFollowupSequence(leadId);
      }
    });

    this.logger.info('Follow-up Agent initialized');
  }

  async executeTask(task: AgentTask): Promise<AgentResult> {
    try {
      switch (task.type) {
        case 'create-sequence': {
          const leadId = task.payload['leadId'] as string;
          const result = await this.ensureFollowupSequence(leadId);
          return { success: true, data: result };
        }

        case 'check-stale': {
          // Find leads that were contacted but have no follow-up
          const staleLeads = await prisma.lead.findMany({
            where: {
              status: 'CONTACTED',
              followupSequences: { none: {} },
              updatedAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) }, // 48+ hours ago
            },
            select: { id: true, companyName: true },
            take: 20,
          });

          for (const lead of staleLeads) {
            await this.ensureFollowupSequence(lead.id);
          }

          await this.logAction(
            'check_stale_leads',
            'lead',
            staleLeads[0]?.id ?? 'n/a',
            'success',
            `Found ${staleLeads.length} stale contacted leads without follow-ups`,
            { count: staleLeads.length },
          );

          return { success: true, data: { count: staleLeads.length } };
        }

        default:
          return { success: false, error: `Unknown task type: ${task.type}` };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err }, 'Follow-up task failed');
      return { success: false, error };
    }
  }

  async runScheduledTask(config: Record<string, unknown>): Promise<AgentResult> {
    return this.executeTask({
      id: `scheduled-followup-${Date.now()}`,
      type: 'check-stale',
      payload: config,
    });
  }

  /**
   * Ensure a follow-up sequence exists for a lead.
   * If none exists, create a default 3-step email sequence.
   */
  private async ensureFollowupSequence(leadId: string) {
    const existing = await prisma.followupSequence.findFirst({
      where: { leadId, status: 'ACTIVE' },
    });

    if (existing) {
      return { created: false, sequenceId: existing.id };
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { created: false, error: 'Lead not found' };

    // Create a default 3-step follow-up sequence
    const sequence = await prisma.followupSequence.create({
      data: {
        leadId,
        status: 'ACTIVE',
        currentStep: 0,
        totalSteps: 3,
        nextSendAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 3 days from now
        steps: {
          create: [
            {
              stepNumber: 1,
              channel: 'EMAIL',
              subject: `Following up — ${lead.companyName}`,
              body: `Hi ${lead.contactName ?? 'there'}, I wanted to follow up on our initial outreach...`,
              delayHours: 72,
              status: 'PENDING',
            },
            {
              stepNumber: 2,
              channel: 'EMAIL',
              subject: `Re: ${lead.companyName} — quick check-in`,
              body: `Hi ${lead.contactName ?? 'there'}, just a quick follow-up to see if you had a chance to review...`,
              delayHours: 120,
              status: 'PENDING',
            },
            {
              stepNumber: 3,
              channel: 'EMAIL',
              subject: `Last follow-up — ${lead.companyName}`,
              body: `Hi ${lead.contactName ?? 'there'}, I understand you may be busy. This will be my final follow-up...`,
              delayHours: 168,
              status: 'PENDING',
            },
          ],
        },
      },
    });

    // Queue the first step
    await followUpQueue.add('follow-up', {
      sequenceId: sequence.id,
      stepNumber: 1,
    }, {
      delay: 72 * 60 * 60 * 1000, // 3 days
    });

    await this.logAction(
      'create_followup_sequence',
      'lead',
      leadId,
      'success',
      'Created 3-step follow-up sequence',
      { sequenceId: sequence.id },
    );

    return { created: true, sequenceId: sequence.id };
  }
}

export const followupAgent = new FollowupAgent();
