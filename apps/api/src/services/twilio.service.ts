/**
 * Twilio Service
 *
 * SMS and voice call integration via Twilio API.
 */

import { logger } from '../config/logger.js';

export const twilioService = {
  /**
   * Send an SMS via Twilio REST API.
   */
  async sendSms(to: string, body: string): Promise<void> {
    const accountSid = process.env['TWILIO_ACCOUNT_SID'];
    const authToken = process.env['TWILIO_AUTH_TOKEN'];
    const from = process.env['TWILIO_PHONE_NUMBER'];

    if (!accountSid || !authToken || !from) {
      logger.warn('Twilio credentials not configured — skipping SMS send');
      return;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      });

      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.status}`);
      }

      logger.info({ to }, 'SMS sent via Twilio');
    } catch (error) {
      logger.error({ error, to }, 'Failed to send SMS via Twilio');
      throw error;
    }
  },
};
