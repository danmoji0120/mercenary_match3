import { expect, test } from '@playwright/test';

test('two players attack, defend, finish, and rematch', async ({ browser }) => {
  const aContext = await browser.newContext(), bContext = await browser.newContext();
  const a = await aContext.newPage(), b = await bContext.newPage();
  for (const [label, page] of [['a', a], ['b', b]] as const) { page.on('pageerror', (error) => console.log(`${label} pageerror: ${error.stack}`)); page.on('console', (message) => { if (message.type() === 'error') console.log(`${label} console: ${message.text()}`) }) }
  await Promise.all([a.goto('/'), b.goto('/')]);
  await Promise.all([a.getByTestId('normal-match').click(), b.getByTestId('normal-match').click()]);
  await Promise.all([expect(a.locator('.board')).toBeVisible(), expect(b.locator('.board')).toBeVisible()]);
  await Promise.all([expect(a.locator('.overlay')).toBeHidden(), expect(b.locator('.overlay')).toBeHidden()]);

  await a.locator('details.debug').evaluate((node: HTMLDetailsElement) => { node.open = true });
  await b.locator('details.debug').evaluate((node: HTMLDetailsElement) => { node.open = true });
  await a.getByTestId('debug-time35').click();
  await Promise.all([expect(a.getByTestId('frenzy-badge')).toBeVisible({ timeout: 8_000 }), expect(b.getByTestId('frenzy-badge')).toBeVisible({ timeout: 8_000 })]);
  await Promise.all([expect(a.getByTestId('frenzy-alert')).toBeVisible(), expect(b.getByTestId('frenzy-alert')).toBeVisible()]);
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
  await Promise.all([expect(a.getByTestId('result-stats')).toContainText('\uAC00\uD55C \uCD1D \uD53C\uD574'), expect(b.getByTestId('result-stats')).toContainText('\uAC00\uD55C \uCD1D \uD53C\uD574')]);
  expect(Number(await b.locator('[data-stat="shieldGained"] [data-side="self"]').textContent())).toBeGreaterThan(0);
  expect(Number(await b.locator('[data-stat="damageBlockedByShield"] [data-side="self"]').textContent())).toBeGreaterThan(0);
  await Promise.all([a.getByTestId('rematch').click(), b.getByTestId('rematch').click()]);
  await expect(a.locator('.overlay')).toBeVisible();
  await Promise.all([expect(a.getByTestId('frenzy-badge')).toBeHidden(), expect(b.getByTestId('frenzy-badge')).toBeHidden()]);
  await expect(a.getByTestId('debug-stats')).toContainText('generated 0/0');
  await Promise.all([aContext.close(), bContext.close()]);
});
