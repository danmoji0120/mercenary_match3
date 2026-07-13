import { expect, type Page } from '@playwright/test';

export async function startGuest(page: Page, destination = '/lobby') {
  await page.goto('/');
  await expect(page.getByTestId('auth-entry')).toBeVisible();
  await page.getByTestId('start-guest').click();
  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.getByTestId('lobby-ready')).toBeVisible();
  if (destination !== '/lobby') { await page.goto(destination); await expect(page.locator('.shell')).toBeVisible() }
}
