/**
 * API Client — Typed fetch wrapper for backend communication.
 *
 * Uses native fetch with automatic auth header injection,
 * JSON parsing, and error handling.
 */

import { useAuthStore } from './stores/auth-store';

export const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: unknown[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include', // For httpOnly refresh token cookie
  });

  // Handle 401 — try refresh
  if (response.status === 401 && token) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry the original request with new token
      headers['Authorization'] = `Bearer ${useAuthStore.getState().accessToken}`;
      const retryResponse = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
      return handleResponse<T>(retryResponse);
    }

    // Refresh failed — logout
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new ApiError(401, 'Session expired');
  }

  return handleResponse<T>(response);
}

async function handleResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error?.message ?? 'Request failed',
      body?.error?.errors,
    );
  }

  return body?.data as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) return false;

    const body = await response.json();
    useAuthStore.getState().setAuth(body.data.accessToken, body.data.user);
    return true;
  } catch {
    return false;
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),

  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(path: string, data: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
