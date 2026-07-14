import { expect, test } from '@playwright/test';
import { startGuest } from './helpers';

test('app shell exposes only implemented navigation destinations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGuest(page);
  await expect(page).toHaveURL(/\/lobby$/);
  const navigation = page.getByTestId('bottom-navigation');
  await expect(navigation.getByRole('button')).toHaveCount(3);
  await expect(navigation.locator('[data-tab="lobby"]')).toHaveAttribute('aria-current', 'page');
  await navigation.locator('[data-tab="mercenaries"]').click();
  await expect(page).toHaveURL(/\/mercenaries$/);
  await expect(page.getByRole('heading', { name: '용병 보관함' })).toBeVisible();
  await expect(page.getByTestId('mercenary-card')).toHaveCount(5);
  await navigation.locator('[data-tab="loadout"]').click();
  await expect(page).toHaveURL(/\/mercenaries\/loadout$/);
  await expect(page.getByTestId('loadout-editor-screen')).toBeVisible();
  await expect(navigation.locator('[data-tab="loadout"]')).toHaveAttribute('aria-current', 'page');
});

test('invalid paths fall back and battle temporarily replaces the app shell', async ({ page }) => {
  await startGuest(page);
  await page.goto('/not-a-real-tab');
  await expect(page).toHaveURL(/\/lobby$/);
  await page.getByTestId('bot-match').click();
  await expect(page.locator('.board')).toBeVisible();
  await expect(page.getByTestId('bottom-navigation')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/battle$/);
  await page.locator('details.debug').evaluate((node: HTMLDetailsElement) => {
    node.open = true;
  });
  await page.getByTestId('debug-win').click();
  await page.getByTestId('return-lobby').click();
  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.getByTestId('bottom-navigation').locator('[data-tab="lobby"]')).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('app frame stays inside portrait and desktop viewports without horizontal overflow', async ({
  page,
}) => {
  for (const size of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(size);
    if (size.width === 360) await startGuest(page, '/mercenaries');
    else await page.goto('/mercenaries');
    const shell = await page.getByTestId('app-shell').boundingBox(),
      nav = await page.getByTestId('bottom-navigation').boundingBox();
    expect(shell!.width).toBeLessThanOrEqual(Math.min(size.width, 540) + 1);
    expect(nav!.y + nav!.height).toBeLessThanOrEqual(size.height + 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByTestId('mercenary-card').first()).toBeVisible();
  }
});
