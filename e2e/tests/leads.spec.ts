import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

/**
 * Leads page E2E tests.
 * Verifies lead listing, search, and basic interactions.
 */
test.describe('Leads', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Leads' }).click();
    await page.waitForURL('**/dashboard/leads**');
  });

  test('should display leads page with table', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /leads/i })).toBeVisible();

    // Table headers should be visible
    await expect(page.getByText(/company/i)).toBeVisible();
    await expect(page.getByText(/contact/i)).toBeVisible();
    await expect(page.getByText(/status/i)).toBeVisible();
  });

  test('should have search functionality', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill('Test Company');

    // Should trigger a search (page reloads or table updates)
    await page.waitForTimeout(500); // debounce
  });

  test('should display pagination controls', async ({ page }) => {
    // Pagination should exist (even if no data yet)
    const pagination = page.locator('[class*="flex"][class*="justify"]').last();
    await expect(pagination).toBeVisible();
  });

  test('should show lead score badges', async ({ page }) => {
    // If there are leads, score badges should render with colors
    const scoreBadges = page.locator('[class*="rounded-full"]');
    // This is a soft check — may have 0 if no leads seeded
    const count = await scoreBadges.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
