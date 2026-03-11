/**
 * SendGrid Email Service
 *
 * Handles transactional email sending via SendGrid API.
 * Uses native fetch (no axios dependency).
 */

import { logger } from '../config/logger.js';
import { createFetchClient } from '../utils/fetch-client.js';

const sendgridClient = createFetchClient('https://api.sendgrid.com');

interface SendEmailParams {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendgridService = {
  /**
   * Send a transactional email via SendGrid.
   */
  async sendEmail(params: SendEmailParams): Promise<void> {
    const apiKey = process.env['SENDGRID_API_KEY'];
    if (!apiKey) {
      logger.warn('SENDGRID_API_KEY not configured — skipping email send');
      return;
    }

    const fromEmail = params.from ?? process.env['SENDGRID_FROM_EMAIL'] ?? 'noreply@bd-pipeline.com';

    const payload = {
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: fromEmail },
      subject: params.subject,
      content: [
        ...(params.text ? [{ type: 'text/plain', value: params.text }] : []),
        { type: 'text/html', value: params.html },
      ],
    };

    try {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      logger.info({ to: params.to, subject: params.subject }, 'Email sent via SendGrid');
    } catch (error) {
      logger.error({ error, to: params.to }, 'Failed to send email via SendGrid');
      throw error;
    }
  },
};
