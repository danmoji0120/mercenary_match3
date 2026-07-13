import { expect, test } from '@playwright/test';
import { startGuest } from './helpers';

test('mercenary collection, detail, and loadout remain inside the app frame', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGuest(page, '/mercenaries');
  await expect(page.getByTestId('mercenary-card')).toHaveCount(5);
  await page.screenshot({ path: testInfo.outputPath('collection-390x844.png'), fullPage: true });

  await page.getByTestId('mercenary-card').filter({ hasText: '유리아' }).click();
  const detail = page.getByTestId('mercenary-detail');
  await expect(detail).toBeVisible();
  const detailBox = await detail.boundingBox();
  expect(detailBox!.y).toBeGreaterThanOrEqual(0);
  expect(detailBox!.y + detailBox!.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight + 20));
  await page.screenshot({ path: testInfo.outputPath('detail-390x844.png'), fullPage: true });

  await page.keyboard.press('Escape');
  await page.getByTestId('open-loadout').click();
  await expect(page.getByTestId('loadout-editor-screen')).toBeVisible();
  await expect(page.getByTestId('save-loadout')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('loadout-390x844.png'), fullPage: true });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/mercenaries');
  const shell = await page.getByTestId('app-shell').boundingBox();
  expect(shell!.width).toBeLessThanOrEqual(541);
  await page.screenshot({ path: testInfo.outputPath('collection-1280x720.png'), fullPage: true });
});
