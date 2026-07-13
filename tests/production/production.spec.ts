import { expect, test } from '@playwright/test';

test('single-origin production PvP, rematch, and bot entry', async ({ browser }) => {
  const firstContext = await browser.newContext(), secondContext = await browser.newContext();
  const first = await firstContext.newPage(), second = await secondContext.newPage(); const errors: string[] = [];
  for (const page of [first, second]) { page.on('pageerror', (error) => errors.push(error.message)); page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) }) }
  await Promise.all([first.goto('/'), second.goto('/')]);
  await expect(first.locator('details.debug')).toHaveCount(0); await expect(first.getByTestId('normal-match')).toBeEnabled();
  await Promise.all([first.getByTestId('normal-match').click(), second.getByTestId('normal-match').click()]);
  await Promise.all([expect(first.locator('.board')).toBeVisible(), expect(second.locator('.board')).toBeVisible()]);
  await first.getByRole('button', { name: '\uAE30\uAD8C' }).click();
  await Promise.all([expect(first.getByTestId('result')).toBeVisible(), expect(second.getByTestId('result')).toBeVisible()]);
  await Promise.all([first.getByTestId('rematch').click(), second.getByTestId('rematch').click()]); await expect(first.locator('.overlay')).toBeVisible();
  expect(errors.filter((message) => /cors|failed to fetch|websocket/i.test(message))).toEqual([]);
  await Promise.all([firstContext.close(), secondContext.close()]);
});

test('production UI can enter an immediate bot battle', async ({ page }) => {
  await page.goto('/'); const bot = page.getByRole('button', { name: '\uBD07\uACFC \uC989\uC2DC \uB300\uC804' }); await expect(bot).toBeEnabled(); await bot.click(); await expect(page.locator('.board')).toBeVisible(); await expect(page.locator('details.debug')).toHaveCount(0);
});
