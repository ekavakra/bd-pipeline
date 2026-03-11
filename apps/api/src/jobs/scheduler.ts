/**
 * Agent Scheduler
 *
 * Registers all agent schedules as BullMQ repeatable jobs.
 * Called once during application startup.
 */

import { agentSchedules } from '../config/agent-schedule.js';
import { agentScheduleQueue } from '../config/queue.js';
import { logger } from '../config/logger.js';

/**
 * Register all enabled agent schedules as BullMQ repeatable jobs.
 */
export async function registerAgentSchedules(): Promise<void> {
  for (const [name, config] of Object.entries(agentSchedules)) {
    if (!config.enabled) {
      logger.debug({ name }, 'Skipping disabled agent schedule');
      continue;
    }

    await agentScheduleQueue.add(
      `schedule:${name}`,
      { agentName: config.agent, config: config.config },
      {
        repeat: {
          pattern: config.schedule,
        },
      },
    );

    logger.info({ name, schedule: config.schedule, agent: config.agent }, 'Registered agent schedule');
  }
}
