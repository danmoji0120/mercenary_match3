import { expect, test } from '@playwright/test';

test('two players attack, defend, finish, and rematch', async ({ browser }) => {
  const aContext = await browser.newContext(), bContext = await browser.newContext();
  const a = await aContext.newPage(), b = await bContext.newPage();
  for (const [label, page] of [['a', a], ['b', b]] as const) { page.on('pageerror', (error) => console.log(`${label} pageerror: ${error.stack}`)); page.on('console', (message) => { if (message.type() === 'error') console.log(`${label} console: ${message.text()}`) }) }
  await Promise.all([a.goto('/'), b.goto('/')]);
  await Promise.all([expect(a.getByTestId('lobby-ready')).toBeVisible(), expect(b.getByTestId('lobby-ready')).toBeVisible()]);
  await a.getByTestId('edit-loadout').click();
  await expect(a).toHaveURL(/\/mercenaries\/loadout$/);
  await a.getByRole('tab', { name: /\uC804\uD22C\uC6D0/ }).click();
  await a.locator('.loadout-candidate').filter({ hasText: '\uD074\uB77C\uB9AC\uC2A4' }).click();
  await expect(a.getByText('\uC800\uC7A5\uD558\uC9C0 \uC54A\uC740 \uBCC0\uACBD')).toBeVisible();
  await a.getByTestId('save-loadout').click();
  await expect(a).toHaveURL(/\/lobby$/);
  await a.reload();
  await expect(a.getByTestId('lobby-ready')).toBeVisible();
  await expect(a.locator('.loadout-summary')).toContainText('\uD074\uB77C\uB9AC\uC2A4');
  await Promise.all([a.getByTestId('normal-match').click(), b.getByTestId('normal-match').click()]);
  await Promise.all([expect(a.locator('.board')).toBeVisible(), expect(b.locator('.board')).toBeVisible()]);
  await expect(b.locator('.combat-summary.opponent')).toContainText('\uD074\uB77C\uB9AC\uC2A4');
  await expect(a.getByTestId('skill')).toContainText('\uCCA0\uBCBD \uD0DC\uC138');
  await expect(a.getByTestId('self-supports').getByRole('button').first()).toHaveAccessibleName(/\uC120\uC81C \uC5C4\uD638/);
  await expect(a.locator('.runtime-strip')).toHaveCount(0);
  await expect(a.locator('body')).not.toContainText('abilityId');
  await Promise.all([expect(a.locator('.overlay')).toBeHidden(), expect(b.locator('.overlay')).toBeHidden()]);

  await a.locator('details.debug').evaluate((node: HTMLDetailsElement) => { node.open = true });
  await b.locator('details.debug').evaluate((node: HTMLDetailsElement) => { node.open = true });
  await a.getByTestId('debug-time35').click();
  await Promise.all([expect(a.getByTestId('frenzy-badge')).toBeVisible({ timeout: 8_000 }), expect(b.getByTestId('frenzy-badge')).toBeVisible({ timeout: 8_000 })]);
  await Promise.all([expect(a.getByTestId('feedback-common')).toContainText('\uACA9\uC804 \uB3CC\uC785'), expect(b.getByTestId('feedback-common')).toContainText('\uACA9\uC804 \uB3CC\uC785')]);
  await a.getByTestId('debug-sword').click();
  await b.getByTestId('debug-shield').click();
  await expect(b.getByTestId('attack-warning')).toContainText('SWORD');
  const frenzyDamage = Number((await b.getByTestId('attack-warning').textContent())?.match(/\d+/)?.[0]);
  expect(frenzyDamage).toBeGreaterThan(170);
  await expect(b.getByTestId('attack-warning')).not.toContainText('SWORD');

  await a.getByTestId('debug-win').click();
  await Promise.all([expect(a.getByTestId('result')).toBeVisible(), expect(b.getByTestId('result')).toBeVisible()]);
  await expect(a.getByTestId('result')).toContainText('\uC2B9\uB9AC');
  await expect(b.getByTestId('result')).toContainText('\uD328\uBC30');
  await Promise.all([expect(a.getByTestId('end-reason')).toContainText('HP 0'), expect(b.getByTestId('end-reason')).toContainText('HP 0')]);
  await Promise.all([expect(a.getByTestId('result-stats')).toContainText('HP \uD53C\uD574'), expect(b.getByTestId('result-stats')).toContainText('HP \uD53C\uD574')]);
  await expect(a.locator('.result-details')).not.toHaveAttribute('open', '');
  await a.locator('.result-details summary').click();
  expect(Number(await b.locator('[data-stat="shieldGained"] [data-side="self"]').textContent())).toBeGreaterThan(0);
  expect(Number(await b.locator('[data-stat="damageBlockedByShield"] [data-side="self"]').textContent())).toBeGreaterThan(0);
  await Promise.all([a.getByTestId('rematch').click(), b.getByTestId('rematch').click()]);
  await expect(a.locator('.overlay')).toBeVisible();
  await Promise.all([expect(a.getByTestId('frenzy-badge')).toBeHidden(), expect(b.getByTestId('frenzy-badge')).toBeHidden()]);
  await expect(a.getByTestId('debug-stats')).toContainText('generated 0/0');
  await Promise.all([aContext.close(), bContext.close()]);
});

test('finished bot battle returns safely to lobby and can queue again', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('lobby-ready')).toBeVisible(); await page.getByRole('button', { name: '\uBD07 \uB300\uC804' }).click(); await expect(page.locator('.board')).toBeVisible(); await page.locator('details.debug').evaluate((node: HTMLDetailsElement) => { node.open = true }); await page.getByTestId('debug-win').click(); await expect(page.getByTestId('result')).toBeVisible(); await page.getByTestId('return-lobby').click(); await expect(page.getByTestId('normal-match')).toBeVisible(); await expect(page.getByTestId('result')).toHaveCount(0); await page.getByRole('button', { name: '\uBD07 \uB300\uC804' }).click(); await expect(page.locator('.board')).toBeVisible();
});
