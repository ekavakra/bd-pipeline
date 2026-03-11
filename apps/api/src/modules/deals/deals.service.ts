/**
 * Deals Service — Deal Close & Handoff
 *
 * Handles the critical deal-close → client creation → onboarding pipeline
 * transition as an atomic transaction. This is the bridge between Phase 1
 * (Business Development) and Phase 2 (Onboarding Pipeline).
 */

import { prisma } from '../../config/db.js';
import type { Prisma } from '@bd-pipeline/db';
import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/api-error.js';

interface DealCloseInput {
  leadId: string;
  proposalId?: string;
  contractValue: number;
  contractStart?: string;
  contractEnd?: string;
  assignedManagerId: string;
  notes?: string;
}

export const dealsService = {
  /**
   * Close a deal — atomic transaction that:
   * 1. Validates lead exists and is in a valid state
   * 2. Updates lead status to DEAL_CLOSED
   * 3. Optionally updates proposal status to ACCEPTED
   * 4. Creates Client record from lead data
   * 5. Creates OnboardingPipeline at DEAL_CLOSED stage
   * 6. Creates initial OnboardingStageLog entry
   * 7. Creates AuditLog entry
   */
  async closeDeal(userId: string, input: DealCloseInput) {
    // 1. Validate lead
    const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
    if (!lead) throw new NotFoundError('Lead');

    // Prevent re-closing
    if (lead.status === 'DEAL_CLOSED') {
      throw new ConflictError('This lead already has a closed deal');
    }

    // Ensure lead is in a valid pre-close state
    const validPreCloseStatuses = ['APPROVED', 'CONTACTED', 'RESPONDED', 'IN_DISCOVERY', 'PROPOSAL_SENT'];
    if (!validPreCloseStatuses.includes(lead.status)) {
      throw new BadRequestError(
        `Lead must be in one of [${validPreCloseStatuses.join(', ')}] to close a deal. Current: ${lead.status}`,
      );
    }

    // Check no client already exists for this lead
    const existingClient = await prisma.client.findUnique({ where: { leadId: input.leadId } });
    if (existingClient) {
      throw new ConflictError('A client record already exists for this lead');
    }

    // Validate proposal if provided
    if (input.proposalId) {
      const proposal = await prisma.proposal.findUnique({ where: { id: input.proposalId } });
      if (!proposal) throw new NotFoundError('Proposal');
      if (proposal.leadId !== input.leadId) {
        throw new BadRequestError('Proposal does not belong to this lead');
      }
    }

    // Validate assigned manager exists
    const manager = await prisma.user.findUnique({ where: { id: input.assignedManagerId } });
    if (!manager) throw new NotFoundError('Assigned manager (User)');

    // 2. Atomic transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update lead status → DEAL_CLOSED
      await tx.lead.update({
        where: { id: input.leadId },
        data: { status: 'DEAL_CLOSED' },
      });

      // Update proposal → ACCEPTED (if provided)
      if (input.proposalId) {
        await tx.proposal.update({
          where: { id: input.proposalId },
          data: { status: 'ACCEPTED' },
        });
      }

      // Create client record from lead data
      const client = await tx.client.create({
        data: {
          leadId: input.leadId,
          companyName: lead.companyName,
          primaryContactName: lead.contactName ?? lead.companyName,
          primaryContactEmail: lead.contactEmail ?? '',
          primaryContactPhone: lead.contactPhone,
          contractValue: input.contractValue,
          contractStart: input.contractStart ? new Date(input.contractStart) : undefined,
          contractEnd: input.contractEnd ? new Date(input.contractEnd) : undefined,
          assignedManagerId: input.assignedManagerId,
          status: 'ONBOARDING',
        },
      });

      // Create onboarding pipeline
      const pipeline = await tx.onboardingPipeline.create({
        data: {
          clientId: client.id,
          currentStage: 'DEAL_CLOSED',
          healthStatus: 'ON_TRACK',
        },
      });

      // Create initial stage log
      await tx.onboardingStageLog.create({
        data: {
          pipelineId: pipeline.id,
          fromStage: 'DEAL_CLOSED',
          toStage: 'DEAL_CLOSED',
          transitionedById: userId,
          notes: input.notes ?? 'Deal closed — onboarding pipeline created',
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DEAL_CLOSED',
          resourceType: 'client',
          resourceId: client.id,
          metadata: {
            leadId: input.leadId,
            proposalId: input.proposalId,
            contractValue: input.contractValue,
          },
        },
      });

      return { client, pipeline };
    });

    logger.info(
      {
        clientId: result.client.id,
        leadId: input.leadId,
        pipelineId: result.pipeline.id,
      },
      'Deal closed — client and onboarding pipeline created',
    );

    return {
      client: result.client,
      pipeline: result.pipeline,
      message: 'Deal closed successfully. Onboarding pipeline created.',
    };
  },

  /**
   * Get deal summary for a lead — returns lead + client + pipeline info
   */
  async getDeal(leadId: string) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        client: {
          include: {
            onboardingPipeline: true,
            assignedManager: { select: { id: true, name: true, email: true } },
          },
        },
        proposals: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!lead) throw new NotFoundError('Lead');
    if (lead.status !== 'DEAL_CLOSED' || !lead.client) {
      throw new BadRequestError('No closed deal found for this lead');
    }

    return {
      lead: {
        id: lead.id,
        companyName: lead.companyName,
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        status: lead.status,
      },
      client: lead.client,
      latestProposal: lead.proposals[0] ?? null,
    };
  },
};
