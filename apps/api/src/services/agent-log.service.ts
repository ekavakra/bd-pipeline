/**
 * Agent Log Service — Persistent Action Logging
 *
 * Records all autonomous agent actions in the database for auditing,
 * debugging, and context recall. Every agent action (discovery, scoring,
 * stage advancement, etc.) gets logged with reasoning and outcome.
 */

import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

// ── Types ────────────────────────────────────

export interface CreateAgentLogParams {
  agentType: string;
  action: string;
  targetType?: string;
  targetId?: string;
  status: 'success' | 'failed' | 'pending_approval';
  reasoning?: string;
  details?: Record<string, unknown>;
}

export interface AgentLogFilters {
  agentType?: string;
  status?: string;
  limit?: number;
  offset?: number;
  since?: Date;
}

// ── Service ──────────────────────────────────

class AgentLogService {
  /**
   * Log an agent action to the database.
   */
  async log(params: CreateAgentLogParams) {
    try {
      const entry = await prisma.agentLog.create({
        data: {
          agentType: params.agentType,
          action: params.action,
          targetType: params.targetType,
          targetId: params.targetId,
          status: params.status,
          reasoning: params.reasoning,
          details: params.details as never,
        },
      });

      logger.debug(
        { agentType: params.agentType, action: params.action, status: params.status },
        'Agent action logged',
      );

      return entry;
    } catch (err) {
      logger.error({ err, params }, 'Failed to log agent action');
      throw err;
    }
  }

  /**
   * Query agent logs with filtering and pagination.
   */
  async getLogs(filters: AgentLogFilters) {
    return prisma.agentLog.findMany({
      where: {
        ...(filters.agentType && { agentType: filters.agentType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.since && { createdAt: { gte: filters.since } }),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    });
  }

  /**
   * Get counts of agent actions by status.
   */
  async getStats(agentType?: string) {
    const where = agentType ? { agentType } : {};
    const [total, success, failed, pending] = await Promise.all([
      prisma.agentLog.count({ where }),
      prisma.agentLog.count({ where: { ...where, status: 'success' } }),
      prisma.agentLog.count({ where: { ...where, status: 'failed' } }),
      prisma.agentLog.count({ where: { ...where, status: 'pending_approval' } }),
    ]);

    return { total, success, failed, pending };
  }

  /**
   * Get the last log entry for a specific agent type.
   */
  async getLastAction(agentType: string) {
    return prisma.agentLog.findFirst({
      where: { agentType },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const agentLogService = new AgentLogService();
