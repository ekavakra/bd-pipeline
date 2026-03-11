/**
 * Hunter.io Service
 *
 * Email finding and verification via Hunter.io API.
 */

import { logger } from '../config/logger.js';

const HUNTER_API = 'https://api.hunter.io/v2';

export interface EmailResult {
  email: string;
  confidence: number;
  firstName: string;
  lastName: string;
  position: string;
}

export const hunterService = {
  /**
   * Find email addresses for a domain.
   */
  async domainSearch(domain: string): Promise<EmailResult[]> {
    const apiKey = process.env['HUNTER_API_KEY'];
    if (!apiKey) {
      logger.warn('HUNTER_API_KEY not configured — skipping email search');
      return [];
    }

    try {
      const url = `${HUNTER_API}/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error(`Hunter API error: ${response.status}`);

      const data = (await response.json()) as {
        data: { emails: Array<{
          value: string;
          confidence: number;
          first_name: string;
          last_name: string;
          position: string;
        }> };
      };

      return (data.data.emails ?? []).map((e) => ({
        email: e.value,
        confidence: e.confidence,
        firstName: e.first_name,
        lastName: e.last_name,
        position: e.position,
      }));
    } catch (error) {
      logger.error({ error, domain }, 'Hunter domain search failed');
      return [];
    }
  },

  /**
   * Verify an email address.
   */
  async verifyEmail(email: string): Promise<{ valid: boolean; score: number } | null> {
    const apiKey = process.env['HUNTER_API_KEY'];
    if (!apiKey) return null;

    try {
      const url = `${HUNTER_API}/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error(`Hunter API error: ${response.status}`);

      const data = (await response.json()) as {
        data: { result: string; score: number };
      };

      return {
        valid: data.data.result === 'deliverable',
        score: data.data.score,
      };
    } catch (error) {
      logger.error({ error, email }, 'Hunter email verification failed');
      return null;
    }
  },
};
