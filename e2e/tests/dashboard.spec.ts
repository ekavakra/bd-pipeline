import { test, expect } from '@playwright/test';
import { loginAsAdmin, expectDashboardSidebar } from './helpers';

/**
 * Dashboard E2E tests.
 * Verifies navigation, layout, and basic content after login.
 */
test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display sidebar navigation', async ({ page }) => {
    await expectDashboardSidebar(page);
  });

  test('should show dashboard overview stats', async ({ page }) => {
    // Dashboard page should have stat cards
    await expect(page.getByText(/total leads/i)).toBeVisible();
  });

  test('should navigate to leads page', async ({ page }) => {
    await page.getByRole('link', { name: 'Leads' }).click();
    await page.waitForURL('**/dashboard/leads**');
    await expect(page.getByRole('heading', { name: /leads/i })).toBeVisible();
  });

  test('should navigate to clients page', async ({ page }) => {
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.waitForURL('**/dashboard/clients**');
  });

  test('should navigate to proposals page', async ({ page }) => {
    await page.getByRole('link', { name: 'Proposals' }).click();
    await page.waitForURL('**/dashboard/proposals**');
  });
});
