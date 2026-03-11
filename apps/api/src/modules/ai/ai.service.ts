/**
 * AI Service — Business Logic
 *
 * Next-action engine, email generation, NPS collection, upsell detection,
 * notification management, and Telegram integration.
 */

import { prisma } from '../../config/db.js';
import { notificationQueue, emailSendQueue } from '../../config/queue.js';
import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../utils/api-error.js';
import { paginate, buildPaginationMeta } from '../../utils/pagination.js';

export const aiService = {
  /**
   * AI next-action engine — analyzes context and recommends the next step.
   */
  async getNextAction(clientId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        pipeline: { include: { checklistItems: true } },
        meetings: { orderBy: { scheduledAt: 'desc' }, take: 3 },
        npsResponses: { orderBy: { createdAt: 'desc' }, take: 1 },
        healthScores: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
    });
    if (!client) throw new NotFoundError('Client');

    const { ChatOllama } = await import('@langchain/community/chat_models/ollama');
    const { ChatPromptTemplate } = await import('@langchain/core/prompts');
    const { StringOutputParser } = await import('@langchain/core/output_parsers');

    const model = new ChatOllama({
      model: process.env['OLLAMA_MODEL'] ?? 'gpt-oss:120b-cloud',
      baseUrl: process.env['OLLAMA_BASE_URL'] ?? 'http://ollama-host:11434',
      temperature: 0.3,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a business development AI assistant. Analyze the client context and recommend the single most impactful next action.
Return JSON: { "action": "short description", "priority": "high|medium|low", "reasoning": "brief explanation", "deadline": "suggested deadline" }`,
      ],
      [
        'human',
        `Client: {companyName}
Current Stage: {stage}
Pending Checklist Items: {pendingItems}
Recent Meetings: {recentMeetings}
Latest NPS: {nps}
Health Score: {healthScore}
Deal Value: {dealValue}`,
      ],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    const pendingItems = client.pipeline?.checklistItems
      .filter((i) => !i.completed)
      .map((i) => i.title)
      .join(', ') ?? 'None';

    const result = await chain.invoke({
      companyName: client.companyName,
      stage: client.pipeline?.currentStage ?? 'UNKNOWN',
      pendingItems: pendingItems || 'None',
      recentMeetings: client.meetings.map((m) => `${m.title} (${m.status})`).join(', ') || 'None',
      nps: client.npsResponses[0]?.score?.toString() ?? 'Not collected',
      healthScore: client.healthScores[0]?.score?.toString() ?? 'Not measured',
      dealValue: client.dealValue?.toString() ?? 'Unknown',
    });

    return { clientId, recommendation: result };
  },

  /**
   * Generate an AI email for a client.
   */
  async generateEmail(
    clientId: string,
    userId: string,
    purpose: string,
    context?: string,
  ) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundError('Client');

    const { ChatOllama } = await import('@langchain/community/chat_models/ollama');
    const { ChatPromptTemplate } = await import('@langchain/core/prompts');
    const { StringOutputParser } = await import('@langchain/core/output_parsers');

    const model = new ChatOllama({
      model: process.env['OLLAMA_MODEL'] ?? 'gpt-oss:120b-cloud',
      baseUrl: process.env['OLLAMA_BASE_URL'] ?? 'http://ollama-host:11434',
      temperature: 0.5,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'Write a professional business email. Include Subject line and Body.'],
      [
        'human',
        `Purpose: {purpose}
Client: {companyName}
Contact: {contactName}
${context ? `Context: ${context}` : ''}`,
      ],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const content = await chain.invoke({
      purpose,
      companyName: client.companyName,
      contactName: client.contactName ?? 'Valued Client',
    });

    const email = await prisma.aiEmail.create({
      data: {
        clientId,
        generatedById: userId,
        purpose,
        content,
        status: 'DRAFT',
      },
    });

    return email;
  },

  /** Edit an AI-generated email */
  async editEmail(id: string, data: { content?: string; status?: string }) {
    const email = await prisma.aiEmail.findUnique({ where: { id } });
    if (!email) throw new NotFoundError('Email');
    return prisma.aiEmail.update({ where: { id }, data });
  },

  /** Collect an NPS response for a client */
  async collectNps(clientId: string, score: number, feedback?: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundError('Client');

    if (score < 0 || score > 10) throw new BadRequestError('NPS score must be 0-10');

    const response = await prisma.npsResponse.create({
      data: { clientId, score, feedback },
    });

    // If detractor (score <= 6), queue a notification
    if (score <= 6) {
      await notificationQueue.add('nps-alert', {
        clientId,
        score,
        feedback,
        type: 'NPS_DETRACTOR',
      });
    }

    return response;
  },

  /**
   * AI-powered upsell detection for a client.
   */
  async flagUpsell(clientId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        npsResponses: { orderBy: { createdAt: 'desc' }, take: 3 },
        healthScores: { orderBy: { recordedAt: 'desc' }, take: 1 },
        requirements: true,
      },
    });
    if (!client) throw new NotFoundError('Client');

    const { ChatOllama } = await import('@langchain/community/chat_models/ollama');
    const { ChatPromptTemplate } = await import('@langchain/core/prompts');
    const { StringOutputParser } = await import('@langchain/core/output_parsers');

    const model = new ChatOllama({
      model: process.env['OLLAMA_MODEL'] ?? 'gpt-oss:120b-cloud',
      baseUrl: process.env['OLLAMA_BASE_URL'] ?? 'http://ollama-host:11434',
      temperature: 0.3,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `Analyze this client's data and identify upsell/cross-sell opportunities.
Return JSON: { "opportunities": [{ "type": "upsell|cross-sell", "description": "...", "confidence": 0.0-1.0, "estimatedValue": "$X" }], "reasoning": "..." }`,
      ],
      [
        'human',
        `Company: {companyName}
Deal Value: {dealValue}
NPS Scores: {nps}
Health: {health}
Requirements: {requirements}`,
      ],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    const result = await chain.invoke({
      companyName: client.companyName,
      dealValue: client.dealValue?.toString() ?? 'Unknown',
      nps: client.npsResponses.map((n) => n.score).join(', ') || 'None',
      health: client.healthScores[0]?.score?.toString() ?? 'Not measured',
      requirements: client.requirements.map((r) => r.title).join(', ') || 'None',
    });

    return { clientId, analysis: result };
  },

  /** List notifications for a user */
  async listNotifications(userId: string, query: { page: number; limit: number; unreadOnly?: boolean }) {
    const where: Record<string, unknown> = { userId };
    if (query.unreadOnly) where['read'] = false;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        ...paginate(query.page, query.limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    return { notifications, meta: buildPaginationMeta(total, query.page, query.limit) };
  },

  /** Mark a single notification as read */
  async markNotificationRead(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundError('Notification');
    if (notification.userId !== userId) throw new NotFoundError('Notification');

    return prisma.notification.update({ where: { id }, data: { read: true } });
  },

  /** Mark all notifications read for a user */
  async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { updated: result.count };
  },

  /** Send a Telegram message (delegates to queue) */
  async sendTelegram(chatId: string, message: string) {
    await notificationQueue.add('telegram-send', { chatId, message });
    return { message: 'Telegram message queued' };
  },
};
