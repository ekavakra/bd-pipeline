/**
 * Notification Agent
 *
 * Routes notifications to appropriate channels (Telegram, in-app).
 * Subscribes to key events and sends alerts when human attention is needed.
 *
 * Capabilities:
 * - Send Telegram notifications for urgent events
 * - Create in-app notifications
 * - Format messages for each channel
 */

import { BaseAgent, type AgentTask, type AgentResult } from './base.agent.js';
import { EVENTS } from '../services/event-bus.service.js';
import { prisma } from '../config/db.js';
import { notificationQueue } from '../config/queue.js';

class NotificationAgent extends BaseAgent {
  constructor() {
    super('notify');
  }

  async initialize(): Promise<void> {
    // ── High-Priority Events → Telegram ──────
    this.subscribeToEvent(EVENTS.SLA_BREACH, async (event) => {
      await this.sendNotification({
        type: 'SLA_ALERT',
        title: 'SLA Breach Detected',
        body: `Client pipeline SLA breached: ${event.payload['clientName'] ?? 'Unknown'}`,
        referenceType: 'client',
        referenceId: event.payload['clientId'] as string,
        urgent: true,
      });
    });

    this.subscribeToEvent(EVENTS.CHURN_DETECTED, async (event) => {
      await this.sendNotification({
        type: 'SLA_ALERT',
        title: 'Churn Risk Detected',
        body: `High churn risk for: ${event.payload['clientName'] ?? 'Unknown'} (score: ${event.payload['score']})`,
        referenceType: 'client',
        referenceId: event.payload['clientId'] as string,
        urgent: true,
      });
    });

    this.subscribeToEvent(EVENTS.NPS_DETRACTOR, async (event) => {
      await this.sendNotification({
        type: 'SLA_ALERT',
        title: 'NPS Detractor Alert',
        body: `Client gave NPS score ${event.payload['score']}/10: "${event.payload['feedback'] ?? 'No feedback'}"`,
        referenceType: 'client',
        referenceId: event.payload['clientId'] as string,
        urgent: true,
      });
    });

    // ── Informational Events → In-App ────────
    this.subscribeToEvent(EVENTS.LEAD_QUALIFIED, async (event) => {
      await this.sendNotification({
        type: 'NEW_LEAD',
        title: 'New Lead Qualified',
        body: `${event.payload['companyName']} auto-qualified (score: ${event.payload['score']})`,
        referenceType: 'lead',
        referenceId: event.payload['leadId'] as string,
        urgent: false,
      });
    });

    this.subscribeToEvent(EVENTS.STAGE_ADVANCED, async (event) => {
      await this.sendNotification({
        type: 'STAGE_CHANGE',
        title: 'Stage Advanced',
        body: `Client moved to ${event.payload['toStage']}`,
        referenceType: 'client',
        referenceId: event.payload['clientId'] as string,
        urgent: false,
      });
    });

    this.subscribeToEvent(EVENTS.UPSELL_DETECTED, async (event) => {
      await this.sendNotification({
        type: 'UPSELL_SIGNAL',
        title: 'Upsell Opportunity',
        body: `Upsell potential for ${event.payload['clientName'] ?? 'client'} (score: ${event.payload['score']})`,
        referenceType: 'client',
        referenceId: event.payload['clientId'] as string,
        urgent: false,
      });
    });

    this.logger.info('Notification Agent initialized');
  }

  async executeTask(task: AgentTask): Promise<AgentResult> {
    try {
      switch (task.type) {
        case 'send': {
          await this.sendNotification(task.payload as unknown as NotificationPayload);
          return { success: true };
        }
        default:
          return { success: false, error: `Unknown task type: ${task.type}` };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err }, 'Notification task failed');
      return { success: false, error };
    }
  }

  async runScheduledTask(_config: Record<string, unknown>): Promise<AgentResult> {
    // Notification agent doesn't have scheduled tasks — it's event-driven
    return { success: true, data: { message: 'No-op: notification agent is event-driven' } };
  }

  // ── Internal ─────────────────────────────

  private async sendNotification(payload: NotificationPayload) {
    try {
      // Get all admin/manager users to notify
      const users = await prisma.user.findMany({
        where: { isActive: true, role: { in: ['ADMIN', 'BD_MANAGER', 'ONBOARDING_MANAGER'] } },
        select: { id: true, telegramChatId: true },
      });

      // Create in-app notification for all users
      await prisma.notification.createMany({
        data: users.map((u: { id: string; telegramChatId: string | null }) => ({
          userId: u.id,
          type: payload.type as never,
          title: payload.title,
          body: payload.body,
          referenceType: payload.referenceType,
          referenceId: payload.referenceId,
          channel: 'IN_APP' as const,
        })),
      });

      // For urgent notifications, also send via Telegram
      if (payload.urgent) {
        const telegramUsers = users.filter((u: { id: string; telegramChatId: string | null }) => u.telegramChatId);
        for (const user of telegramUsers) {
          await notificationQueue.add('telegram-send', {
            chatId: user.telegramChatId,
            message: `⚠️ ${payload.title}\n\n${payload.body}`,
          });
        }
      }

      await this.logAction(
        'send_notification',
        payload.referenceType ?? 'system',
        payload.referenceId ?? 'n/a',
        'success',
        `Sent ${payload.urgent ? 'urgent' : 'info'} notification: ${payload.title}`,
        { type: payload.type, userCount: users.length },
      );
    } catch (err) {
      this.logger.error({ err, payload }, 'Failed to send notification');
      await this.logAction(
        'send_notification',
        payload.referenceType ?? 'system',
        payload.referenceId ?? 'n/a',
        'failed',
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }
}

interface NotificationPayload {
  type: string;
  title: string;
  body: string;
  referenceType?: string;
  referenceId?: string;
  urgent?: boolean;
}

export const notificationAgent = new NotificationAgent();
