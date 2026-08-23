import { expect, test } from '@playwright/test';

test.describe('진행 중인 업무', () => {
  test('홈은 진행 요약으로 바뀌지 않고 전체 업무 도구를 그대로 보여준다', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: '전체 업무 도구 (10)' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '진행 중인 업무' })).toHaveCount(0);
    await expect(page.getByText('자료 수합', { exact: true })).toBeVisible();
    await expect(page.getByText('특별실 예약', { exact: true })).toBeVisible();
  });

  test('도구 제목은 목록으로, 개별 업무는 관리 화면으로 이동한다', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('schooldoc_data_collect_v1', JSON.stringify([{
        id: 'active-collection',
        ownerId: 'demo-teacher',
        publicToken: 'active-token',
        title: '2학기 수행평가 자료 수합',
        description: '',
        kind: 'custom',
        mode: 'custom',
        status: 'open',
        allowResubmit: true,
        dueAt: '',
        passwordHash: '',
        retentionMonths: 12,
        targets: [],
        submissions: [],
        createdAt: '2026-08-22T10:00:00.000Z',
        updatedAt: '2026-08-22T10:00:00.000Z',
      }]));
    });
    await page.goto('/');
    await page.getByRole('button', { name: '진행 중' }).click();

    await expect(page.getByRole('heading', { name: '진행 중인 업무', exact: true })).toBeVisible();
    await expect(page.getByText('2학기 수행평가 자료 수합')).toBeVisible();

    await page.getByRole('button', { name: '자료 수합 전체 목록으로 이동' }).click();
    await expect(page).toHaveURL(/\/tools\/data-collect$/);

    await page.goto('/');
    await page.getByRole('button', { name: '진행 중' }).click();
    await page.getByRole('button', { name: /2학기 수행평가 자료 수합 자료 수합 관리 화면으로 이동/ }).click();
    await expect(page).toHaveURL(/\/tools\/data-collect\/active-collection$/);
  });

  test('종료한 수합은 숨기고 열린 수합의 지난 기한은 마감 지남으로 표시한다', async ({ page }) => {
    await page.addInitScript(() => {
      const base = {
        ownerId: 'demo-teacher',
        publicToken: 'token',
        description: '',
        kind: 'custom',
        mode: 'fixed',
        allowResubmit: true,
        passwordHash: '',
        retentionMonths: 12,
        sourceFile: undefined,
        targets: [
          { id: 'target-1', rowNumber: 1, label: '김교사', owner: '', personalToken: 'personal-1' },
          { id: 'target-2', rowNumber: 2, label: '이교사', owner: '', personalToken: 'personal-2' },
        ],
        submissions: [{ id: 'submission-1', targetId: 'target-1', revision: 1, decision: 'submitted', note: '', uploadedAt: '2026-08-20T10:00:00.000Z' }],
        createdAt: '2026-08-19T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z',
      };
      localStorage.setItem('schooldoc_data_collect_v1', JSON.stringify([
        { ...base, id: 'open-overdue', title: '기한 지난 업무 계획서', status: 'open', dueAt: '2026-08-21T17:00:00' },
        { ...base, id: 'closed', title: '이미 종료한 수합', status: 'closed', dueAt: '' },
      ]));
    });

    await page.goto('/');
    await page.getByRole('button', { name: '진행 중' }).click();

    const card = page.getByRole('button', { name: /기한 지난 업무 계획서 자료 수합 관리 화면으로 이동/ });
    await expect(card).toContainText('마감 지남');
    await expect(card).toContainText('1/2명 회신');
    await expect(page.getByText('이미 종료한 수합')).toHaveCount(0);

    await card.click();
    await expect(page).toHaveURL(/\/tools\/data-collect\/open-overdue$/);
  });

  test('단건 업무도 반쪽 카드가 아닌 전체 폭 목록 행으로 표시한다', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('schooldoc_data_collect_v1', JSON.stringify([{
        id: 'full-width-row',
        ownerId: 'demo-teacher',
        publicToken: 'full-width-token',
        title: '전체 폭으로 표시할 자료 수합',
        description: '',
        kind: 'custom',
        mode: 'custom',
        status: 'open',
        allowResubmit: true,
        dueAt: '',
        passwordHash: '',
        retentionMonths: 12,
        targets: [],
        submissions: [],
        createdAt: '2026-08-22T10:00:00.000Z',
        updatedAt: '2026-08-22T10:00:00.000Z',
      }]));
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: '진행 중' }).click();

    const group = page.getByRole('button', { name: '자료 수합 전체 목록으로 이동' });
    const item = page.getByRole('button', { name: /전체 폭으로 표시할 자료 수합 자료 수합 관리 화면으로 이동/ });
    const widths = await Promise.all([
      group.evaluate((element) => element.getBoundingClientRect().width),
      item.evaluate((element) => element.getBoundingClientRect().width),
    ]);
    expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 390, height: 780 });
    const overflow = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1);
  });
});
