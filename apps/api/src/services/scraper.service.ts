/**
 * Website Scraper Service
 *
 * Fetches real web pages and extracts meaningful text content for LLM processing.
 * Used after web search to get actual company data from their websites.
 *
 * Flow: URL → fetch HTML → extract text + metadata → ready for LLM
 */

import * as cheerio from 'cheerio';
import { logger } from '../config/logger.js';

// ── Types ─────────────────────────────────────────────────

export interface ScrapedPage {
  url: string;
  title: string;
  /** Main text content of the page (cleaned, max ~3000 chars) */
  content: string;
  /** Meta description if available */
  description: string;
  /** Emails found on the page */
  emails: string[];
  /** Phone numbers found */
  phones: string[];
  /** Social media links */
  socials: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
  /** Links to important sub-pages (about, team, contact) */
  subPages: { label: string; url: string }[];
  /** Whether scraping succeeded */
  success: boolean;
  error?: string;
}

export interface CompanyPageData {
  /** The main landing page */
  mainPage: ScrapedPage;
  /** Extra pages we scraped (about, team, contact) */
  subPages: ScrapedPage[];
  /** Combined text from all pages for LLM consumption */
  combinedText: string;
}

// ── Config ────────────────────────────────────────────────

const FETCH_TIMEOUT = 12_000; // 12s per page
const MAX_HTML_SIZE = 500_000; // 500KB max HTML to parse
const MAX_CONTENT_CHARS = 3000; // max text per page
const MAX_COMBINED_CHARS = 6000; // max combined text per company
const MAX_SUB_PAGES = 2; // max sub-pages to scrape per company
const CONCURRENT_SCRAPES = 3; // parallel scrapes at once

// Common user agent to avoid being blocked
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── Helpers ───────────────────────────────────────────────

/** Fetch a URL with timeout and size limits */
async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error(`Not HTML: ${contentType}`);
    }

    // Read with size limit
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No body');

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalSize += value.length;
      if (totalSize > MAX_HTML_SIZE) {
        reader.cancel();
        break;
      }
    }

    const decoder = new TextDecoder('utf-8', { fatal: false });
    return chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();
  } finally {
    clearTimeout(timeout);
  }
}

/** Extract clean text content from HTML */
function extractContent(html: string, url: string): ScrapedPage {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, nav, footer, header, noscript, iframe, svg, [aria-hidden="true"]').remove();
  $('[class*="cookie"], [class*="popup"], [class*="modal"], [class*="banner"], [id*="cookie"]').remove();
  $('[class*="sidebar"], [class*="widget"], [class*="advertisement"], [class*="ad-"]').remove();

  // Get title
  const title =
    $('meta[property="og:title"]').attr('content') ??
    $('title').text().trim() ??
    $('h1').first().text().trim() ??
    '';

  // Get meta description
  const description =
    $('meta[name="description"]').attr('content') ??
    $('meta[property="og:description"]').attr('content') ??
    '';

  // Extract main content — prioritise main/article tags, fall back to body
  let mainText = '';
  const mainEl = $('main, article, [role="main"], .main-content, #content, .content');
  if (mainEl.length > 0) {
    mainText = mainEl.text();
  } else {
    mainText = $('body').text();
  }

  // Clean up whitespace
  const content = mainText
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CONTENT_CHARS);

  // Extract emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const allText = $.text();
  const emails = [...new Set((allText.match(emailRegex) ?? []))].filter(
    (e) =>
      !e.includes('example.com') &&
      !e.includes('sentry') &&
      !e.includes('webpack') &&
      !e.endsWith('.png') &&
      !e.endsWith('.jpg'),
  );

  // Extract phone numbers
  const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const phones = [...new Set((allText.match(phoneRegex) ?? []))].slice(0, 3);

  // Extract social links
  const socials: ScrapedPage['socials'] = {};
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    if (href.includes('linkedin.com/company') || href.includes('linkedin.com/in/')) {
      socials.linkedin = href;
    } else if (href.includes('twitter.com/') || href.includes('x.com/')) {
      socials.twitter = href;
    } else if (href.includes('facebook.com/')) {
      socials.facebook = href;
    }
  });

  // Find important sub-pages
  const baseUrl = new URL(url).origin;
  const subPages: { label: string; url: string }[] = [];
  const subPagePatterns = /\/(about|team|contact|leadership|people|our-team|company|who-we-are)/i;

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim();
    if (subPagePatterns.test(href) && subPages.length < 5) {
      let fullUrl = href;
      if (href.startsWith('/')) fullUrl = baseUrl + href;
      else if (!href.startsWith('http')) fullUrl = baseUrl + '/' + href;

      // Deduplicate
      if (!subPages.some((p) => p.url === fullUrl)) {
        subPages.push({ label: text || href, url: fullUrl });
      }
    }
  });

  return {
    url,
    title,
    content,
    description,
    emails,
    phones,
    socials,
    subPages,
    success: true,
  };
}

/** Resolve relative URL to absolute */
function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

/** Check if a URL is worth scraping (skip social media, PDFs, etc.) */
function isScrapableUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const skipDomains = [
      'facebook.com',
      'twitter.com',
      'x.com',
      'instagram.com',
      'youtube.com',
      'tiktok.com',
      'reddit.com',
      'wikipedia.org',
      'google.com',
      'bing.com',
      'duckduckgo.com',
      'amazon.com',
      'ebay.com',
      // Sites that block bot scraping (403)
      'linkedin.com',
      'crunchbase.com',
      'glassdoor.com',
      'inc.com',
      'forbes.com',
      'bloomberg.com',
      'owler.com',
      'zoominfo.com',
      'pitchbook.com',
      'indeed.com',
      'play.google.com',
    ];
    if (skipDomains.some((d) => u.hostname.includes(d))) return false;
    if (/\.(pdf|doc|docx|xls|xlsx|ppt|zip|rar|mp4|mp3|jpg|png|gif|svg)$/i.test(u.pathname))
      return false;
    return true;
  } catch {
    return false;
  }
}

// ── Parallel scraping helper ──────────────────────────────

async function scrapeInParallel(urls: string[]): Promise<Map<string, ScrapedPage>> {
  const results = new Map<string, ScrapedPage>();

  // Process in batches of CONCURRENT_SCRAPES
  for (let i = 0; i < urls.length; i += CONCURRENT_SCRAPES) {
    const batch = urls.slice(i, i + CONCURRENT_SCRAPES);
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const html = await fetchPage(url);
        return extractContent(html, url);
      }),
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result && result.status === 'fulfilled') {
        results.set(batch[j]!, result.value);
      } else {
        results.set(batch[j]!, {
          url: batch[j]!,
          title: '',
          content: '',
          description: '',
          emails: [],
          phones: [],
          socials: {},
          subPages: [],
          success: false,
          error: result && result.status === 'rejected' ? String(result.reason) : 'Unknown error',
        });
      }
    }
  }

  return results;
}

// ── Public API ────────────────────────────────────────────

export const scraperService = {
  /**
   * Scrape a single URL and return extracted content.
   */
  async scrapePage(url: string): Promise<ScrapedPage> {
    try {
      const html = await fetchPage(url);
      return extractContent(html, url);
    } catch (err) {
      logger.warn({ err, url }, 'Failed to scrape page');
      return {
        url,
        title: '',
        content: '',
        description: '',
        emails: [],
        phones: [],
        socials: {},
        subPages: [],
        success: false,
        error: String(err),
      };
    }
  },

  /**
   * Scrape a company website — main page + important sub-pages (about, team, contact).
   * Returns combined text ready for LLM consumption.
   */
  async scrapeCompany(url: string): Promise<CompanyPageData> {
    // 1. Scrape main page
    const mainPage = await this.scrapePage(url);

    const subPages: ScrapedPage[] = [];

    // 2. Scrape important sub-pages (about, team, contact)
    if (mainPage.success && mainPage.subPages.length > 0) {
      const subUrls = mainPage.subPages
        .slice(0, MAX_SUB_PAGES)
        .map((p) => resolveUrl(url, p.url))
        .filter(isScrapableUrl);

      if (subUrls.length > 0) {
        const subResults = await scrapeInParallel(subUrls);
        for (const page of subResults.values()) {
          if (page.success && page.content.length > 50) {
            subPages.push(page);
          }
        }
      }
    }

    // 3. Combine text from all pages
    const parts: string[] = [];
    if (mainPage.success) {
      parts.push(`=== Main Page: ${mainPage.title} ===\n${mainPage.description}\n${mainPage.content}`);
    }
    for (const sp of subPages) {
      parts.push(`=== ${sp.title || sp.url} ===\n${sp.content}`);
    }
    const combinedText = parts.join('\n\n').slice(0, MAX_COMBINED_CHARS);

    return { mainPage, subPages, combinedText };
  },

  /**
   * Scrape multiple company URLs in parallel batches.
   * Returns a map of URL → CompanyPageData.
   */
  async scrapeMultiple(
    urls: string[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<Map<string, CompanyPageData>> {
    const results = new Map<string, CompanyPageData>();
    const scrapableUrls = urls.filter(isScrapableUrl);
    let completed = 0;

    // Process main pages in parallel batches
    for (let i = 0; i < scrapableUrls.length; i += CONCURRENT_SCRAPES) {
      const batch = scrapableUrls.slice(i, i + CONCURRENT_SCRAPES);
      const batchPromises = batch.map(async (url) => {
        try {
          const data = await this.scrapeCompany(url);
          return { url, data };
        } catch (err) {
          logger.warn({ err, url }, 'Company scraping failed');
          return {
            url,
            data: {
              mainPage: {
                url,
                title: '',
                content: '',
                description: '',
                emails: [],
                phones: [],
                socials: {},
                subPages: [],
                success: false,
                error: String(err),
              },
              subPages: [],
              combinedText: '',
            } as CompanyPageData,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const { url, data } of batchResults) {
        results.set(url, data);
        completed++;
        onProgress?.(completed, scrapableUrls.length);
      }
    }

    return results;
  },

  /** Check if a URL is worth scraping */
  isScrapable: isScrapableUrl,
};
