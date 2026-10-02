import { expect, test, type Page } from '@playwright/test';

async function mockPublicApi(page: Page) {
  const result = {
    event: { id: 'fake-event', publicToken: 'fake-token', title: '가상 공개 결과', description: '', status: 'open', allowConfirmation: true, allowDispute: true, columns: [{ id: 'math', label: '수학', maxScore: 100, description: '' }] },
    recipient: { id: 'fake-student', studentKey: '1', name: '가상학생', values: { math: 92 }, feedback: '가상 교사 의견', status: 'viewed', updatedAt: '2026-10-01T00:00:00Z' },
  };
  const code = [
    'const value = ' + JSON.stringify({ sessionToken: 'fake-session', result }) + ';',
    'const respond = async () => {',
    '  if (window.apiMode === "expired") throw new Error("조회가 만료되었습니다.");',
    '  if (window.apiMode === "closed") throw new Error("종료된 결과 안내입니다.");',
    '  if (window.apiMode === "null") return null;',
    '  if (window.apiMode === "delay") return new Promise(resolve => { window.releasePending = () => resolve(value); });',
    '  return value;',
    '};',
    'export const loadPublicStudentResultMetadata = async () => ({ title: "가상 공개 결과", description: "", status: "open" });',
    'export const authenticatePublicStudentResult = respond;',
    'export const authenticatePublicStudentResultByToken = respond;',
    'export const refreshPublicStudentResult = respond;',
    'export const confirmPublicStudentResult = respond;',
    'export const disputePublicStudentResult = respond;',
    'export const endPublicStudentResultSession = async () => undefined;',
    'export const studentResultAccessFailure = error => error.message.includes("종료") ? "closed" : error.message.includes("만료") ? "expired" : null;',
  ].join('\n');
  await page.route('**/src/features/studentResults/studentResultsPublicApi.ts*', route => route.fulfill({ contentType: 'text/javascript', body: code }));
  await page.goto('/s/results/fake-token');
}
async function mode(page: Page, value: string) {
  await page.evaluate((value) => { (window as Window & { apiMode?: string }).apiMode = value; }, value);
}
async function release(page: Page) {
  await page.evaluate(() => { (window as Window & { releasePending?: () => void }).releasePending?.(); });
}
async function login(page: Page) {
  await page.getByLabel('성명').fill('가상학생');
  await page.getByLabel('확인번호').fill('4821');
  await page.getByRole('button', { name: '내 결과 조회' }).click();
  await expect(page.getByRole('button', { name: '조회 종료' })).toBeVisible();
}

test('최신 조회 응답이 늦어도 조회 종료 후 개인 결과를 다시 표시하지 않는다', async ({ page }) => {
  await mockPublicApi(page); await login(page); await mode(page, 'delay');
  await page.getByRole('button', { name: '최신 결과 확인' }).click();
  await expect(page.getByRole('button', { name: '새로고침 중' })).toBeVisible();
  await page.getByRole('button', { name: '조회 종료' }).click();
  await release(page);
  await expect(page.getByRole('button', { name: '내 결과 조회' })).toBeEnabled();
  await expect(page.getByText('92 / 100')).toHaveCount(0);
  await expect(page.getByText('가상 교사 의견')).toHaveCount(0);
});
test('확인·이의 제출 응답도 조회 종료 후 무시한다', async ({ page }) => {
  for (const action of ['내용 확인 완료', '이의 제출']) {
    await mockPublicApi(page); await login(page); await mode(page, 'delay');
    if (action === '이의 제출') await page.getByLabel('이의 내용').fill('가상 이의 초안');
    await page.getByRole('button', { name: action }).click();
    await expect(page.getByRole('button', { name: action })).toBeDisabled();
    await page.getByRole('button', { name: '조회 종료' }).click();
    await release(page);
    await expect(page.getByRole('button', { name: '내 결과 조회' })).toBeEnabled();
    await expect(page.getByText('92 / 100')).toHaveCount(0);
  }
});
test('로그인 도중 다른 안내로 이동하면 이전 응답을 새 안내에 표시하지 않는다', async ({ page }) => {
  await mockPublicApi(page); await mode(page, 'delay');
  await page.getByLabel('성명').fill('가상학생');
  await page.getByLabel('확인번호').fill('4821');
  await page.getByRole('button', { name: '내 결과 조회' }).click();
  await expect(page.getByRole('button', { name: '확인 중' })).toBeVisible();
  await page.evaluate(() => {
    history.pushState(null, '', '/s/results/other-token');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('button', { name: '내 결과 조회' })).toBeEnabled();
  await release(page);
  await expect(page.getByText('92 / 100')).toHaveCount(0);
  await expect(page.getByLabel('성명')).toHaveValue('');
});
test('새로고침·확인·이의 제출의 만료는 개인 데이터를 지우고 재조회를 제공한다', async ({ page }) => {
  for (const action of ['최신 결과 확인', '내용 확인 완료', '이의 제출']) {
    await mockPublicApi(page); await login(page); await mode(page, 'expired');
    if (action === '이의 제출') await page.getByLabel('이의 내용').fill('가상 이의 초안');
    await page.getByRole('button', { name: action }).click();
    await expect(page.getByRole('button', { name: '내 결과 조회' })).toBeEnabled();
    await expect(page.getByRole('alert')).toContainText('다시 조회');
    await expect(page.getByText('92 / 100')).toHaveCount(0);
    await expect(page.getByLabel('확인번호')).toHaveValue('');
  }
});
test('개인 링크 세션의 만료는 공용 조회로 이동하고 안내 종료는 잠금 화면을 표시한다', async ({ page }) => {
  await mockPublicApi(page);
  await page.goto('/s/results/fake-token?recipient=fake-personal');
  await expect(page.getByRole('button', { name: '조회 종료' })).toBeVisible();
  await mode(page, 'expired');
  await page.getByRole('button', { name: '최신 결과 확인' }).click();
  await expect(page).toHaveURL(/\/s\/results\/fake-token$/);
  await expect(page.getByRole('alert')).toContainText('다시 조회');
  await mode(page, ''); await login(page); await mode(page, 'closed');
  await page.getByRole('button', { name: '내용 확인 완료' }).click();
  await expect(page.getByRole('heading', { name: '종료된 결과 안내입니다' })).toBeVisible();
  await expect(page.getByText('92 / 100')).toHaveCount(0);
});
test('이의 제출이 처리되지 않으면 초안을 보존한다', async ({ page }) => {
  await mockPublicApi(page); await login(page);
  await page.getByLabel('이의 내용').fill('보존해야 할 가상 이의');
  await mode(page, 'null');
  await page.getByRole('button', { name: '이의 제출' }).click();
  await expect(page.getByRole('alert')).toContainText('제출하지 못했습니다');
  await expect(page.getByLabel('이의 내용')).toHaveValue('보존해야 할 가상 이의');
});

test('브라우저 뒤로·앞으로 및 앱 내부 이동 후 입력·분석·되돌리기 초안을 복원한다', async ({ page }) => {
  await page.goto('/tools/student-results');
  await page.getByRole('button', { name: '새 결과 안내' }).click();
  await page.getByPlaceholder('예: 2학기 수행평가 결과').fill('가상 임시 초안');
  await page.getByLabel('1번 학생 성명').fill('가상학생');
  await page.getByRole('button', { name: '학생 추가', exact: true }).click();
  await page.getByLabel('2번 학생 성명').fill('둘째가상');
  await page.getByRole('button', { name: '2번 학생 삭제' }).click();
  await page.getByTestId('student-results-file-input').setInputFiles({
    name: '가상.csv', mimeType: 'text/csv', buffer: Buffer.from('학번,성명,확인번호,수학/100\n1,파일가상,4821,92\n', 'utf8'),
  });
  await expect(page.getByRole('button', { name: '분석 결과 적용' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/tools\/student-results$/);
  await page.goForward();
  await expect(page.getByPlaceholder('예: 2학기 수행평가 결과')).toHaveValue('가상 임시 초안');
  await expect(page.getByLabel('1번 학생 성명')).toHaveValue('가상학생');
  await expect(page.getByText('이 탭에서 작성하던 내용을 복원했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '분석 결과 적용' })).toBeVisible();
  await page.getByRole('button', { name: '되돌리기', exact: true }).click();
  await expect(page.getByLabel('2번 학생 성명')).toHaveValue('둘째가상');
  await page.getByRole('button', { name: '목록으로' }).click();
  await page.getByRole('button', { name: '저장하지 않고 나가기' }).click();
  await page.getByRole('button', { name: '새 결과 안내' }).click();
  await expect(page.getByPlaceholder('예: 2학기 수행평가 결과')).toHaveValue('');
  await expect(page.getByRole('button', { name: '분석 결과 적용' })).toHaveCount(0);
});

test('이의 초안 확인 대화상자는 키보드 초점과 처리 중 중복 제출을 보호한다', async ({ page }) => {
  await mockPublicApi(page); await login(page);
  await page.getByLabel('이의 내용').fill('가상 이의 초안');
  await page.getByRole('button', { name: '내용 확인 완료' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: '이의 계속 작성' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '확인 창 닫기' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '이의 버리고 확인' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '확인 창 닫기' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '내용 확인 완료' })).toBeFocused();
  await page.getByRole('button', { name: '내용 확인 완료' }).click();
  await mode(page, 'delay');
  await dialog.getByRole('button', { name: '이의 버리고 확인' }).click();
  await expect(dialog).toHaveAttribute('aria-busy', 'true');
  await expect(dialog.getByRole('button', { name: '확인 중' })).toBeDisabled();
  await page.keyboard.press('Tab');
  await expect(dialog).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await release(page);
  await expect(dialog).toHaveCount(0);
});
