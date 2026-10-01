import { expect, test } from '@playwright/test';
// 실제 설치 Chrome으로 제품 컴포넌트를 조작한다. 실패 콜백을 주입한 컴포넌트 검사로,
// 원격 Supabase 또는 실제 HTTP·SQL E2E와 구분한다.
test('관리 영향 수와 휴관 목록 실패는 저장을 막고 명시적 재시도로 복구한다', async ({page}) => {
  await page.goto('/tools/special-rooms/new');
  await page.getByLabel('예약표 이름').waitFor();
  await page.evaluate(async () => {
    const path = '/design/feature-reviews/2026-10-01-special-rooms/admin-recovery-harness.jsx';
    (await import(/* @vite-ignore */ path)).mount();
  });
  const info = page.locator('section').filter({has:page.getByRole('heading',{name:'예약표 정보',exact:true})});
  const closure = page.locator('section').filter({has:page.getByRole('heading',{name:'휴관',exact:true})});
  await info.getByLabel('하루 교시 수').selectOption('8');
  await expect(info.getByRole('button',{name:'저장',exact:true})).toBeDisabled();
  await expect(info.getByText('영향받는 예약 수를 확인하지 못했습니다. 다시 확인한 뒤 저장해 주세요.')).toBeVisible();
  await info.getByRole('button',{name:'영향 수 다시 확인'}).click();
  await expect(info.getByText(/9교시 예약 1건/)).toBeVisible();
  await info.getByRole('button',{name:'저장',exact:true}).click();
  await expect(page.locator('main[data-saved="yes"]')).toHaveCount(1);
  await closure.getByRole('button',{name:'휴관 목록 다시 확인'}).click();
  await expect(closure.getByText('막아 둔 날이 없습니다.')).toBeVisible();
  await closure.getByLabel('시작 날짜').fill('2026-10-05');
  await expect(closure.getByRole('button',{name:'휴관 추가',exact:true})).toBeDisabled();
  await expect(closure.getByText('영향받는 예약 수를 확인하지 못했습니다. 다시 확인한 뒤 추가해 주세요.')).toBeVisible();
  await closure.getByRole('button',{name:'영향 수 다시 확인'}).click();
  await expect(closure.getByText(/이미 예약 1건/)).toBeVisible();
  await closure.getByRole('button',{name:'휴관 추가',exact:true}).click();
  await expect(page.locator('main[data-added="yes"]')).toHaveCount(1);
});
