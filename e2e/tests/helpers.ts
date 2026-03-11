import { test, expect, type Page } from '@playwright/test';

/**
 * Shared helpers for E2E tests.
 * Provides login utility and common assertions.
 */

/** Default admin credentials seeded by prisma/seed.ts */
export const ADMIN_USER = {
  email: 'admin@example.com',
  password: 'admin123',
};

/** API base URL for direct API calls in tests */
export const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';

/**
 * Login via the UI login form.
 * Waits for redirect to /dashboard before returning.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(ADMIN_USER.email);
  await page.getByLabel(/password/i).fill(ADMIN_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard**');
}

/**
 * Assert the sidebar navigation is visible and contains expected links.
 */
export async function expectDashboardSidebar(page: Page): Promise<void> {
  await expect(page.getByRole('navigation')).toBeVisible();
  const expectedLinks = ['Dashboard', 'Leads', 'Clients', 'Outreach', 'Proposals'];
  for (const link of expectedLinks) {
    await expect(page.getByRole('link', { name: link })).toBeVisible();
  }
}

/**
 * Seed a lead via API and return its ID.
 * Useful for tests that need pre-existing data.
 */
export async function seedLeadViaApi(authToken: string): Promise<string> {
  const response = await fetch(`${API_URL}/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `access_token=${authToken}`,
    },
    body: JSON.stringify({
      companyName: `E2E Test Co ${Date.now()}`,
      contactName: 'E2E Contact',
      contactEmail: `e2e-${Date.now()}@test.com`,
      source: 'MANUAL',
    }),
  });
  const data = await response.json();
  return data.data.id;
}
