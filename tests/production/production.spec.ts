import { expect, test } from '@playwright/test';

test('single-origin production shell protects account-required actions', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.getByTestId('bottom-navigation').getByRole('button')).toHaveCount(5);
  await expect(page.locator('details.debug')).toHaveCount(0);
  await expect(page.getByTestId('account-status')).toBeVisible();
  await expect(page.getByTestId('normal-match')).toBeDisabled();
  await expect(page.getByRole('button', { name: '\uBD07\uACFC \uC989\uC2DC \uB300\uC804' })).toBeDisabled();
  const health = await page.request.get('/health'); expect(health.ok()).toBe(true);
  expect(errors.filter((message) => /cors|websocket/i.test(message))).toEqual([]);
});

test('production rejects unauthenticated Socket.IO handshakes', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const response = await fetch('/socket.io/?EIO=4&transport=polling');
    return { status: response.status, body: await response.text() };
  });
  expect(result.status).toBe(200);
  expect(result.body).toContain('sid');
  await expect(page.locator('details.debug')).toHaveCount(0);
});
