/**
 * Agent Service — Agent Management & Monitoring
 *
 * Provides CRUD for agent configuration, activity logs,
 * event history, and manual agent triggering.
 */

import { prisma } from '../../config/db.js';
import { agentTaskQueue } from '../../config/queue.js';
import { eventBus } from '../../services/event-bus.service.js';
import { NotFoundError } from '../../utils/api-error.js';

// ── Types ──────────────────────────────────────

export interface AgentStatusSummary {
  agentName: string;
  enabled: boolean;
  schedule: string | null;
  lastRunAt: Date | null;
  lastStatus: string | null;
  runCount: number;
}

// ── Service ────────────────────────────────────

export const agentService = {
  // ── Status ─────────────────────────────────

  /** Get status of all agents */
  async getAllStatus(): Promise<AgentStatusSummary[]> {
    const configs = await prisma.agentConfig.findMany({
      select: {
        agentName: true,
        enabled: true,
        schedule: true,
        lastRunAt: true,
        lastStatus: true,
        runCount: true,
      },
      orderBy: { agentName: 'asc' },
    });

    return configs;
  },

  // ── Activity Logs ──────────────────────────

  /** Get agent activity logs with filtering */
  async getActivity(options: {
    agentType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const { agentType, status, limit = 50, offset = 0 } = options;

    const where: Record<string, unknown> = {};
    if (agentType) where['agentType'] = agentType;
    if (status) where['status'] = status;

    const [logs, total] = await Promise.all([
      prisma.agentLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.agentLog.count({ where }),
    ]);

    return { logs, total, limit, offset };
  },

  // ── Config ─────────────────────────────────

  /** Get all agent configs */
  async getAllConfigs() {
    return prisma.agentConfig.findMany({
      orderBy: { agentName: 'asc' },
    });
  },

  /** Get single agent config */
  async getConfig(agentName: string) {
    const config = await prisma.agentConfig.findUnique({
      where: { agentName },
    });

    if (!config) {
      throw new NotFoundError(`Agent config not found: ${agentName}`);
    }

    return config;
  },

  /** Update agent config (enable/disable, change schedule, etc.) */
  async updateConfig(
    agentName: string,
    updates: {
      enabled?: boolean;
      schedule?: string;
      config?: Record<string, unknown>;
    },
  ) {
    // Ensure the agent exists
    const existing = await prisma.agentConfig.findUnique({
      where: { agentName },
    });

    if (!existing) {
      throw new NotFoundError(`Agent config not found: ${agentName}`);
    }

    return prisma.agentConfig.update({
      where: { agentName },
      data: {
        ...(updates.enabled !== undefined && { enabled: updates.enabled }),
        ...(updates.schedule !== undefined && { schedule: updates.schedule }),
        ...(updates.config !== undefined && { config: updates.config }),
      },
    });
  },

  // ── Trigger ────────────────────────────────

  /** Manually trigger an agent to run a specific task */
  async triggerAgent(agentName: string, task?: string) {
    // Verify agent config exists
    const config = await prisma.agentConfig.findUnique({
      where: { agentName },
    });

    if (!config) {
      throw new NotFoundError(`Agent config not found: ${agentName}`);
    }

    if (!config.enabled) {
      return { triggered: false, reason: 'Agent is disabled' };
    }

    // Queue the agent task
    const job = await agentTaskQueue.add(`manual-${agentName}`, {
      agentType: agentName,
      task: task ?? 'default',
      manual: true,
    });

    return {
      triggered: true,
      jobId: job.id,
      agentName,
      task: task ?? 'default',
    };
  },

  // ── Events ─────────────────────────────────

  /** Get recent events from the event bus */
  async getRecentEvents(limit = 50) {
    return eventBus.getAllRecentEvents(limit);
  },
};
