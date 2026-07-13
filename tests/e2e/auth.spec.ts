import { expect, test, type Page } from '@playwright/test';
import { startGuest } from './helpers';

const email = `linked-${Date.now()}@example.com`;

async function callbackUrl(page: Page) {
  return page.evaluate(() => sessionStorage.getItem('mercenary-test-callback'));
}

async function linkCurrentGuest(page: Page, address: string) {
  await page.getByRole('button', { name: /계정 관리/ }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole('button', { name: '이메일 계정 연결' }).click();
  await page.getByRole('textbox', { name: '이메일' }).fill(address);
  await page.getByRole('button', { name: '확인 링크 보내기' }).click();
  await expect(page.getByRole('heading', { name: '이메일 확인 대기' })).toBeVisible();
  return callbackUrl(page);
}

test('signed-out users explicitly choose guest start', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('auth-entry')).toBeVisible();
  await expect(page.getByTestId('app-shell')).toHaveCount(0);
  await page.waitForTimeout(250);
  await expect(page.getByTestId('auth-entry')).toBeVisible();
  await page.getByTestId('start-guest').dblclick();
  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.getByRole('button', { name: /계정 관리, 게스트 계정/ })).toBeVisible();
  await expect(page.getByTestId('mercenary-card')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('lobby-ready')).toBeVisible();
  await expect(page.getByTestId('auth-entry')).toHaveCount(0);
});

test('guest linking keeps the same account and supports recovery in another context', async ({ browser }) => {
  const firstContext = await browser.newContext(), first = await firstContext.newPage();
  await startGuest(first);
  const before = await first.evaluate(() => JSON.parse(localStorage.getItem('mercenary-test-auth-session')!).userId as string);
  const displayName = await first.getByTestId('lobby-ready').textContent();
  const link = await linkCurrentGuest(first, email);
  await expect(first.getByRole('button', { name: /메일 다시 보내기 \(60초\)/ })).toBeDisabled();
  expect(link).toMatch(/^\/auth\/callback\?test_code=/);
  await first.goto(link!);
  await expect(first).toHaveURL(/\/account$/);
  await expect(first.getByRole('heading', { name: '이메일 계정' })).toBeVisible();
  const after = await first.evaluate(() => JSON.parse(localStorage.getItem('mercenary-test-auth-session')!).userId as string);
  expect(after).toBe(before);
  await first.getByRole('button', { name: '계정 화면 닫기' }).click();
  await first.getByTestId('bottom-navigation').locator('[data-tab="mercenaries"]').click();
  await expect(first.getByTestId('mercenary-card')).toHaveCount(5);
  await expect(first.locator('.collection-portrait em')).toHaveCount(3);

  const secondContext = await browser.newContext(), second = await secondContext.newPage();
  await second.goto('/');
  await second.getByRole('button', { name: '이메일로 로그인' }).click();
  await second.getByLabel('이메일').fill(email);
  await second.getByRole('button', { name: '로그인 링크 보내기' }).click();
  await expect(second.getByRole('heading', { name: '로그인 메일을 확인해 주세요.' })).toBeVisible();
  const recovery = await callbackUrl(second); expect(recovery).toBeTruthy();
  await second.goto(recovery!);
  await expect(second).toHaveURL(/\/lobby$/);
  await expect(second.getByTestId('lobby-ready')).toHaveText(displayName!);
  await second.getByTestId('bottom-navigation').locator('[data-tab="mercenaries"]').click();
  await expect(second.getByTestId('mercenary-card')).toHaveCount(5);
  await second.getByTestId('bottom-navigation').locator('[data-tab="lobby"]').click();
  await second.getByRole('button', { name: /봇 대전/ }).click();
  await expect(second.locator('.board')).toBeVisible();
  await Promise.all([firstContext.close(), secondContext.close()]);
});

test('permanent logout clears account UI and does not create a new guest', async ({ page }) => {
  await startGuest(page);
  const link = await linkCurrentGuest(page, `logout-${Date.now()}@example.com`);
  await page.goto(link!);
  await expect(page.getByRole('heading', { name: '이메일 계정' })).toBeVisible();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('로그아웃하시겠습니까');
  await page.getByRole('alertdialog').getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('auth-entry')).toBeVisible();
  await expect(page.getByTestId('mercenary-card')).toHaveCount(0);
  await page.waitForTimeout(250);
  await expect(page.getByTestId('auth-entry')).toBeVisible();
});

test('guest account switching requires an explicit destructive confirmation', async ({ page }) => {
  await startGuest(page);
  await page.getByRole('button', { name: /계정 관리/ }).click();
  await page.getByRole('button', { name: '다른 계정으로 전환' }).click();
  const warning = page.getByRole('alertdialog');
  await expect(warning).toContainText('현재 게스트 진행을 포기하시겠습니까');
  await expect(warning.getByRole('button', { name: '취소' })).toBeFocused();
  await warning.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('heading', { name: '게스트 계정' })).toBeVisible();
  await page.getByRole('button', { name: '다른 계정으로 전환' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '게스트 진행 포기' }).click();
  await expect(page.getByTestId('auth-entry')).toBeVisible();
  await page.getByRole('button', { name: '이메일로 로그인' }).click();
  await expect(page.getByRole('heading', { name: '이메일 로그인' })).toBeVisible();
});

test('expired callback is sanitized and offers a safe restart', async ({ page }) => {
  await page.goto(`/auth/callback?test_code=${crypto.randomUUID()}#access_token=not-real`);
  await expect(page).toHaveURL(/\/auth\/callback$/);
  await expect(page.getByTestId('auth-callback')).toContainText('새 링크를 요청해 주세요');
  await page.getByRole('button', { name: '새 로그인 링크 요청' }).click();
  await expect(page.getByTestId('auth-entry')).toBeVisible();
});

test('email sign-in does not create an unregistered permanent account', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '이메일로 로그인' }).click();
  await page.getByRole('textbox', { name: '이메일' }).fill(`missing-${Date.now()}@example.com`);
  await page.getByRole('button', { name: '로그인 링크 보내기' }).click();
  await expect(page.getByRole('heading', { name: '로그인 메일을 확인해 주세요.' })).toBeVisible();
  expect(await callbackUrl(page)).toBeNull();
  await page.reload();
  await expect(page.getByTestId('auth-entry')).toBeVisible();
});
