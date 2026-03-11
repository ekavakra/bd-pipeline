/**
 * BullMQ Worker Entry Point
 *
 * Runs as a separate process from the API server.
 * Processes all background jobs: lead search, AI scoring, transcription,
 * email sending, follow-ups, SLA checks, and notifications.
 *
 * Start: pnpm --filter @bd-pipeline/api worker
 */

import { Worker } from 'bullmq';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { redis } from './config/redis.js';
import { registerRepeatableJobs } from './config/queue.js';
import {
  processLeadSearch,
  processLeadEnrich,
  processAiScoring,
  processTranscription,
  processEmailSend,
  processFollowUp,
  processSlaCheck,
  processNotification,
} from './jobs/processors.js';

const connection = redis;

// ── Lead Search Worker ───────────────────────

const leadSearchWorker = new Worker(
  'lead-search',
  async (job) => {
    switch (job.name) {
      case 'lead-search':
        return processLeadSearch(job);
      case 'lead-enrich':
        return processLeadEnrich(job);
      default:
        logger.warn({ queue: 'lead-search', jobName: job.name }, 'Unknown job');
    }
  },
  { connection, concurrency: 3 },
);

// ── AI Scoring Worker ────────────────────────

const aiScoringWorker = new Worker(
  'ai-scoring',
  async (job) => processAiScoring(job),
  { connection, concurrency: 2 },
);

// ── Transcription Worker ─────────────────────

const transcriptionWorker = new Worker(
  'transcription',
  async (job) => processTranscription(job),
  { connection, concurrency: 1 },
);

// ── Email Send Worker ────────────────────────

const emailSendWorker = new Worker(
  'email-send',
  async (job) => processEmailSend(job),
  { connection, concurrency: 5 },
);

// ── Follow-Up Worker ─────────────────────────

const followUpWorker = new Worker(
  'follow-up',
  async (job) => processFollowUp(job),
  { connection, concurrency: 3 },
);

// ── SLA Check Worker ─────────────────────────

const slaCheckWorker = new Worker(
  'sla-check',
  async (job) => processSlaCheck(job),
  { connection, concurrency: 1 },
);

// ── Notification Worker ──────────────────────

const notificationWorker = new Worker(
  'notification',
  async (job) => processNotification(job),
  { connection, concurrency: 5 },
);

// ── Worker Error Handling ────────────────────

const workers = [
  leadSearchWorker,
  aiScoringWorker,
  transcriptionWorker,
  emailSendWorker,
  followUpWorker,
  slaCheckWorker,
  notificationWorker,
];

for (const worker of workers) {
  worker.on('failed', (job, error) => {
    logger.error(
      { queue: worker.name, jobId: job?.id, jobName: job?.name, error },
      'Job failed',
    );
  });

  worker.on('completed', (job) => {
    logger.debug({ queue: worker.name, jobId: job.id, jobName: job.name }, 'Job completed');
  });
}

// ── Startup ──────────────────────────────────

async function start() {
  await registerRepeatableJobs();
  logger.info({ workerCount: workers.length }, 'BullMQ workers started');
}

start().catch((error) => {
  logger.fatal({ error }, 'Worker startup failed');
  process.exit(1);
});

// ── Graceful Shutdown ────────────────────────

async function shutdown() {
  logger.info('Shutting down workers...');
  await Promise.all(workers.map((w) => w.close()));
  logger.info('All workers stopped');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
