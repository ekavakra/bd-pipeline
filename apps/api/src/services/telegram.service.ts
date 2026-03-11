/**
 * Telegram Bot Service
 *
 * Sends notifications and alerts to Telegram channels/chats.
 */

import { logger } from '../config/logger.js';

const TELEGRAM_API = 'https://api.telegram.org';

export const telegramService = {
  /**
   * Send a message to a Telegram chat.
   */
  async sendMessage(chatId: string, text: string, parseMode: string = 'HTML'): Promise<void> {
    const botToken = process.env['TELEGRAM_BOT_TOKEN'];
    if (!botToken) {
      logger.warn('TELEGRAM_BOT_TOKEN not configured — skipping Telegram send');
      return;
    }

    try {
      const response = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Telegram API error: ${response.status} — ${body}`);
      }

      logger.info({ chatId }, 'Telegram message sent');
    } catch (error) {
      logger.error({ error, chatId }, 'Failed to send Telegram message');
      throw error;
    }
  },

  /**
   * Send an SLA breach alert to the configured alerts channel.
   */
  async sendSlaAlert(clientName: string, stage: string, daysOverdue: number): Promise<void> {
    const chatId = process.env['TELEGRAM_ALERTS_CHAT_ID'];
    if (!chatId) return;

    const message = `
🚨 <b>SLA Breach Alert</b>

<b>Client:</b> ${clientName}
<b>Stage:</b> ${stage}
<b>Days Overdue:</b> ${daysOverdue}

Please review immediately.`;

    await this.sendMessage(chatId, message);
  },
};
