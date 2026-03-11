/**
 * Clearbit Enrichment Service
 *
 * Company and person enrichment via Clearbit API.
 */

import { logger } from '../config/logger.js';
import { createFetchClient } from '../utils/fetch-client.js';

const clearbitClient = createFetchClient('https://company.clearbit.com');

export interface CompanyEnrichment {
  name: string;
  domain: string;
  industry: string;
  employeeCount: number;
  annualRevenue: number;
  description: string;
  location: string;
  techStack: string[];
}

export const clearbitService = {
  /**
   * Enrich a company by domain.
   */
  async enrichCompany(domain: string): Promise<CompanyEnrichment | null> {
    const apiKey = process.env['CLEARBIT_API_KEY'];
    if (!apiKey) {
      logger.warn('CLEARBIT_API_KEY not configured — skipping enrichment');
      return null;
    }

    try {
      const response = await fetch(
        `https://company.clearbit.com/v2/companies/find?domain=${encodeURIComponent(domain)}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Clearbit API error: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, unknown>;

      return {
        name: (data['name'] as string) ?? '',
        domain: (data['domain'] as string) ?? domain,
        industry: ((data['category'] as Record<string, unknown>)?.['industry'] as string) ?? '',
        employeeCount: (data['metrics'] as Record<string, unknown>)?.['employees'] as number ?? 0,
        annualRevenue: (data['metrics'] as Record<string, unknown>)?.['annualRevenue'] as number ?? 0,
        description: (data['description'] as string) ?? '',
        location: (data['location'] as string) ?? '',
        techStack: ((data['tech'] as string[]) ?? []),
      };
    } catch (error) {
      logger.error({ error, domain }, 'Clearbit enrichment failed');
      return null;
    }
  },
};
