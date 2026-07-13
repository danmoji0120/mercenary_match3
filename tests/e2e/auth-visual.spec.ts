import { expect, test } from '@playwright/test';
import { startGuest } from './helpers';

test('account entry, linking, permanent status, and warnings fit mobile and desktop frames', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await expect(page.getByTestId('auth-entry')).toBeVisible();
  await testInfo.attach('auth-entry-360x640', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: '이메일로 로그인' }).click();
  await testInfo.attach('email-signin-360x640', { body: await page.screenshot(), contentType: 'image/png' });

  await page.evaluate(() => localStorage.clear());
  await startGuest(page);
  await page.getByRole('button', { name: /계정 관리/ }).click();
  await testInfo.attach('guest-account-360x640', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: '이메일 계정 연결' }).click();
  await expect(page.getByRole('dialog', { name: '이메일로 계정 보호' })).toBeVisible();
  await testInfo.attach('link-dialog-360x640', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('textbox', { name: '이메일' }).fill(`visual-${Date.now()}@example.com`);
  await page.getByRole('button', { name: '확인 링크 보내기' }).click();
  await testInfo.attach('link-pending-360x640', { body: await page.screenshot(), contentType: 'image/png' });
  const callback = await page.evaluate(() => sessionStorage.getItem('mercenary-test-callback'));
  await page.goto(callback!);
  await expect(page.getByRole('heading', { name: '이메일 계정' })).toBeVisible();
  await testInfo.attach('permanent-account-360x640', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: '로그아웃' }).click();
  await testInfo.attach('signout-warning-360x640', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('alertdialog').getByRole('button', { name: '취소' }).click();

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/account');
  const shell = await page.getByTestId('app-shell').boundingBox();
  expect(shell!.width).toBeLessThanOrEqual(541);
  await testInfo.attach('account-desktop-1280x720', { body: await page.screenshot(), contentType: 'image/png' });
});
