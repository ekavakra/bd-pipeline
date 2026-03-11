/**
 * Native Fetch Client
 *
 * Thin wrapper around the native fetch API for making HTTP requests
 * to external services (Clearbit, Hunter, Apollo, Transcription sidecar, etc.)
 *
 * Features:
 * - Base URL configuration
 * - Automatic JSON serialization
 * - Timeout support via AbortSignal
 * - Error formatting
 */

import { logger } from '../config/logger.js';

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

interface FetchResponse<T> {
  data: T;
  status: number;
  ok: boolean;
}

/**
 * Creates a configured fetch client for a specific service.
 *
 * @param baseUrl - Base URL for the service (e.g., 'http://localhost:5001')
 * @param defaultHeaders - Headers included in every request
 */
export function createFetchClient(baseUrl: string, defaultHeaders?: Record<string, string>) {
  return async function fetchClient<T = unknown>(
    path: string,
    options: FetchOptions = {},
  ): Promise<FetchResponse<T>> {
    const { method = 'GET', headers = {}, body, timeoutMs = 30000 } = options;

    const url = `${baseUrl}${path}`;
    const signal = AbortSignal.timeout(timeoutMs);

    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
      ...headers,
    };

    try {
      const response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });

      const data = (await response.json()) as T;

      if (!response.ok) {
        logger.warn(
          { url, method, status: response.status, data },
          'External service request failed',
        );
      }

      return { data, status: response.status, ok: response.ok };
    } catch (error) {
      logger.error({ url, method, error }, 'External service request error');
      throw error;
    }
  };
}
