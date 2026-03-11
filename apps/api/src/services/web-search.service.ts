/**
 * Web Search Service — Multi-source company discovery
 *
 * Priority order:
 *   1. Tavily AI Search  (TAVILY_API_KEY)  — best quality, AI-native, 1000 req/mo free
 *   2. SerpAPI           (SERPAPI_KEY)     — Google results, most reliable, $50/mo
 *   3. SearXNG           (self-hosted)     — meta-search aggregating Google/Bing/DDG, free
 *
 * SearXNG runs as a Docker service and is ALWAYS available — no API keys required.
 * Returns a normalised list of web results that the lead-discovery service
 * then parses with an LLM to extract company profiles.
 */

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'tavily' | 'serpapi' | 'searxng';
}

// ── Public API ────────────────────────────────────────────

export const webSearchService = {
  /**
   * Search across configured providers and return normalised results.
   * Falls through to the next provider on error / empty results.
   * SearXNG is ALWAYS tried as a final fallback.
   */
  async search(query: string, maxResults = 8): Promise<WebSearchResult[]> {
    if (process.env['TAVILY_API_KEY']) {
      try {
        const results = await searchTavily(query, maxResults);
        if (results.length > 0) return results;
      } catch (err) {
        logger.warn({ err, query }, 'Tavily search failed, trying next source');
      }
    }

    if (process.env['SERPAPI_KEY']) {
      try {
        const results = await searchSerp(query, maxResults);
        if (results.length > 0) return results;
      } catch (err) {
        logger.warn({ err, query }, 'SerpAPI search failed, trying SearXNG');
      }
    }

    // SearXNG meta-search — always available via Docker service, no API key
    try {
      const results = await searchSearXNG(query, maxResults);
      if (results.length > 0) return results;
    } catch (err) {
      logger.warn({ err, query }, 'SearXNG search failed');
    }

    logger.warn({ query }, 'All search providers returned zero results');
    return [];
  },

  /**
   * True always — SearXNG runs as a Docker sidecar service.
   */
  hasProvider(): boolean {
    return true;
  },

  /** True if a premium/paid search provider is configured */
  hasPremiumProvider(): boolean {
    return !!(process.env['TAVILY_API_KEY'] || process.env['SERPAPI_KEY']);
  },
};

// ── Tavily ────────────────────────────────────────────────

async function searchTavily(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env['TAVILY_API_KEY'],
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Tavily HTTP ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    results?: Array<{ title: string; url: string; content: string }>;
  };

  return (data.results ?? []).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    snippet: r.content ?? '',
    source: 'tavily' as const,
  }));
}

// ── SerpAPI ───────────────────────────────────────────────

async function searchSerp(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const params = new URLSearchParams({
    api_key: process.env['SERPAPI_KEY']!,
    q: query,
    engine: 'google',
    num: maxResults.toString(),
    gl: 'us',
    hl: 'en',
  });

  const response = await fetch(`https://serpapi.com/search?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`SerpAPI HTTP ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    organic_results?: Array<{ title: string; link: string; snippet: string }>;
  };

  return (data.organic_results ?? []).map((r) => ({
    title: r.title ?? '',
    url: r.link ?? '',
    snippet: r.snippet ?? '',
    source: 'serpapi' as const,
  }));
}

// ── SearXNG (self-hosted meta-search, free) ───────────────

/**
 * Query SearXNG's JSON API — aggregates Google, Bing, DuckDuckGo, etc.
 * Runs as a Docker sidecar so it's always available.
 */
async function searchSearXNG(
  query: string,
  maxResults: number,
): Promise<WebSearchResult[]> {
  const baseUrl = env.SEARXNG_URL ?? 'http://searxng:8080';
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    categories: 'general',
    language: 'en',
    pageno: '1',
  });

  const response = await fetch(`${baseUrl}/search?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`SearXNG HTTP ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    results?: Array<{
      title: string;
      url: string;
      content: string;
      engine: string;
      score: number;
    }>;
  };

  // Filter out bot-blocking sites before slicing to maxResults
  const BLOCKED_DOMAINS = [
    'linkedin.com', 'crunchbase.com', 'glassdoor.com', 'inc.com',
    'forbes.com', 'bloomberg.com', 'owler.com', 'zoominfo.com',
    'pitchbook.com', 'indeed.com', 'youtube.com', 'facebook.com',
    'twitter.com', 'x.com', 'reddit.com', 'wikipedia.org',
    'play.google.com',
  ];

  const results = (data.results ?? [])
    .filter((r) => {
      if (!r.url || !r.title) return false;
      try {
        const host = new URL(r.url).hostname;
        return !BLOCKED_DOMAINS.some((d) => host.includes(d));
      } catch { return false; }
    })
    .slice(0, maxResults)
    .map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? r.title ?? '',
      source: 'searxng' as const,
    }));

  logger.info(
    { query, count: results.length, totalRaw: data.results?.length ?? 0 },
    'SearXNG search completed',
  );
  return results;
}
