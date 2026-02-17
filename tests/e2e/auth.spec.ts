import { test, expect } from '@playwright/test';

test.describe('LINEAGE E2E', () => {
  test('home and login flow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /LINEAGE/i })).toBeVisible();
    await page.getByRole('link', { name: /Sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByPlaceholder(/email/i).fill('director@lineage.demo');
    await page.getByPlaceholder(/password/i).fill('director-secure');
    await page.getByRole('button', { name: /Sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('dashboard and garments list', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill('director@lineage.demo');
    await page.getByPlaceholder(/password/i).fill('director-secure');
    await page.getByRole('button', { name: /Sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole('link', { name: /Items/i }).first().click();
    await expect(page).toHaveURL(/\/garments/);
    await expect(page.getByRole('heading', { name: /Items/i })).toBeVisible();
  });
});
