import { expect, test } from '@playwright/test';

test('app shell exposes five URL-backed mobile game tabs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page).toHaveURL(/\/lobby$/);
  const navigation = page.getByTestId('bottom-navigation');
  await expect(navigation.getByRole('button')).toHaveCount(5);
  await expect(navigation.locator('[data-tab="lobby"]')).toHaveAttribute('aria-current', 'page');

  await navigation.locator('[data-tab="gacha"]').click();
  await expect(page).toHaveURL(/\/gacha$/);
  await expect(page.getByRole('heading', { name: '신규 용병 모집 준비 중' })).toBeVisible();

  await navigation.locator('[data-tab="mercenaries"]').click();
  await expect(page).toHaveURL(/\/mercenaries$/);
  await expect(page.getByTestId('screen-mercenaries').getByRole('heading', { name: '용병 보관함' })).toBeVisible();
  await expect(page.getByTestId('mercenary-card')).toHaveCount(5);
  await page.goBack();
  await expect(page).toHaveURL(/\/gacha$/);

  await navigation.locator('[data-tab="inventory"]').click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.getByRole('tab')).toHaveCount(5);
  await page.reload();
  await expect(page).toHaveURL(/\/inventory$/);

  await navigation.locator('[data-tab="forge"]').click();
  await expect(page).toHaveURL(/\/forge$/);
  await expect(page.getByTestId('forge-locked')).toContainText('개방 준비 중');
});

test('invalid paths fall back and battle temporarily replaces the app shell', async ({ page }) => {
  await page.goto('/not-a-real-tab');
  await expect(page).toHaveURL(/\/lobby$/);
  await page.getByRole('button', { name: /봇 대전/ }).click();
  await expect(page.locator('.board')).toBeVisible();
  await expect(page.getByTestId('bottom-navigation')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/battle$/);
  await page.locator('details.debug').evaluate((node: HTMLDetailsElement) => { node.open = true });
  await page.getByTestId('debug-win').click();
  await page.getByTestId('return-lobby').click();
  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.getByTestId('bottom-navigation').locator('[data-tab="lobby"]')).toHaveAttribute('aria-current', 'page');
});

test('app frame stays inside portrait and desktop viewports', async ({ page }) => {
  for (const size of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 768, height: 1024 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await page.goto('/mercenaries');
    const shell = await page.getByTestId('app-shell').boundingBox();
    const nav = await page.getByTestId('bottom-navigation').boundingBox();
    expect(shell!.width).toBeLessThanOrEqual(Math.min(size.width, 540) + 1);
    expect(nav!.y + nav!.height).toBeLessThanOrEqual(size.height + 1);
    await expect(page.getByTestId('mercenary-card').first()).toBeVisible();
  }
});
