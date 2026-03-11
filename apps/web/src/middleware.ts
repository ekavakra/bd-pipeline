/**
 * Next.js Middleware — Route Protection
 *
 * Redirects unauthenticated users away from /dashboard/*
 * and authenticated users away from /login.
 *
 * Checks for the Zustand-persisted auth state in cookies/localStorage
 * via a lightweight cookie approach: we read the httpOnly refresh token
 * cookie as a proxy for "logged in". Since the access token lives in
 * localStorage (not accessible in middleware), we check the refresh
 * token cookie set by the backend on login.
 *
 * Fallback: If no cookie, we allow the client-side auth store to handle it.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public assets, API routes, and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next();
  }

  // Check for refresh token cookie (set by backend on login)
  const hasRefreshToken = request.cookies.has('refreshToken');

  // Protected routes: /dashboard/*
  if (pathname.startsWith('/dashboard')) {
    if (!hasRefreshToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Redirect authenticated users away from login
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (hasRefreshToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
