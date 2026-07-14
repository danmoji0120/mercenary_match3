import { expect, test } from '@playwright/test';
import { startGuest } from './helpers';

test('collection search, filters, detail route, and focus restoration', async ({ page }) => {
  await startGuest(page, '/mercenaries');
  await expect(page.getByText('보유 5명')).toBeVisible();
  await expect(page.getByTestId('mercenary-card')).toHaveCount(5);
  await expect(page.locator('.collection-portrait em')).toHaveCount(3);
  await expect(page.locator('.collection-grid')).not.toContainText('반격 태세를 갖추고');

  await page.getByPlaceholder('이름·설명·태그 검색').fill('클라리스');
  await expect(page.getByTestId('mercenary-card')).toHaveCount(1);
  await page.getByPlaceholder('이름·설명·태그 검색').fill('없는 용병');
  await expect(page.getByTestId('mercenary-empty')).toContainText('조건에 맞는 용병이 없습니다');
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await expect(page.getByTestId('mercenary-card')).toHaveCount(5);

  await page.getByLabel('등급 필터').selectOption('SR');
  await expect(page.getByTestId('mercenary-card')).toHaveCount(5);
  await page.getByLabel('등급 필터').selectOption('all');
  await page.getByLabel('역할 필터').selectOption('support');
  await expect(page.getByTestId('mercenary-card')).toHaveCount(3);
  await page.getByLabel('역할 필터').selectOption('versatile');
  await expect(page.getByTestId('mercenary-card')).toHaveCount(5);
  await page.getByLabel('역할 필터').selectOption('all');
  await page.getByLabel('정렬').selectOption('name');
  const sortedNames = await page.locator('.collection-card-copy strong').allTextContents();
  expect(sortedNames).toEqual([...sortedNames].sort((a, b) => a.localeCompare(b, 'ko-KR')));
  const yuria = page.getByTestId('mercenary-card').filter({ hasText: '유리아' });
  await yuria.click();
  await expect(page).toHaveURL(/\/mercenaries\/yuria_counter_sword$/);
  const detail = page.getByTestId('mercenary-detail');
  await expect(detail).toContainText('반격검사 유리아');
  await expect(detail).toContainText('액티브');
  await expect(detail).toContainText('지원 효과');
  await expect(detail.locator('img, .character-portrait-fallback')).toBeVisible();
  await expect(detail).not.toContainText('yuria_counter_sword');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/mercenaries$/);
  await expect(yuria).toBeFocused();
});

test('detail URLs refresh and invalid characters safely return to collection', async ({ page }) => {
  await startGuest(page, '/mercenaries/yuria_counter_sword');
  await expect(page.getByTestId('mercenary-detail')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('mercenary-detail')).toContainText('유리아');
  await page.getByRole('button', { name: '편성에서 보기' }).click();
  await expect(page).toHaveURL(/\/mercenaries\/loadout$/);
  await expect(page.getByRole('button', { name: /유리아.*상세에서 선택한 용병/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('mercenary-detail')).toBeVisible();
  await page.goto('/mercenaries/not-a-character');
  await expect(page).toHaveURL(/\/mercenaries$/);
  await expect(page.getByTestId('screen-mercenaries').getByRole('heading', { name: '용병 보관함' })).toBeVisible();
});

test('loadout is separate, protects dirty draft, saves, and updates lobby', async ({ page }) => {
  await startGuest(page);
  await page.getByTestId('edit-loadout').click();
  await expect(page).toHaveURL(/\/mercenaries\/loadout$/);
  await expect(page.getByTestId('bottom-navigation')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(3);

  await page.getByRole('tab', { name: /전투원/ }).click();
  await page.locator('.loadout-candidate').filter({ hasText: '클라리스' }).click();
  await page.getByRole('tab', { name: /지원 1/ }).click();
  await page.locator('.loadout-candidate').filter({ hasText: '에다' }).click();
  await expect(page.getByText('저장하지 않은 변경')).toBeVisible();
  await expect(page.getByTestId('save-loadout')).toBeEnabled();
  await page.goBack();
  await expect(page.getByRole('alertdialog')).toContainText('저장하지 않고 나가시겠습니까');
  await page.getByRole('button', { name: '계속 편집' }).click();
  await expect(page).toHaveURL(/\/mercenaries\/loadout$/);
  await page.getByTestId('save-loadout').click();
  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.locator('.loadout-saved-toast')).toContainText('출전 편성을 저장했습니다');
  await expect(page.locator('.home-loadout-summary')).toContainText('클라리스');
  await expect(page.locator('.home-loadout-summary')).toContainText('에다');

  await page.getByTestId('bottom-navigation').locator('[data-tab="mercenaries"]').click();
  await expect(page.getByTestId('mercenary-card').filter({ hasText: '클라리스' })).toContainText('전투원');
  await expect(page.getByTestId('mercenary-card').filter({ hasText: '에다' })).toContainText('지원 1');
  await page.getByTestId('bottom-navigation').locator('[data-tab="lobby"]').click();

  await page.getByRole('button', { name: /봇 대전/ }).click();
  await expect(page.locator('.combat-summary.self')).toContainText('클라리스');
  await page.locator('details.debug').evaluate((node: HTMLDetailsElement) => { node.open = true });
  await page.getByTestId('debug-win').click();
  await page.getByTestId('return-lobby').click();
  await expect(page).toHaveURL(/\/lobby$/);

  await page.getByTestId('edit-loadout').click();
  await page.getByRole('tab', { name: /전투원/ }).click();
  await page.locator('.loadout-candidate').filter({ hasText: '유리아' }).click();
  await page.getByRole('button', { name: '취소' }).click();
  await page.getByRole('button', { name: '변경 폐기' }).click();
  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.locator('.home-loadout-summary')).toContainText('클라리스');
});

test('save failure and version conflict keep the local draft', async ({ page }) => {
  await startGuest(page, '/mercenaries/loadout');
  await page.getByRole('tab', { name: /전투원/ }).click();
  await page.locator('.loadout-candidate').filter({ hasText: '클라리스' }).click();
  await page.route('**/api/account/loadout', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  await page.getByTestId('save-loadout').click();
  await expect(page.getByRole('alert')).toContainText('변경 내용은 이 화면에 유지됩니다');
  await expect(page.getByTestId('save-loadout')).toBeEnabled();
  await page.unroute('**/api/account/loadout');
  await page.route('**/api/account/loadout', (route) => route.fulfill({ status: 409, contentType: 'application/json', body: '{}' }));
  await page.getByTestId('save-loadout').click();
  await expect(page.getByRole('alert')).toContainText('최신 편성을 확인하세요');
  await expect(page.getByTestId('save-loadout')).toBeEnabled();
});
