/**
 * Apollo.io Service
 *
 * Lead prospecting and enrichment via Apollo.io API.
 */

import { logger } from '../config/logger.js';

const APOLLO_API = 'https://api.apollo.io/v1';

export interface ApolloLead {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  company: string;
  industry: string;
  employeeCount: number;
  linkedinUrl: string;
}

export const apolloService = {
  /**
   * Search for leads matching given criteria.
   */
  async searchPeople(filters: {
    titles?: string[];
    industries?: string[];
    employeeRanges?: string[];
    locations?: string[];
    limit?: number;
  }): Promise<ApolloLead[]> {
    const apiKey = process.env['APOLLO_API_KEY'];
    if (!apiKey) {
      logger.warn('APOLLO_API_KEY not configured — skipping Apollo search');
      return [];
    }

    try {
      const response = await fetch(`${APOLLO_API}/mixed_people/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          api_key: apiKey,
          person_titles: filters.titles,
          person_locations: filters.locations,
          organization_industry_tag_ids: filters.industries,
          organization_num_employees_ranges: filters.employeeRanges,
          per_page: filters.limit ?? 25,
        }),
      });

      if (!response.ok) throw new Error(`Apollo API error: ${response.status}`);

      const data = (await response.json()) as {
        people: Array<{
          first_name: string;
          last_name: string;
          email: string;
          title: string;
          organization_name: string;
          organization: { industry: string; estimated_num_employees: number };
          linkedin_url: string;
        }>;
      };

      return (data.people ?? []).map((p) => ({
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email,
        title: p.title,
        company: p.organization_name,
        industry: p.organization?.industry ?? '',
        employeeCount: p.organization?.estimated_num_employees ?? 0,
        linkedinUrl: p.linkedin_url,
      }));
    } catch (error) {
      logger.error({ error }, 'Apollo people search failed');
      return [];
    }
  },
};
