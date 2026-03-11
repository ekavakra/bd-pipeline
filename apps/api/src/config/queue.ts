/**
 * BullMQ Queue Configuration
 *
 * Defines all job queues used across the application.
 * Each queue maps to a specific async operation.
 *
 * Queues:
 * - lead-search: Autonomous lead discovery jobs
 * - ai-scoring: AI lead scoring pipeline
 * - follow-up: Automated follow-up sequence execution
 * - sla-check: SLA monitoring (repeatable, every 4 hours)
 * - transcription: Call recording transcription
 * - email-send: Email delivery via SendGrid
 * - notification: In-app + Telegram notification dispatch
 */

import { Queue } from 'bullmq';
import { redis } from './redis.js';
import { logger } from './logger.js';

/** Default queue options shared across all queues */
const defaultOpts = {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },  // Keep last 1000 completed jobs
    removeOnFail: { count: 5000 },      // Keep last 5000 failed jobs for debugging
    attempts: 3,                         // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential' as const,
      delay: 2000,                       // Start with 2s, then 4s, then 8s
    },
  },
};

// ── Queue Definitions ────────────────────────

export const leadSearchQueue = new Queue('lead-search', defaultOpts);
export const aiScoringQueue = new Queue('ai-scoring', defaultOpts);
export const followUpQueue = new Queue('follow-up', defaultOpts);
export const slaCheckQueue = new Queue('sla-check', defaultOpts);
export const transcriptionQueue = new Queue('transcription', defaultOpts);
export const emailSendQueue = new Queue('email-send', defaultOpts);
export const notificationQueue = new Queue('notification', defaultOpts);
export const agentTaskQueue = new Queue('agent-task', defaultOpts);
export const agentScheduleQueue = new Queue('agent-schedule', defaultOpts);

/**
 * Register repeatable jobs (cron-style tasks)
 * Called once on application startup.
 */
export async function registerRepeatableJobs(): Promise<void> {
  // SLA check — runs every 4 hours
  await slaCheckQueue.add(
    'sla-check-cron',
    {},
    {
      repeat: {
        every: 4 * 60 * 60 * 1000, // 4 hours in milliseconds
      },
    },
  );
  logger.info('Registered repeatable job: sla-check (every 4 hours)');

  // Follow-up sequence processor — runs every 15 minutes
  await followUpQueue.add(
    'followup-processor',
    {},
    {
      repeat: {
        every: 15 * 60 * 1000, // 15 minutes
      },
    },
  );
  logger.info('Registered repeatable job: follow-up processor (every 15 minutes)');
}

/** All queues for health check / cleanup */
export const allQueues = [
  leadSearchQueue,
  aiScoringQueue,
  followUpQueue,
  slaCheckQueue,
  transcriptionQueue,
  emailSendQueue,
  notificationQueue,
  agentTaskQueue,
  agentScheduleQueue,
];
