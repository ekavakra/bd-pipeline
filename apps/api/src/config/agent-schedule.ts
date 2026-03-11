/**
 * Agent Schedule Configuration
 *
 * Defines the cron schedules for all autonomous agents.
 * Each agent runs on its own schedule via BullMQ repeatable jobs.
 */

export const agentSchedules = {
  // ── Phase 1 Agents ─────────────────────────

  /** Lead Discovery — runs every hour, searches for new leads */
  'lead-discovery': {
    enabled: true,
    schedule: '0 * * * *',           // Every hour at minute 0
    agent: 'lead-discovery',
    config: {
      batchSize: 10,
      minScore: 30,
    },
  },

  /** Lead Enrichment — runs every 30 min, enriches un-enriched leads */
  'lead-enrichment': {
    enabled: true,
    schedule: '*/30 * * * *',        // Every 30 minutes
    agent: 'lead-enrichment',
    config: {
      batchSize: 20,
    },
  },

  // ── Phase 2 Agents ─────────────────────────

  /** SLA Check — runs every 4 hours, detects SLA breaches */
  'sla-check': {
    enabled: true,
    schedule: '0 */4 * * *',         // Every 4 hours
    agent: 'sla',
    config: {},
  },

  /** Meeting Reminders — runs every hour, sends upcoming meeting alerts */
  'meeting-reminders': {
    enabled: true,
    schedule: '0 * * * *',           // Every hour
    agent: 'meeting',
    config: {
      reminderHours: [24, 1],
    },
  },

  // ── Phase 3 Agents ─────────────────────────

  /** Health Check — runs daily at 6am, calculates churn/upsell scores */
  'health-check': {
    enabled: true,
    schedule: '0 6 * * *',           // Daily at 6am
    agent: 'health',
    config: {
      riskThreshold: 70,
    },
  },

  /** NPS Survey — runs weekly on Monday at 9am */
  'nps-survey': {
    enabled: true,
    schedule: '0 9 * * 1',           // Monday 9am
    agent: 'nps',
    config: {
      daysAfterOnboarding: 7,
    },
  },

  /** Upsell Detection — runs daily at 6am */
  'upsell-detection': {
    enabled: true,
    schedule: '0 6 * * *',           // Daily at 6am
    agent: 'upsell',
    config: {
      threshold: 60,
    },
  },
} as const;

export type AgentScheduleName = keyof typeof agentSchedules;
