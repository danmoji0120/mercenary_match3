import { expect, test } from '@playwright/test';
import { startGuest } from './helpers';

test('combat hierarchy is compact, accessible, and responsive', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startGuest(page);
  await expect(page.getByTestId('lobby-ready')).toBeVisible();
  await expect(page.getByTestId('connection-banner')).toHaveCount(0);
  await page.getByRole('button', { name: '\uBD07 \uB300\uC804' }).click();
  await expect(page.locator('.board')).toBeVisible();
  await expect(page.getByTestId('self-hp')).toBeVisible();
  await expect(page.getByTestId('opponent-hp')).toBeVisible();
  await expect(page.getByTestId('battle-timer')).toBeVisible();
  await expect(page.getByTestId('combat-stage')).toBeVisible();
  await expect(page.locator('.stage-fighter img')).toHaveCount(2);
  await expect(page.getByTestId('self-supports').getByRole('button')).toHaveCount(2);
  await expect(page.getByTestId('skill')).toBeDisabled();
  await expect(page.locator('.skill-control [role="progressbar"]')).toHaveAttribute('aria-valuemax', '100');
  const board = await page.locator('.board').boundingBox(), skill = await page.getByTestId('skill').boundingBox();
  expect(board?.width).toBeGreaterThan(skill?.height ?? 0);
  const verticalOrder = await page.locator('.comparison-hud, .character-stage, .board-wrap, .skill-control, .battle-utilities').evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().top)));
  expect(verticalOrder).toEqual([...verticalOrder].sort((a, b) => a - b));
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  await testInfo.attach('mobile-combat-360x640', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: '\uC2A4\uD0AC \uC815\uBCF4' }).click();
  await expect(page.getByRole('dialog', { name: '\uC2A4\uD0AC \uC815\uBCF4' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '\uC2A4\uD0AC \uC815\uBCF4' })).toBeHidden();
});

test('major viewports keep lobby and central battle viewport within bounds', async ({ page }, testInfo) => {
  const sizes = [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 768, height: 1024 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }];
  await startGuest(page);
  for (const size of sizes) {
    await page.setViewportSize(size); await page.goto('/'); await expect(page.getByTestId('normal-match')).toBeVisible();
    const shell = await page.locator('.shell').boundingBox();
    expect(shell!.width).toBeLessThanOrEqual(Math.min(size.width, 540) + 1);
  }
  await page.setViewportSize({ width: 1280, height: 720 }); await page.getByRole('button', { name: '\uBD07 \uB300\uC804' }).click(); await expect(page.locator('.board')).toBeVisible();
  const shell = await page.locator('.battle-screen').boundingBox();
  expect(shell!.width / shell!.height).toBeLessThanOrEqual(.57);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  await testInfo.attach('desktop-central-combat-1280x720', { body: await page.screenshot(), contentType: 'image/png' });
});
