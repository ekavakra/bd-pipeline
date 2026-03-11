/**
 * BullMQ Job Processors
 *
 * Each processor handles a specific queue's jobs.
 * Processors are registered in the worker entry point.
 */

import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { transcriptionService } from '../services/transcription.service.js';
import { sendgridService } from '../services/sendgrid.service.js';
import { telegramService } from '../services/telegram.service.js';
import { clearbitService } from '../services/clearbit.service.js';
import { hunterService } from '../services/hunter.service.js';
import type { Job } from 'bullmq';
import { leadsService } from '../modules/leads/leads.service.js';

// ── Lead Search Processor ────────────────────
// Delegates to leadsService.runSearchWithProgress which uses the
// multi-source AI discovery pipeline (LLM + web search + Apollo).

export async function processLeadSearch(job: Job) {
  const { jobId } = job.data as { jobId: string; filters: Record<string, unknown> };
  logger.info({ jobId }, 'BullMQ: Processing lead search job');

  // Check if the SSE stream handler already completed this job
  const searchJob = await prisma.leadSearchJob.findUnique({ where: { id: jobId } });
  if (!searchJob) {
    logger.warn({ jobId }, 'BullMQ: Search job not found — skipping');
    return;
  }
  if (searchJob.status === 'COMPLETED' || searchJob.status === 'FAILED') {
    logger.info({ jobId, status: searchJob.status }, 'BullMQ: Job already finished (SSE handler) — skipping');
    return;
  }
  if (searchJob.status === 'RUNNING') {
    logger.info({ jobId }, 'BullMQ: Job already running (SSE handler) — skipping');
    return;
  }

  // Run the full discovery pipeline with a no-op emitter (no SSE client)
  try {
    await leadsService.runSearchWithProgress(jobId, () => {});
    logger.info({ jobId }, 'BullMQ: Lead search completed');
  } catch (error) {
    logger.error({ error, jobId }, 'BullMQ: Lead search failed');
    throw error;
  }
}

// ── Lead Enrichment Processor ────────────────

export async function processLeadEnrich(job: Job) {
  const { leadId } = job.data as { leadId: string };
  logger.info({ leadId }, 'Enriching lead');

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  // Enrich via Clearbit (if we have a domain)
  const domain = lead.contactEmail?.split('@')[1];
  if (domain) {
    const enrichment = await clearbitService.enrichCompany(domain);
    if (enrichment) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          industry: enrichment.industry || lead.industry,
          companySize: enrichment.employeeCount ? String(enrichment.employeeCount) : lead.companySize,
          rawData: {
            ...(lead.rawData as Record<string, unknown> ?? {}),
            clearbit: enrichment,
          } as never,
        },
      });
    }
  }

  // Verify email via Hunter
  if (lead.contactEmail) {
    const verification = await hunterService.verifyEmail(lead.contactEmail);
    if (verification) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          rawData: {
            ...(lead.rawData as Record<string, unknown> ?? {}),
            emailVerified: verification.valid,
          } as never,
        },
      });
    }
  }

  logger.info({ leadId }, 'Lead enrichment completed');
}

// ── AI Scoring Processor ─────────────────────

export async function processAiScoring(job: Job) {
  const { leadId } = job.data as { leadId: string };
  logger.info({ leadId }, 'AI scoring lead');

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  try {
    const { ChatOllama } = await import('@langchain/community/chat_models/ollama');
    const { ChatPromptTemplate } = await import('@langchain/core/prompts');
    const { StringOutputParser } = await import('@langchain/core/output_parsers');

    const model = new ChatOllama({
      model: process.env['OLLAMA_MODEL'] ?? 'gpt-oss:120b-cloud',
      baseUrl: process.env['OLLAMA_BASE_URL'] ?? 'http://ollama-host:11434',
      temperature: 0.2,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a lead scoring AI. Score this lead from 0-100 based on:
- Company size fit (0-25)
- Industry relevance (0-25)
- Budget potential (0-25)
- Engagement signals (0-25)
Return ONLY valid JSON: { "score": number, "breakdown": { "companyFit": number, "industryRelevance": number, "budgetPotential": number, "engagementSignals": number }, "reasoning": "brief explanation" }`,
      ],
      [
        'human',
        `Company: {company}
Industry: {industry}
Employees: {employees}
Revenue: {revenue}
Title: {title}
Source: {source}`,
      ],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    const result = await chain.invoke({
      company: lead.companyName,
      industry: lead.industry ?? 'Unknown',
      employees: lead.companySize ?? 'Unknown',
      revenue: 'Unknown',
      title: lead.contactName ?? 'Unknown',
      source: lead.source ?? 'Unknown',
    });

    // Parse the score
    const parsed = JSON.parse(result) as { score: number; breakdown: Record<string, number>; reasoning: string };

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        aiScore: parsed.score,
        scoreBreakdown: parsed as never,
        status: parsed.score >= 60 ? 'APPROVED' : 'PENDING_REVIEW',
      },
    });

    logger.info({ leadId, score: parsed.score }, 'Lead scored successfully');
  } catch (error) {
    logger.error({ error, leadId }, 'AI scoring failed');
    throw error;
  }
}

// ── Transcription Processor ──────────────────

export async function processTranscription(job: Job) {
  const { callId, recordingUrl } = job.data as { callId: string; recordingUrl: string };
  logger.info({ callId }, 'Processing transcription');

  try {
    // Step 1: Transcribe audio
    const transcriptionResult = await transcriptionService.transcribe(recordingUrl);

    // Step 2: AI Summary
    const summary = await transcriptionService.summarize(transcriptionResult.text);

    // Step 3: Update the discovery call record
    await prisma.discoveryCall.update({
      where: { id: callId },
      data: {
        transcript: transcriptionResult.text,
        aiSummary: summary.summary,
        keyInsights: summary.keyInsights,
        duration: transcriptionResult.duration,
        status: 'COMPLETED',
      },
    });

    logger.info({ callId, duration: transcriptionResult.duration }, 'Transcription completed');
  } catch (error) {
    logger.error({ error, callId }, 'Transcription failed');
    await prisma.discoveryCall.update({
      where: { id: callId },
      data: { status: 'FAILED' },
    });
    throw error;
  }
}

// ── Email Send Processor ─────────────────────

export async function processEmailSend(job: Job) {
  const { to, subject, body } = job.data as {
    pitchId?: string;
    to: string;
    subject: string;
    body: string;
    sendVia: string;
  };

  logger.info({ to, subject }, 'Sending email');

  await sendgridService.sendEmail({
    to,
    subject,
    html: body,
    text: body.replace(/<[^>]*>/g, ''),
  });
}

// ── Follow-Up Processor ──────────────────────

export async function processFollowUp(job: Job) {
  const { sequenceId, stepId, leadId } = job.data as {
    sequenceId: string;
    stepId: string;
    leadId: string;
  };

  logger.info({ sequenceId, stepId }, 'Processing follow-up step');

  const step = await prisma.followupStep.findUnique({ where: { id: stepId } });
  if (!step || step.status !== 'PENDING') return;

  const sequence = await prisma.followupSequence.findUnique({ where: { id: sequenceId } });
  if (!sequence || sequence.status !== 'ACTIVE') return;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead?.contactEmail) return;

  // Send the follow-up email
  await sendgridService.sendEmail({
    to: lead.contactEmail,
    subject: step.subject,
    html: step.body,
  });

  // Mark step as sent
  await prisma.followupStep.update({
    where: { id: stepId },
    data: { status: 'SENT', sentAt: new Date() },
  });

  // Queue next step if available
  const nextStep = await prisma.followupStep.findFirst({
    where: { sequenceId, status: 'PENDING', stepOrder: { gt: step.stepOrder } },
    orderBy: { stepOrder: 'asc' },
  });

  if (nextStep) {
    const { followUpQueue } = await import('../config/queue.js');
    await followUpQueue.add(
      'send-followup-step',
      { sequenceId, stepId: nextStep.id, leadId },
      { delay: nextStep.delayDays * 24 * 60 * 60 * 1000 },
    );
  }

  logger.info({ sequenceId, stepId, stepOrder: step.stepOrder }, 'Follow-up step sent');
}

// ── SLA Check Processor ──────────────────────

export async function processSlaCheck(_job: Job) {
  logger.info('Running SLA breach check');

  const slaConfigs = await prisma.stageSlaConfig.findMany();
  const pipelines = await prisma.onboardingPipeline.findMany({
    where: { currentStage: { not: 'COMPLETED' } },
    include: { client: true },
  });

  let breachCount = 0;

  for (const pipeline of pipelines) {
    const sla = slaConfigs.find((s) => s.stage === pipeline.currentStage);
    if (!sla) continue;

    const hoursInStage =
      (Date.now() - new Date(pipeline.stageEnteredAt).getTime()) / (1000 * 60 * 60);

    if (hoursInStage > sla.maxHours && !pipeline.slaBreached) {
      await prisma.onboardingPipeline.update({
        where: { id: pipeline.id },
        data: { slaBreached: true },
      });

      // Notify via Telegram
      await telegramService.sendSlaAlert(
        pipeline.client.companyName,
        pipeline.currentStage,
        Math.floor(hoursInStage / 24),
      );

      // Create notification
      if (pipeline.client.accountManagerId) {
        await prisma.notification.create({
          data: {
            userId: pipeline.client.accountManagerId,
            type: 'SLA_BREACH',
            title: `SLA Breach: ${pipeline.client.companyName}`,
            message: `Client stuck in ${pipeline.currentStage} for ${Math.floor(hoursInStage / 24)} days`,
            entityType: 'Client',
            entityId: pipeline.client.id,
          },
        });
      }

      breachCount++;
    }
  }

  logger.info({ breachCount }, 'SLA check completed');
}

// ── Notification Processor ───────────────────

export async function processNotification(job: Job) {
  const data = job.data as Record<string, unknown>;

  switch (job.name) {
    case 'telegram-send':
      await telegramService.sendMessage(
        data['chatId'] as string,
        data['message'] as string,
      );
      break;

    case 'nps-alert': {
      const chatId = process.env['TELEGRAM_ALERTS_CHAT_ID'];
      if (chatId) {
        await telegramService.sendMessage(
          chatId,
          `⚠️ NPS Detractor Alert\nClient: ${data['clientId']}\nScore: ${data['score']}\nFeedback: ${data['feedback'] ?? 'None'}`,
        );
      }
      break;
    }

    default:
      logger.warn({ jobName: job.name }, 'Unknown notification job type');
  }
}
