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
import type { Prisma } from '@bd-pipeline/db';

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
        { contactName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.assignedTo) where.accountManagerId = query.assignedTo;

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        ...paginate(query.page, query.limit),
        orderBy: { [query.sortBy]: query.sortOrder },
        include: {
          accountManager: { select: { id: true, name: true, email: true } },
          pipeline: { select: { id: true, currentStage: true, slaBreached: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return { clients, meta: buildPaginationMeta(total, query.page, query.limit) };
  },

  /** Create a new client from a closed deal */
  async create(data: Prisma.ClientCreateInput & { accountManagerId: string }) {
    const client = await prisma.$transaction(async (tx) => {
      const newClient = await tx.client.create({
        data: {
          companyName: data.companyName,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          dealValue: data.dealValue,
          accountManagerId: data.accountManagerId,
        } as never,
      });

      // Create the onboarding pipeline
      await tx.onboardingPipeline.create({
        data: {
          clientId: newClient.id,
          currentStage: 'DISCOVERY',
        },
      });

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
        accountManager: { select: { id: true, name: true, email: true } },
        pipeline: {
          include: {
            stageLogs: { orderBy: { enteredAt: 'desc' } },
            checklistItems: { orderBy: { createdAt: 'asc' } },
          },
        },
        requirements: { orderBy: { priority: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        meetings: { orderBy: { scheduledAt: 'desc' }, take: 10 },
        npsResponses: { orderBy: { createdAt: 'desc' }, take: 5 },
        healthScores: { orderBy: { recordedAt: 'desc' }, take: 1 },
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
        stageLogs: { orderBy: { enteredAt: 'desc' } },
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

    // Check all checklist items are completed for current stage
    const pendingItems = await prisma.checklistItem.count({
      where: { pipelineId: pipeline.id, stage: pipeline.currentStage, completed: false },
    });
    if (pendingItems > 0) {
      throw new BadRequestError(`${pendingItems} checklist item(s) still pending for this stage`);
    }

    const nextStage = STAGE_ORDER[currentIdx + 1]!;

    await prisma.$transaction([
      prisma.onboardingPipeline.update({
        where: { clientId },
        data: { currentStage: nextStage, stageEnteredAt: new Date() },
      }),
      prisma.onboardingStageLog.create({
        data: {
          pipelineId: pipeline.id,
          stage: nextStage,
          enteredAt: new Date(),
          enteredById: userId,
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
        data: { currentStage: stage, stageEnteredAt: new Date() },
      }),
      prisma.onboardingStageLog.create({
        data: {
          pipelineId: pipeline.id,
          stage,
          enteredAt: new Date(),
          enteredById: userId,
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
  async updateChecklistItem(itemId: string, userId: string, completed: boolean) {
    const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundError('Checklist item');

    return prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
        completedById: completed ? userId : null,
      },
    });
  },

  /** Get requirements for a client */
  async getRequirements(clientId: string) {
    return prisma.requirement.findMany({
      where: { clientId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  },

  /** Add a new requirement to a client */
  async addRequirement(clientId: string, data: { title: string; description?: string; priority: string }) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundError('Client');

    return prisma.requirement.create({
      data: {
        clientId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: 'OPEN',
      },
    });
  },

  /** Get customer health score for a client */
  async getHealth(clientId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundError('Client');

    const [latestHealth, npsAvg, meetingCount] = await Promise.all([
      prisma.customerHealth.findFirst({
        where: { clientId },
        orderBy: { recordedAt: 'desc' },
      }),
      prisma.npsResponse.aggregate({
        where: { clientId },
        _avg: { score: true },
      }),
      prisma.meeting.count({ where: { clientId } }),
    ]);

    return {
      latestHealth,
      npsAverage: npsAvg._avg.score,
      meetingCount,
    };
  },

  /** Get all clients with SLA breaches */
  async getSlaBreaches() {
    return prisma.onboardingPipeline.findMany({
      where: { slaBreached: true },
      include: {
        client: { select: { id: true, companyName: true, contactName: true } },
        stageLogs: { orderBy: { enteredAt: 'desc' }, take: 1 },
      },
      orderBy: { stageEnteredAt: 'asc' },
    });
  },
};
