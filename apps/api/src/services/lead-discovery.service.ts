/**
 * Lead Discovery Service
 *
 * Real AI-powered multi-step lead discovery pipeline:
 *
 *  1. LLM query expansion: Turns a user's search criteria into 4-5 targeted
 *     search queries using Ollama.
 *
 *  2. Web search: Executes queries via Tavily → SerpAPI → SearXNG meta-search.
 *     SearXNG is ALWAYS available as a Docker sidecar — no API keys needed.
 *
 *  3. Website scraping: Actually visits each company URL found in search results,
 *     extracts real text content, emails, social links, and contact info.
 *
 *  4. LLM extraction: Uses Ollama to parse the REAL scraped website content and
 *     extract structured company + contact profiles.
 *
 *  5. Apollo enrichment: If Apollo API key is configured, enriches with B2B
 *     contacts data.
 *
 *  6. LLM fallback: ONLY when all real sources return zero usable results does
 *     the system fall back to AI-generated suggestions (tagged as such).
 *
 * The pipeline ALWAYS attempts real web search first. Fake data is the last resort.
 */

import { logger } from '../config/logger.js';
import { webSearchService, type WebSearchResult } from './web-search.service.js';
import { scraperService } from './scraper.service.js';
import { apolloService, type ApolloLead } from './apollo.service.js';

// ── Types ─────────────────────────────────────────────────

export interface SearchFilters {
  industry?: string;
  location?: string;
  companySize?: string;
  keywords?: string[];
  naturalQuery?: string;
  maxResults?: number;
  preferences?: { factor: string; label: string; weight: number }[];
}

export interface DiscoveredLead {
  companyName: string;
  website?: string;
  contactName?: string;
  contactEmail?: string;
  contactTitle?: string;
  contactLinkedin?: string;
  industry?: string;
  employeeCount?: number;
  location?: string;
  /** Why this lead was surfaced (for transparency) */
  discoveryReason?: string;
  discoverySource: 'apollo' | 'web_search' | 'ai_generated';
}

type EmitFn = (data: { step: string; progress: number; message: string }) => void;

// ── Ollama model helpers ──────────────────────────────────

function ollamaModel() {
  return (
    process.env['OLLAMA_PRIMARY_MODEL'] ??
    process.env['OLLAMA_MODEL'] ??
    'gpt-oss:120b-cloud'
  );
}

function ollamaUrl() {
  return process.env['OLLAMA_BASE_URL'] ?? process.env['OLLAMA_URL'] ?? 'http://ollama-host:11434';
}

async function ollamaChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(`${ollamaUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel(),
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
  const data = (await response.json()) as { message?: { content?: string } };
  return data.message?.content ?? '';
}

// ── Step 1: LLM query expansion ───────────────────────────

async function expandSearchQueries(filters: SearchFilters): Promise<string[]> {
  const parts: string[] = [];
  if (filters.naturalQuery) parts.push(`Natural language request: "${filters.naturalQuery}"`);
  if (filters.industry) parts.push(`Industry: ${filters.industry}`);
  if (filters.location) parts.push(`Location: ${filters.location}`);
  if (filters.companySize) parts.push(`Company size: ${filters.companySize} employees`);
  if (filters.keywords?.length) parts.push(`Keywords: ${filters.keywords.join(', ')}`);

  const systemPrompt = `You are a B2B lead generation expert. Your job is to create effective web search queries to find REAL company websites.
Return ONLY a valid JSON array of 5 targeted search query strings — nothing else.
Each query should target a slightly different angle to find actual company websites:
  - Company listing directories (clutch.co, g2.com, goodfirms.co)
  - Industry-specific directories
  - "top companies" or "best companies" lists on blogs/media
  - Direct company website searches
  - Professional review/rating sites

CRITICAL: Do NOT use site:linkedin.com, site:crunchbase.com, site:glassdoor.com, site:inc.com, site:forbes.com — these sites BLOCK web scraping.
INSTEAD, search for actual company websites that can be visited and scraped.
Example: ["top fintech startups New York 2025", "best SaaS companies NYC clutch.co", "fintech companies United States directory", "small fintech firms New York employees", "fintech B2B companies NY reviews"]`;

  const userPrompt = `Create 4 web search queries to find leads matching these criteria:\n${parts.join('\n')}`;

  try {
    const raw = await ollamaChat(systemPrompt, userPrompt);
    // Extract JSON array from the response (it may have surrounding text)
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return buildFallbackQueries(filters);
    const queries = JSON.parse(match[0]) as string[];
    return Array.isArray(queries) ? queries.slice(0, 5) : buildFallbackQueries(filters);
  } catch (err) {
    logger.warn({ err }, 'LLM query expansion failed, using fallback queries');
    return buildFallbackQueries(filters);
  }
}

function buildFallbackQueries(filters: SearchFilters): string[] {
  const base = [
    filters.naturalQuery,
    filters.industry,
    filters.location,
    filters.keywords?.join(' '),
  ]
    .filter(Boolean)
    .join(' ');

  return [
    `${base} companies`,
    `${base} B2B companies directory`,
    `top ${base} companies list 2025`,
    `${base} companies clutch.co OR g2.com`,
    `best ${base} startups`,
  ].filter((q) => q.trim().length > 5);
}

// ── Step 2: Web search + Apollo ───────────────────────────

async function runWebSearch(
  queries: string[],
  maxPerQuery: number,
): Promise<WebSearchResult[]> {
  const allResults: WebSearchResult[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    try {
      const results = await webSearchService.search(q, maxPerQuery);
      for (const r of results) {
        if (!seen.has(r.url)) {
          seen.add(r.url);
          allResults.push(r);
        }
      }
    } catch (err) {
      logger.warn({ err, query: q }, 'Web search query failed');
    }
  }

  return allResults;
}

async function runApolloSearch(filters: SearchFilters, limit: number): Promise<ApolloLead[]> {
  if (!process.env['APOLLO_API_KEY']) return [];
  try {
    return await apolloService.searchPeople({
      industries: filters.industry ? [filters.industry] : undefined,
      locations: filters.location ? [filters.location] : undefined,
      limit,
    });
  } catch (err) {
    logger.warn({ err }, 'Apollo search failed');
    return [];
  }
}

// ── Step 3: Scrape actual websites + LLM extraction ──────

/**
 * Scrape actual company websites found in search results, then use LLM
 * to extract structured lead profiles from the REAL page content.
 */
async function scrapeAndExtractLeads(
  webResults: WebSearchResult[],
  filters: SearchFilters,
  maxResults: number,
  emit: EmitFn,
): Promise<DiscoveredLead[]> {
  if (webResults.length === 0) return [];

  // Get unique domains/URLs to scrape (dedup by domain)
  const seenDomains = new Set<string>();
  const urlsToScrape: { url: string; searchTitle: string; searchSnippet: string }[] = [];

  for (const r of webResults) {
    try {
      const domain = new URL(r.url).hostname.replace('www.', '');
      if (seenDomains.has(domain)) continue;
      seenDomains.add(domain);
      if (scraperService.isScrapable(r.url)) {
        urlsToScrape.push({ url: r.url, searchTitle: r.title, searchSnippet: r.snippet });
      }
    } catch {
      // Invalid URL, skip
    }
  }

  if (urlsToScrape.length === 0) {
    // Fall back to old-style: extract from search snippets only
    return extractLeadsFromSnippets(webResults, filters, maxResults);
  }

  // Scrape actual pages (max 10 to avoid overloading)
  const toScrape = urlsToScrape.slice(0, 10);
  emit({
    step: 'scrape',
    progress: 50,
    message: `Scraping ${toScrape.length} company websites for real data…`,
  });

  let scrapeCompleted = 0;
  const scraped = await scraperService.scrapeMultiple(
    toScrape.map((u) => u.url),
    (completed, total) => {
      scrapeCompleted = completed;
      emit({
        step: 'scrape_progress',
        progress: 50 + Math.round((completed / total) * 15),
        message: `Scraped ${completed}/${total} websites…`,
      });
    },
  );

  emit({
    step: 'scrape_done',
    progress: 65,
    message: `Scraped ${scrapeCompleted} websites. AI analyzing real content…`,
  });

  // Build context for LLM — include REAL scraped content
  const companyContexts: string[] = [];
  for (const entry of toScrape) {
    const pageData = scraped.get(entry.url);
    if (!pageData || !pageData.mainPage.success) {
      // Still include the search snippet as fallback
      companyContexts.push(
        `[Company from search]\nSearch title: ${entry.searchTitle}\nURL: ${entry.url}\nSearch snippet: ${entry.searchSnippet}`,
      );
      continue;
    }

    const mp = pageData.mainPage;
    const parts = [
      `[Company Website — Scraped]`,
      `URL: ${entry.url}`,
      `Page title: ${mp.title}`,
      mp.description && `Description: ${mp.description}`,
      `Content: ${mp.content.slice(0, 1500)}`,
      mp.emails.length > 0 && `Emails found: ${mp.emails.join(', ')}`,
      mp.phones.length > 0 && `Phones found: ${mp.phones.join(', ')}`,
      mp.socials.linkedin && `LinkedIn: ${mp.socials.linkedin}`,
    ];

    // Add sub-page content (about/team pages)
    for (const sp of pageData.subPages) {
      parts.push(`\n--- ${sp.title || 'Sub-page'} ---\n${sp.content.slice(0, 800)}`);
      if (sp.emails.length > 0) parts.push(`Emails: ${sp.emails.join(', ')}`);
    }

    companyContexts.push(parts.filter(Boolean).join('\n'));
  }

  // LLM extraction from REAL scraped content
  const searchContext = [
    filters.naturalQuery && `Search request: "${filters.naturalQuery}"`,
    filters.industry && `Target industry: ${filters.industry}`,
    filters.location && `Target location: ${filters.location}`,
    filters.companySize && `Company size: ${filters.companySize}`,
    filters.keywords?.length && `Keywords: ${filters.keywords.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  const systemPrompt = `You are a B2B lead extraction AI. You receive REAL scraped website content from company pages.
Your job is to extract structured company/contact profiles from this real data.

Return ONLY a valid JSON array with up to ${maxResults} objects:
{
  "companyName": "real company name (required)",
  "website": "the company URL",
  "contactName": "real person name found on the website, or null",
  "contactEmail": "real email found on the website, or null",
  "contactTitle": "real job title found, or null",
  "contactLinkedin": "LinkedIn URL if found, or null",
  "industry": "industry based on the website content",
  "location": "location/HQ found on the website, or null",
  "discoveryReason": "1-2 sentences explaining why this company matches the search criteria, referencing real info from their website"
}

CRITICAL RULES:
- Only include companies that MATCH the search criteria
- Use ONLY information actually found in the scraped content — do NOT invent data
- Include contact email ONLY if it was actually found on the page
- Skip pages that are clearly directories, news articles, or non-company sites
- For each company, cite what you see on their website that makes them relevant`;

  const userPrompt = `Search criteria:\n${searchContext}\n\n${companyContexts.length} company websites scraped:\n\n${companyContexts.join('\n\n---\n\n')}\n\nExtract matching leads from the real website data:`;

  try {
    const raw = await ollamaChat(systemPrompt, userPrompt);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const extracted = JSON.parse(match[0]) as Partial<DiscoveredLead>[];
    return extracted
      .filter((e) => e.companyName)
      .map((e) => ({
        ...e,
        discoverySource: 'web_search' as const,
      })) as DiscoveredLead[];
  } catch (err) {
    logger.warn({ err }, 'LLM extraction from scraped content failed');
    // Fall back to snippet-based extraction
    return extractLeadsFromSnippets(webResults, filters, maxResults);
  }
}

/**
 * Fallback: Extract leads from search snippets (when scraping fails).
 * This is the old-style extraction that works on search result titles/snippets.
 */
async function extractLeadsFromSnippets(
  webResults: WebSearchResult[],
  filters: SearchFilters,
  maxResults: number,
): Promise<DiscoveredLead[]> {
  if (webResults.length === 0) return [];

  const formatted = webResults
    .slice(0, 20)
    .map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    Description: ${r.snippet.slice(0, 200)}`)
    .join('\n\n');

  const systemPrompt = `You are a B2B lead extraction AI. Extract company/contact leads from web search results.

Return ONLY a valid JSON array with up to ${maxResults} objects:
{
  "companyName": "string (required)",
  "website": "URL or null",
  "contactName": "string or null",
  "contactEmail": "email or null",
  "contactTitle": "job title or null",
  "industry": "string or null",
  "location": "city/country or null",
  "discoveryReason": "1 sentence why this company matches"
}

Rules:
- Only include real companies from the search results
- Extract contact info ONLY if explicitly mentioned
- Return [] if no suitable companies found`;

  const searchContext = [
    filters.naturalQuery && `Search request: "${filters.naturalQuery}"`,
    filters.industry && `Target industry: ${filters.industry}`,
    filters.location && `Target location: ${filters.location}`,
    filters.companySize && `Company size: ${filters.companySize}`,
    filters.keywords?.length && `Keywords: ${filters.keywords.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  const userPrompt = `Search criteria:\n${searchContext}\n\nWeb search results:\n${formatted}\n\nExtract matching companies:`;

  try {
    const raw = await ollamaChat(systemPrompt, userPrompt);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const extracted = JSON.parse(match[0]) as Partial<DiscoveredLead>[];
    return extracted
      .filter((e) => e.companyName)
      .map((e) => ({ ...e, discoverySource: 'web_search' as const })) as DiscoveredLead[];
  } catch (err) {
    logger.warn({ err }, 'LLM extraction from snippets failed');
    return [];
  }
}

// ── Step 4: LLM fallback generation ──────────────────────

async function generateLeadsWithLLM(
  filters: SearchFilters,
  maxResults: number,
): Promise<DiscoveredLead[]> {
  const parts: string[] = [];
  if (filters.naturalQuery) parts.push(`"${filters.naturalQuery}"`);
  if (filters.industry) parts.push(`industry: ${filters.industry}`);
  if (filters.location) parts.push(`location: ${filters.location}`);
  if (filters.companySize) parts.push(`size: ${filters.companySize} employees`);
  if (filters.keywords?.length) parts.push(`keywords: ${filters.keywords.join(', ')}`);

  const criteria = parts.join(', ') || 'general B2B companies';

  const systemPrompt = `You are a B2B sales intelligence AI. Generate realistic company prospect profiles for a sales team.
These are AI-generated suggestions to help salespeople identify where to look — they should be verified before outreach.

Return ONLY a valid JSON array of ${maxResults} company objects:
{
  "companyName": "realistic company name",
  "website": "plausible URL (e.g. https://company.com)",
  "contactName": "realistic person name or null",
  "contactTitle": "realistic senior title (e.g. CTO, VP Engineering) or null",
  "contactEmail": "null (do not invent emails)",
  "industry": "specific industry",
  "location": "city, country",
  "discoveryReason": "why this type of company would be a good fit"
}

Important: generate DIVERSE, REALISTIC company names and profiles matching the criteria.
Do NOT reuse the same company name.`;

  const userPrompt = `Generate ${maxResults} B2B lead prospects for: ${criteria}`;

  try {
    const raw = await ollamaChat(systemPrompt, userPrompt);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const generated = JSON.parse(match[0]) as Partial<DiscoveredLead>[];
    return generated
      .filter((e) => e.companyName)
      .map((e) => ({
        ...e,
        contactEmail: undefined, // never trust LLM-invented emails
        discoverySource: 'ai_generated' as const,
        discoveryReason: (e.discoveryReason ?? '') + ' [AI-generated — verify before outreach]',
      })) as DiscoveredLead[];
  } catch (err) {
    logger.error({ err }, 'LLM fallback lead generation failed');
    return [];
  }
}

// ── Public API ────────────────────────────────────────────

export const leadDiscoveryService = {
  /**
   * Run the full AI-powered discovery pipeline, emitting progress events.
   *
   * Pipeline: Search → Scrape → LLM Extract → Apollo Enrich → Return
   *
   * @param filters   Search criteria from the user
   * @param emit      SSE progress emitter
   * @returns         Array of discovered leads ready to be saved
   */
  async discover(filters: SearchFilters, emit: EmitFn): Promise<DiscoveredLead[]> {
    const maxResults = Math.min(filters.maxResults ?? 20, 50);

    // ── 1. LLM query expansion ────────────────────────────
    emit({ step: 'expand', progress: 5, message: 'AI analyzing your search criteria…' });
    const queries = await expandSearchQueries(filters);
    emit({
      step: 'expand_done',
      progress: 12,
      message: `Generated ${queries.length} targeted search queries…`,
    });

    // ── 2. Web search (SearXNG/Tavily — always available) ──
    emit({
      step: 'web_search',
      progress: 18,
      message: `Searching the web for real companies (${webSearchService.hasPremiumProvider() ? 'Tavily' : 'SearXNG meta-search'})…`,
    });

    const perQuery = Math.max(8, Math.ceil((maxResults * 3) / queries.length)); // More results to compensate for blocked domains
    const webResults = await runWebSearch(queries, perQuery);

    emit({
      step: 'web_done',
      progress: 35,
      message: `Found ${webResults.length} real web result${webResults.length !== 1 ? 's' : ''} to investigate…`,
    });

    logger.info(
      { queryCount: queries.length, resultCount: webResults.length },
      'Web search completed',
    );

    // ── 3. Scrape websites + LLM extraction ───────────────
    let discoveredLeads: DiscoveredLead[] = [];

    if (webResults.length > 0) {
      emit({
        step: 'scrape_extract',
        progress: 40,
        message: `Visiting ${Math.min(webResults.length, 10)} company websites to extract real data…`,
      });

      const scraped = await scrapeAndExtractLeads(webResults, filters, maxResults, emit);
      discoveredLeads.push(...scraped);

      emit({
        step: 'extract_done',
        progress: 75,
        message: `Extracted ${scraped.length} real company profile${scraped.length !== 1 ? 's' : ''} from web data…`,
      });
    }

    // ── 4. Apollo B2B enrichment (optional) ───────────────
    const hasApollo = !!process.env['APOLLO_API_KEY'];
    if (hasApollo) {
      emit({
        step: 'apollo',
        progress: 78,
        message: 'Enriching with Apollo B2B contacts database…',
      });

      const apolloLeads = await runApolloSearch(
        filters,
        Math.ceil(maxResults * 0.4),
      );

      for (const person of apolloLeads) {
        discoveredLeads.push({
          companyName: person.company || 'Unknown Company',
          contactName: `${person.firstName} ${person.lastName}`.trim() || undefined,
          contactEmail: person.email || undefined,
          contactTitle: person.title || undefined,
          contactLinkedin: person.linkedinUrl || undefined,
          industry: person.industry || filters.industry,
          employeeCount: person.employeeCount || undefined,
          location: filters.location,
          discoverySource: 'apollo',
          discoveryReason: `Found via Apollo B2B database matching "${filters.industry ?? 'your'}" industry criteria`,
        });
      }

      if (apolloLeads.length > 0) {
        emit({
          step: 'apollo_done',
          progress: 85,
          message: `Apollo added ${apolloLeads.length} B2B contact${apolloLeads.length !== 1 ? 's' : ''}…`,
        });
      }
    }

    // ── 5. NO AI FALLBACK — real data only ──
    if (discoveredLeads.length === 0) {
      logger.info(
        { filters },
        'All real sources returned 0 results — no AI fallback, returning empty',
      );
      emit({
        step: 'no_results',
        progress: 90,
        message: `No real companies found matching your criteria. Try broader search terms.`,
      });
    }

    // Deduplicate by company name (case-insensitive)
    const seen = new Set<string>();
    discoveredLeads = discoveredLeads.filter((l) => {
      const key = l.companyName.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const finalLeads = discoveredLeads.slice(0, maxResults);

    logger.info(
      {
        total: finalLeads.length,
        webSearch: finalLeads.filter((l) => l.discoverySource === 'web_search').length,
        apollo: finalLeads.filter((l) => l.discoverySource === 'apollo').length,
      },
      'Discovery pipeline completed',
    );

    return finalLeads;
  },
};
