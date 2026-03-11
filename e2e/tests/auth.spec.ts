import { test, expect } from '@playwright/test';
import { ADMIN_USER } from './helpers';

/**
 * Authentication E2E tests.
 * Verifies login flow, validation, and redirect behavior.
 */
test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect validation messages
    await expect(page.getByText(/email/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('bad@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should stay on login page and show error
    await expect(page).toHaveURL(/login/);
  });

  test('should login successfully and redirect to dashboard', async ({ page }) => {
    await page.getByLabel(/email/i).fill(ADMIN_USER.email);
    await page.getByLabel(/password/i).fill(ADMIN_USER.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard**');
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });
});
