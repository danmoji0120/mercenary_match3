import { expect, test } from '@playwright/test';
import { startGuest } from './helpers';

test('mercenary collection, detail, and loadout remain inside the app frame', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGuest(page, '/mercenaries');
  await expect(page.getByTestId('mercenary-card')).toHaveCount(5);
  await expect(page.getByTestId('bottom-navigation').locator('svg')).toHaveCount(3);
  expect(await page.locator('[data-portrait-source="fallback"]').count()).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('collection-390x844.png'), fullPage: true });
  await page.goto('/lobby');
  await page.getByTestId('open-dev-tools').click();
  await page.getByTestId('currency-ui-preview').click();
  await page.screenshot({ path: testInfo.outputPath('dev-sheet-390x844.png'), fullPage: false });
  await page.getByRole('button', { name: '닫기' }).click();
  await page.getByRole('button', { name: '계약석 100' }).click();
  await page.screenshot({ path: testInfo.outputPath('currency-sheet-390x844.png'), fullPage: false });
  await page.getByRole('button', { name: '닫기' }).click();
  await page.screenshot({ path: testInfo.outputPath('lobby-390x844.png'), fullPage: false });
  await page.goto('/mercenaries');
  await page.getByTestId('mercenary-card').filter({ hasText: '유리아' }).click();
  const detail = page.getByTestId('mercenary-detail');
  await expect(detail).toBeVisible();
  const detailBox = await detail.boundingBox();
  expect(detailBox!.y).toBeGreaterThanOrEqual(0);
  expect(detailBox!.y + detailBox!.height).toBeLessThanOrEqual(
    await page.evaluate(() => innerHeight + 20),
  );
  await page.screenshot({ path: testInfo.outputPath('detail-390x844.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.getByTestId('open-loadout').click();
  await expect(page.getByTestId('loadout-editor-screen')).toBeVisible();
  await expect(page.getByTestId('save-loadout')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('loadout-390x844.png'), fullPage: true });
  for (const size of [
    { width: 360, height: 800 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/lobby');
    await page.screenshot({
      path: testInfo.outputPath(`lobby-${size.width}x${size.height}.png`),
      fullPage: false,
    });
    await page.goto('/mercenaries');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: testInfo.outputPath(`collection-${size.width}x${size.height}.png`),
      fullPage: false,
    });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/mercenaries');
  const shell = await page.getByTestId('app-shell').boundingBox();
  expect(shell!.width).toBeLessThanOrEqual(541);
  await page.screenshot({ path: testInfo.outputPath('collection-1280x720.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lobby');
  await page.getByTestId('bot-match').click();
  await expect(page.locator('.board')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('bot-entry-390x844.png'), fullPage: false });
  await page.locator('details.debug').evaluate((node: HTMLDetailsElement) => { node.open = true; });
  await page.getByTestId('debug-win').click();
  await page.getByTestId('return-lobby').click();
  await expect(page).toHaveURL(/\/lobby$/);
  await page.screenshot({ path: testInfo.outputPath('post-battle-lobby-390x844.png'), fullPage: false });
});
