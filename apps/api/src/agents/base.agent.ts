/**
 * Base Agent — Abstract Foundation for All Agents
 *
 * Provides common functionality: logging, event publishing, decision making,
 * context management. All specialized agents extend this class.
 */

import { eventBus, type EventData } from '../services/event-bus.service.js';
import { agentLogService, type CreateAgentLogParams } from '../services/agent-log.service.js';
import { agentPlannerService } from '../services/agent-planner.service.js';
import { logger } from '../config/logger.js';

// ── Types ────────────────────────────────────

export interface AgentTask {
  id: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ── Base Agent ───────────────────────────────

export abstract class BaseAgent {
  protected name: string;
  protected logger: typeof logger;

  constructor(name: string) {
    this.name = name;
    this.logger = logger.child({ agent: name });
  }

  /**
   * Initialize the agent — subscribe to events, set up state.
   * Called once during application startup.
   */
  abstract initialize(): Promise<void>;

  /**
   * Execute a specific task dispatched by the job queue.
   */
  abstract executeTask(task: AgentTask): Promise<AgentResult>;

  /**
   * Run the agent's scheduled task (called by cron/repeatable job).
   */
  abstract runScheduledTask(config: Record<string, unknown>): Promise<AgentResult>;

  // ── Shared Functionality ─────────────────

  /**
   * Log an agent action to the database.
   */
  protected async logAction(
    action: string,
    targetType: string,
    targetId: string,
    status: 'success' | 'failed' | 'pending_approval',
    reasoning?: string,
    details?: Record<string, unknown>,
  ) {
    return agentLogService.log({
      agentType: this.name,
      action,
      targetType,
      targetId,
      status,
      reasoning,
      details,
    });
  }

  /**
   * Ask the LLM planner to decide the next action.
   */
  protected async decide(context: string, availableActions: string[]) {
    return agentPlannerService.decide(context, availableActions);
  }

  /**
   * Publish an event via the event bus.
   */
  protected async publishEvent(event: string, data: Record<string, unknown>) {
    return eventBus.publish(event, data, this.name);
  }

  /**
   * Subscribe to an event via the event bus.
   */
  protected subscribeToEvent(event: string, handler: (data: EventData) => Promise<void>) {
    eventBus.subscribe(event, handler);
  }
}
