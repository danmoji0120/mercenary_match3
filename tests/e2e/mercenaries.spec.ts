import { expect, test } from '@playwright/test';
import { startGuest } from './helpers';

test('development tools grant 79 characters and update currencies immediately', async ({
  page,
}) => {
  await startGuest(page, '/mercenaries');
  await expect(page.getByTestId('mercenary-card')).toHaveCount(5);
  await page.getByTestId('open-dev-tools').click();
  await page.getByTestId('grant-representative-characters').click();
  await expect(page.getByTestId('development-tools').getByRole('status')).toContainText(
    '74명을 지급했습니다.',
  );
  await page.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByTestId('mercenary-card')).toHaveCount(79);
  await page.getByTestId('open-dev-tools').click();
  await page.getByTestId('currency-ui-preview').click();
  await expect(page.getByRole('button', { name: /계약석 100/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /골드 10,000/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /계약석 100/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /골드 10,000/ })).toBeVisible();
});

test('collection search, filters, sorting, detail, and focus restoration', async ({ page }) => {
  await startGuest(page, '/mercenaries');
  await expect(page.getByText('보유 5명')).toBeVisible();
  await expect(page.getByTestId('mercenary-card')).toHaveCount(5);
  await expect(page.locator('.collection-portrait em')).toHaveCount(3);
  await page.getByPlaceholder('이름·설명·태그 검색').fill('클라리스');
  await expect(page.getByTestId('mercenary-card')).toHaveCount(1);
  await page.getByPlaceholder('이름·설명·태그 검색').fill('없는 용병');
  await expect(page.getByText('조건에 맞는 용병이 없습니다.')).toBeVisible();
  await page.locator('.empty-state').getByRole('button', { name: '필터 초기화' }).click();
  await expect(page.getByTestId('mercenary-card')).toHaveCount(5);
  await page.getByLabel('등급 필터').selectOption('SR');
  await expect(page.getByTestId('mercenary-card')).toHaveCount(5);
  await page.getByLabel('등급 필터').selectOption('all');
  await page.getByLabel('역할 필터').selectOption('ATTACK');
  expect(await page.getByTestId('mercenary-card').count()).toBeGreaterThan(0);
  await page.getByLabel('역할 필터').selectOption('all');
  await page.getByLabel('정렬').selectOption('name');
  const sorted = await page.locator('.collection-card-copy strong').allTextContents();
  expect(sorted).toEqual([...sorted].sort((a, b) => a.localeCompare(b, 'ko-KR')));
  const yuria = page.getByTestId('mercenary-card').filter({ hasText: '유리아' });
  await yuria.click();
  await expect(page).toHaveURL(/\/mercenaries\/yuria_counter_sword$/);
  const detail = page.getByTestId('mercenary-detail');
  await expect(detail).toContainText('반격검사 유리아');
  await expect(detail).not.toContainText('yuria_counter_sword');
  await detail.getByRole('tab', { name: '액티브' }).click();
  await expect(detail.locator('.mercenary-ability')).toBeVisible();
  await detail.getByRole('tab', { name: '지원' }).click();
  await expect(detail.locator('.mercenary-ability')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/mercenaries$/);
  await expect(yuria).toBeFocused();
});

test('detail URL refresh and invalid character fallback', async ({ page }) => {
  await startGuest(page, '/mercenaries/yuria_counter_sword');
  await expect(page.getByTestId('mercenary-detail')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('mercenary-detail')).toContainText('유리아');
  await page.getByRole('button', { name: '편성에서 보기' }).click();
  await expect(page).toHaveURL(/\/mercenaries\/loadout$/);
  await page.goBack();
  await expect(page.getByTestId('mercenary-detail')).toBeVisible();
  await page.goto('/mercenaries/not-a-character');
  await expect(page).toHaveURL(/\/mercenaries$/);
});

test('loadout protects a dirty draft, saves, and updates lobby', async ({ page }) => {
  await startGuest(page);
  await page.getByTestId('edit-loadout').click();
  await expect(page).toHaveURL(/\/mercenaries\/loadout$/);
  await expect(page.getByRole('tab')).toHaveCount(3);
  await page.getByRole('tab', { name: /전투원/ }).click();
  await page.locator('.loadout-candidate').filter({ hasText: '클라리스' }).click();
  await expect(page.getByText('저장하지 않은 변경')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('alertdialog')).toContainText('저장하지 않고');
  await page.getByRole('button', { name: '계속 편집' }).click();
  await page.getByTestId('save-loadout').click();
  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.locator('.loadout-saved-toast')).toContainText('출전 편성을 저장했습니다.');
  await expect(page.locator('.home-loadout-summary')).toContainText('클라리스');
  await page.getByTestId('bot-match').click();
  await expect(page.locator('.combat-summary.self')).toContainText('클라리스');
  await page.locator('details.debug').evaluate((node: HTMLDetailsElement) => {
    node.open = true;
  });
  await page.getByTestId('debug-win').click();
  await page.getByTestId('return-lobby').click();
  await expect(page).toHaveURL(/\/lobby$/);
});

test('save failure keeps the local draft', async ({ page }) => {
  await startGuest(page, '/mercenaries/loadout');
  await page.getByRole('tab', { name: /전투원/ }).click();
  await page.locator('.loadout-candidate').filter({ hasText: '클라리스' }).click();
  await page.route('**/api/account/loadout', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );
  await page.getByTestId('save-loadout').click();
  await expect(page.getByRole('alert')).toContainText('변경 내용은 이 화면에 유지됩니다.');
  await expect(page.getByTestId('save-loadout')).toBeEnabled();
});
