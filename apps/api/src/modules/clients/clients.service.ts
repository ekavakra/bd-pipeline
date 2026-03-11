/**
 * Clients Service — Business Logic
 *
 * Client onboarding pipeline management, stage advancement with SLA enforcement,
 * checklist tracking, requirements, and customer health scoring.
 */

import { prisma } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../utils/api-error.js';
import { paginate, buildPaginationMeta } from '../../utils/pagination.js';

/** Ordered onboarding stages — must match Prisma OnboardingStage enum */
const STAGE_ORDER = [
  'DEAL_CLOSED',
  'KICKOFF',
  'REQUIREMENTS_GATHERING',
  'DOCUMENTATION',
  'TECHNICAL_SETUP',
  'TESTING_UAT',
  'GO_LIVE',
  'TRAINING',
  'COMPLETED',
] as const;

export const clientsService = {
  /**
   * List clients with pagination and filtering.
   */
  async list(query: {
    page: number;
    limit: number;
    stage?: string;
    assignedTo?: string;
    search?: string;
    sortBy: string;
    sortOrder: string;
  }) {
    const where: Prisma.ClientWhereInput = {};

    if (query.search) {
      where.OR = [
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { primaryContactName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.assignedTo) where.assignedManagerId = query.assignedTo;

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        ...paginate(query.page, query.limit),
        orderBy: { [query.sortBy]: query.sortOrder },
        include: {
          assignedManager: { select: { id: true, name: true, email: true } },
          onboardingPipeline: { select: { id: true, currentStage: true, healthStatus: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return { clients, meta: buildPaginationMeta(total, query.page, query.limit) };
  },

  /** Create a new client (manual — bypasses deal flow) */
  async create(data: {
    leadId: string;
    companyName: string;
    primaryContactName: string;
    primaryContactEmail: string;
    primaryContactPhone?: string;
    contractValue?: number;
    contractStart?: Date;
    contractEnd?: Date;
    assignedManagerId: string;
  }) {
    const client = await prisma.$transaction(async (tx) => {
      const newClient = await tx.client.create({
        data: {
          leadId: data.leadId,
          companyName: data.companyName,
          primaryContactName: data.primaryContactName,
          primaryContactEmail: data.primaryContactEmail,
          primaryContactPhone: data.primaryContactPhone,
          contractValue: data.contractValue,
          contractStart: data.contractStart,
          contractEnd: data.contractEnd,
          assignedManagerId: data.assignedManagerId,
        },
      });

      // Create the onboarding pipeline starting at DEAL_CLOSED
      await tx.onboardingPipeline.create({
        data: {
          clientId: newClient.id,
          currentStage: 'DEAL_CLOSED',
        },
      });

      // Create initial stage log
      const pipeline = await tx.onboardingPipeline.findUnique({ where: { clientId: newClient.id } });
      if (pipeline) {
        await tx.onboardingStageLog.create({
          data: {
            pipelineId: pipeline.id,
            fromStage: 'DEAL_CLOSED',
            toStage: 'DEAL_CLOSED',
            transitionedById: data.assignedManagerId,
            notes: 'Client created — onboarding pipeline initialised',
          },
        });
      }

      return newClient;
    });

    logger.info({ clientId: client.id }, 'New client created with onboarding pipeline');
    return client;
  },

  /** Get a single client with full details */
  async getById(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        assignedManager: { select: { id: true, name: true, email: true } },
        onboardingPipeline: {
          include: {
            stageLogs: { orderBy: { transitionedAt: 'desc' } },
            checklistItems: { orderBy: { createdAt: 'asc' } },
          },
        },
        requirements: { orderBy: { createdAt: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        meetings: { orderBy: { scheduledAt: 'desc' }, take: 10 },
        npsResponses: { orderBy: { collectedAt: 'desc' }, take: 5 },
        customerHealth: true,
      },
    });
    if (!client) throw new NotFoundError('Client');
    return client;
  },

  /** Update client details */
  async update(id: string, data: Prisma.ClientUpdateInput) {
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Client');
    return prisma.client.update({ where: { id }, data });
  },

  /** Get the onboarding pipeline for a client */
  async getPipeline(clientId: string) {
    const pipeline = await prisma.onboardingPipeline.findUnique({
      where: { clientId },
      include: {
        stageLogs: { orderBy: { transitionedAt: 'desc' } },
        checklistItems: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!pipeline) throw new NotFoundError('Pipeline');
    return pipeline;
  },

  /**
   * Advance the client to the next onboarding stage.
   * Validates stage order and logs the transition.
   */
  async advanceStage(clientId: string, userId: string, notes?: string) {
    const pipeline = await prisma.onboardingPipeline.findUnique({ where: { clientId } });
    if (!pipeline) throw new NotFoundError('Pipeline');

    const currentIdx = STAGE_ORDER.indexOf(pipeline.currentStage as (typeof STAGE_ORDER)[number]);
    if (currentIdx === -1 || currentIdx >= STAGE_ORDER.length - 1) {
      throw new BadRequestError('Cannot advance past the final stage');
    }

    // Check all mandatory checklist items are completed for current stage
    const pendingItems = await prisma.checklistItem.count({
      where: { pipelineId: pipeline.id, stage: pipeline.currentStage, isMandatory: true, isCompleted: false },
    });
    if (pendingItems > 0) {
      throw new BadRequestError(`${pendingItems} mandatory checklist item(s) still pending for this stage`);
    }

    const nextStage = STAGE_ORDER[currentIdx + 1]!;

    await prisma.$transaction([
      prisma.onboardingPipeline.update({
        where: { clientId },
        data: { currentStage: nextStage, lastActivityAt: new Date() },
      }),
      prisma.onboardingStageLog.create({
        data: {
          pipelineId: pipeline.id,
          fromStage: pipeline.currentStage,
          toStage: nextStage,
          transitionedById: userId,
          notes,
        },
      }),
    ]);

    logger.info({ clientId, from: pipeline.currentStage, to: nextStage }, 'Stage advanced');
    return { previousStage: pipeline.currentStage, currentStage: nextStage };
  },

  /** Force-set a specific stage (admin override) */
  async setStage(clientId: string, userId: string, stage: string, notes?: string) {
    const pipeline = await prisma.onboardingPipeline.findUnique({ where: { clientId } });
    if (!pipeline) throw new NotFoundError('Pipeline');

    if (!STAGE_ORDER.includes(stage as (typeof STAGE_ORDER)[number])) {
      throw new BadRequestError('Invalid onboarding stage');
    }

    await prisma.$transaction([
      prisma.onboardingPipeline.update({
        where: { clientId },
        data: { currentStage: stage, lastActivityAt: new Date() },
      }),
      prisma.onboardingStageLog.create({
        data: {
          pipelineId: pipeline.id,
          fromStage: pipeline.currentStage,
          toStage: stage,
          transitionedById: userId,
          notes: notes ?? 'Admin override',
        },
      }),
    ]);

    logger.info({ clientId, stage, userId }, 'Stage manually set');
    return { currentStage: stage };
  },

  /** Get checklist items for a client's pipeline */
  async getChecklist(clientId: string) {
    const pipeline = await prisma.onboardingPipeline.findUnique({ where: { clientId } });
    if (!pipeline) throw new NotFoundError('Pipeline');

    return prisma.checklistItem.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: [{ stage: 'asc' }, { createdAt: 'asc' }],
    });
  },

  /** Toggle a checklist item's completion status */
  async updateChecklistItem(itemId: string, userId: string, isCompleted: boolean) {
    const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundError('Checklist item');

    return prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        completedById: isCompleted ? userId : null,
      },
    });
  },

  /** Get requirements for a client */
  async getRequirements(clientId: string) {
    return prisma.requirement.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
    });
  },

  /** Add a new requirement to a client */
  async addRequirement(clientId: string, userId: string, data: { title: string; body: string }) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { onboardingPipeline: true },
    });
    if (!client) throw new NotFoundError('Client');
    if (!client.onboardingPipeline) throw new NotFoundError('Pipeline');

    return prisma.requirement.create({
      data: {
        clientId,
        pipelineId: client.onboardingPipeline.id,
        title: data.title,
        body: data.body,
        gatheredById: userId,
      },
    });
  },

  /** Get customer health score for a client */
  async getHealth(clientId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundError('Client');

    const [customerHealth, npsAvg, meetingCount] = await Promise.all([
      prisma.customerHealth.findUnique({
        where: { clientId },
      }),
      prisma.npsResponse.aggregate({
        where: { clientId },
        _avg: { score: true },
      }),
      prisma.meeting.count({ where: { clientId } }),
    ]);

    return {
      customerHealth,
      npsAverage: npsAvg._avg.score,
      meetingCount,
    };
  },

  /** Get all clients with SLA breaches (OVERDUE or AT_RISK health) */
  async getSlaBreaches() {
    return prisma.onboardingPipeline.findMany({
      where: { healthStatus: { in: ['OVERDUE', 'AT_RISK'] } },
      include: {
        client: { select: { id: true, companyName: true, primaryContactName: true } },
        stageLogs: { orderBy: { transitionedAt: 'desc' }, take: 1 },
      },
      orderBy: { lastActivityAt: 'asc' },
    });
  },
};
