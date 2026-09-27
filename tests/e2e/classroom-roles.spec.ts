import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  defaultRoleState,
  parseRoleRoster,
  roleMonthRange,
  roleToday,
  roleWeekDates,
} from "../../supabase/functions/_shared/classroomRoles";
const root = "/tools/classroom-roles";
const demoKey = "schooldoc_classroom_roles_demo_v1";
const expectedTileOrder = [
  "학생 역할 배정",
  "운영 설정",
  "역할 목록",
  "오늘의 실천판",
  "실천 기록",
  "역할 교체",
];
async function seed(
  page: Page,
  assigned = false,
  rosterText = "1 가상하늘\n2 가상바다\n3 가상하늘",
) {
  const state = defaultRoleState();
  state.roster = parseRoleRoster(rosterText);
  state.settings.schoolDays = [0, 1, 2, 3, 4, 5, 6];
  state.roles.forEach((r) => (r.weekdays = [0, 1, 2, 3, 4, 5, 6]));
  if (assigned)
    state.periods = [
      {
        id: crypto.randomUUID(),
        ...roleMonthRange(roleToday().slice(0, 7)),
        students: structuredClone(state.roster),
        roles: structuredClone(state.roles),
        assignments: Object.fromEntries(
          state.roster.map((s, i) => [s.id, state.roles[i % state.roles.length].id]),
        ),
      },
    ];
  const board = {
    id: crypto.randomUUID(),
    public_token: crypto.randomUUID(),
    version: 1,
    state,
  };
  await page.goto(root);
  await page.evaluate(
    ({ key, board }) => {
      localStorage.setItem(key, JSON.stringify(board));
      localStorage.setItem(`${key}_records`, "[]");
    },
    { key: demoKey, board },
  );
  await page.reload();
  return board;
}
async function confirmAssignment(page: Page) {
  await page.getByRole("button", { name: "배정 확인", exact: true }).click();
  const review = page.getByRole("dialog", { name: "배정 확인" });
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "확정하기" }).click();
}
test("홈은 오늘 현황과 6개 기능이며 학생 타일이 아니다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await expect(
    page.getByRole("heading", { name: "1인 1역", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "1인 1역 기능" }).getByRole("link"),
  ).toHaveCount(6);
  await expect(
    page
      .getByRole("region", { name: "1인 1역 기능" })
      .getByRole("heading", { level: 3 }),
  ).toHaveText(expectedTileOrder);
  await expect(
    page.getByRole("region", { name: "오늘의 간단한 현황" }),
  ).toContainText("오늘 배정된 역할이 없습니다");
  await expect(page.getByRole("button", { name: /가상하늘/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("모바일에서도 배정·운영 설정·역할 목록이 먼저 나오고 각 화면으로 이동한다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  const menu = page.getByRole("region", { name: "1인 1역 기능" });
  await expect(menu.getByRole("heading", { level: 3 })).toHaveText(
    expectedTileOrder,
  );
  const paths = ["assign", "settings", "roles", "board", "records", "rotate"];
  for (const [index, title] of expectedTileOrder.entries()) {
    const link = menu.getByRole("link").filter({
      has: page.getByRole("heading", { name: title, exact: true }),
    });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(`${root}/${paths[index]}`);
    await expect(
      page.getByRole("heading", { level: 1, name: title, exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "1인 1역 홈", exact: true }).click();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("teacher-home-mobile.png"),
    fullPage: true,
  });
});

test("역할별 다중 선택·정원 제한·역할 이동과 저장", async ({
  page,
}) => {
  const board = await seed(page);
  const [first, second] = board.state.roles;
  await page.goto(`${root}/assign`);
  await expect(
    page.getByRole("list", { name: "배정할 학생 명단" }).getByRole("listitem"),
  ).toHaveCount(3);
  await expect(
    page.getByRole("textbox", { name: "학생 명단", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  const add = (number: number, name: string) => page.getByRole("button", { name: `${number}번 ${name} 추가` });
  await add(1, "가상하늘").click();
  await add(2, "가상바다").click();
  await expect(page.getByRole("button", { name: "1번 가상하늘 배정 해제" })).toBeVisible();
  await expect(add(3, "가상하늘")).toBeDisabled();
  await page.getByRole("button", { name: "정원 변경" }).click();
  await page.locator('[data-role-desktop-picker]').getByLabel(`${first.name} 정원`, { exact: true }).fill("1");
  await expect(page.getByRole("alert")).toContainText("이미 선택한 2명");
  await expect(
    page.locator('[data-role-desktop-picker]').getByLabel(`${first.name} 정원`, { exact: true }),
  ).toHaveValue("2");
  await page
    .getByRole("button", { name: `${second.name} 학생 선택`, exact: true })
    .click();
  await expect(page.locator('[data-role-desktop-picker]').getByLabel("학생 범위")).toHaveValue("all");
  await expect(page.getByRole("button", { name: "1번 가상하늘 역할 이동" })).toContainText(first.name);
  await page.getByRole("button", { name: "2번 가상바다 역할 이동" }).click();
  const move = page.getByRole("dialog", { name: "역할 이동" });
  await expect(move).toContainText(`${first.name} → ${second.name}`);
  await page.keyboard.press("Escape");
  await expect(move).not.toBeVisible();
  await expect(page.getByRole("button", { name: "2번 가상바다 역할 이동" })).toBeFocused();
  await page.getByRole("button", { name: "2번 가상바다 역할 이동" }).click();
  await move.getByRole("button", { name: "옮기기" }).click();
  await expect(page.getByRole("button", { name: "2번 가상바다 배정 해제" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: `${first.name} 학생 선택`, exact: true }),
  ).toContainText("1/2");
  await page.locator('[data-role-desktop-picker]').getByLabel("학생 범위").selectOption("unassigned");
  await add(3, "가상하늘").click();
  await expect(
    page.getByRole("button", { name: "배정 확인", exact: true }),
  ).toHaveAttribute("aria-disabled", "false");
  await page.getByRole("button", { name: "명단 수정", exact: true }).click();
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await page.getByRole("button", { name: `${second.name} 학생 선택`, exact: true }).click();
  await expect(page.getByRole("button", { name: "3번 가상하늘 배정 해제" })).toBeVisible();
  const reviewButton = page.getByRole("button", { name: "배정 확인", exact: true });
  await reviewButton.click();
  await expect(page.getByRole("dialog", { name: "배정 확인" })).toContainText(second.name);
  await page.keyboard.press("Escape");
  await expect(reviewButton).toBeFocused();
  await confirmAssignment(page);
  await expect(page).toHaveURL(`${root}/board`);
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    demoKey,
  );
  expect(saved.state.periods[0].assignments).toEqual({
    [board.state.roster[0].id]: first.id,
    [board.state.roster[1].id]: second.id,
    [board.state.roster[2].id]: second.id,
  });
});

test("명단 수정은 취소할 수 있고 제외된 학생만 초안 배정에서 빠진다", async ({
  page,
}) => {
  await seed(page);
  await page.goto(`${root}/assign`);
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await page.getByRole("button", { name: "1번 가상하늘 추가" }).click();
  await page.getByRole("button", { name: "3번 가상하늘 추가" }).click();
  await page.getByRole("button", { name: "명단 수정", exact: true }).click();
  await page.getByRole("button", { name: "명단 수정", exact: true }).click();
  await expect(page.getByLabel("학생 명단", { exact: true })).toBeFocused();
  await page.getByLabel("학생 명단", { exact: true }).fill("1 변경된가상학생");
  await page.getByRole("button", { name: "수정 취소", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "배정할 학생 명단" }).getByRole("listitem"),
  ).toHaveCount(3);
  await page.getByRole("button", { name: "명단 수정", exact: true }).click();
  await page
    .getByLabel("학생 명단", { exact: true })
    .fill("1 가상하늘\n2 가상바다");
  await page.getByRole("button", { name: "명단 적용", exact: true }).click();
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await expect(
    page.getByRole("button", { name: "1번 가상하늘 배정 해제", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "3번 가상하늘 배정 해제", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "2번 가상바다 추가" })).toBeVisible();
});

test("30명 명단의 모바일 선택·검색·키보드·접근성과 데스크톱 배치", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const board = await seed(
    page,
    false,
    Array.from(
      { length: 30 },
      (_, i) => `${i + 1} 가상학생${String(i + 1).padStart(2, "0")}`,
    ).join("\n"),
  );
  await page.goto(`${root}/assign`);
  await expect(
    page.getByRole("list", { name: "배정할 학생 명단" }).getByRole("listitem"),
  ).toHaveCount(6);
  await page.getByRole("button", { name: "전체 명단 보기" }).click();
  await expect(page.getByRole("list", { name: "배정할 학생 명단" }).getByRole("listitem")).toHaveCount(30);
  await page.getByRole("button", { name: "명단 접기" }).click();
  await expect(page.getByRole("list", { name: "배정할 학생 명단" }).getByRole("listitem")).toHaveCount(6);
  await page.screenshot({
    path: test.info().outputPath("roster-confirmation-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  const firstStudent = page.getByRole("checkbox", {
    name: "1번 가상학생01 선택",
    exact: true,
  });
  expect((await firstStudent.boundingBox())?.y).toBeLessThan(844);
  const mobilePanel = page.getByRole("region", { name: "담당 학생 선택" });
  const firstTwo = await mobilePanel.locator('[data-assignment-state="unassigned"]').first().boundingBox();
  const second = await mobilePanel.locator('[data-assignment-state="unassigned"]').nth(1).boundingBox();
  expect(Math.abs(firstTwo!.y - second!.y)).toBeLessThanOrEqual(1);
  expect(firstTwo!.x).toBeLessThan(second!.x);
  await expect(mobilePanel.getByText("미배정", { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 650));
  const mobileHeader = await page.locator('[data-role-mobile-header]').boundingBox();
  const mobileActions = await page.locator('[data-role-mobile-actions]').boundingBox();
  expect(mobileHeader!.y).toBeGreaterThanOrEqual(0);
  expect(mobileHeader!.y).toBeLessThan(2);
  expect(mobileActions!.y + mobileActions!.height).toBeLessThanOrEqual(844);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: test.info().outputPath("role-assignment-mobile-full.png"),
    fullPage: true,
  });
  await page.screenshot({ path: test.info().outputPath("role-assignment-mobile-viewport.png") });
  const mobileRoleTrigger = page.getByRole("button", { name: /역할 변경/ });
  await mobileRoleTrigger.click();
  await page
    .getByRole("button", {
      name: `${board.state.roles[0].name} 학생 선택`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", { name: "담당 학생 선택", exact: true }),
  ).toBeFocused();
  const first = firstStudent;
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  await page.getByRole("region", { name: "담당 학생 선택" }).getByLabel("학생 찾기").fill("학생30");
  await page
    .getByRole("checkbox", { name: "30번 가상학생30 선택", exact: true })
    .check();
  await page.getByRole("region", { name: "담당 학생 선택" }).getByLabel("학생 찾기").fill("");
  await expect(first).toBeChecked();
  await page.getByRole("group", { name: "학생 범위" }).getByRole("button", { name: "배정 가능" }).click();
  await expect(mobilePanel.locator('[data-assignment-state="current"]')).toHaveCount(2);
  await expect(mobilePanel.locator('[data-assignment-state="unassigned"]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const audit = await new AxeBuilder({ page })
    .include('[aria-label="역할별 학생 배정"]')
    .analyze();
  expect(audit.violations).toEqual([]);
  await page
    .getByRole("region", { name: "담당 학생 선택", exact: true })
    .screenshot({ path: test.info().outputPath("role-students-mobile.png") });
  await mobileRoleTrigger.click();
  await expect(page.getByRole("dialog", { name: "역할 선택" })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: `${board.state.roles[0].name} 학생 선택`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("dialog", { name: "역할 선택" }).getByRole("button", { name: "닫기" }).click();
  await expect(mobileRoleTrigger).toBeFocused();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('[data-role-mobile-actions]')).toBeVisible();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.locator('[data-role-mobile-header]')).toBeVisible();
  await expect(page.locator('[data-role-desktop-picker]')).toBeHidden();
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(firstStudent).toBeHidden();
  await expect(page.locator('[data-role-desktop-picker]').getByRole("button", { name: "2번 가상학생02 추가" })).toBeVisible();
  await expect(page.locator('[data-role-desktop-picker]').getByRole("button", { name: "1번 가상학생01 배정 해제" })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("role-assignment-desktop-full.png"),
    fullPage: true,
  });
  await page
    .getByRole("region", { name: "역할별 학생 배정", exact: true })
    .screenshot({ path: test.info().outputPath("role-students-desktop.png") });
});

test("모바일에서 정원이 찬 역할을 떠나 남은 학생을 배정하고 확인한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const board = await seed(page);
  await page.goto(`${root}/assign`);
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await page.getByRole("checkbox", { name: "1번 가상하늘 선택" }).check();
  await page.getByRole("checkbox", { name: "2번 가상바다 선택" }).check();
  await expect(page.getByRole("region", { name: "담당 학생 선택" }).getByRole("checkbox")).toHaveCount(2);
  await page.locator('[data-role-mobile-actions]').getByRole("button", { name: "미배정 1명 찾기" }).click();
  await expect(page.locator('[data-role-mobile-header]')).toContainText(board.state.roles[1].name);
  const lastStudent = page.getByRole("checkbox", { name: "3번 가상하늘 선택" });
  await expect(lastStudent).toBeFocused();
  await lastStudent.check();
  await expect(page.locator('[data-role-mobile-actions]').getByRole("button", { name: "배정 확인" })).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath("role-assignment-mobile-complete.png") });
  const reviewButton = page.locator('[data-role-mobile-actions]').getByRole("button", { name: "배정 확인" });
  await reviewButton.click();
  await expect(page.getByRole("dialog", { name: "배정 확인" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reviewButton).toBeFocused();
  await confirmAssignment(page);
  await expect(page).toHaveURL(`${root}/board`);
});

test("모바일 빈 명단에서 역할을 추가하고 배정할 수 있다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const board = await seed(page, false, "");
  board.state.roles = [];
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: demoKey, value: board });
  await page.goto(`${root}/assign`);
  await page.getByLabel("학생 명단", { exact: true }).fill("1 가상하늘\n2 가상바다");
  await page.getByRole("button", { name: "명단 적용" }).click();
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await expect(page.getByRole("region", { name: "담당 학생 선택" })).toContainText("역할을 먼저 추가해 주세요.");
  await page.getByRole("button", { name: "역할 변경" }).click();
  const dialog = page.getByRole("dialog", { name: "역할 선택" });
  await dialog.getByText("+ 역할 추가", { exact: true }).click();
  await dialog.getByLabel("새 역할 이름").fill("함께 정리");
  await dialog.getByRole("button", { name: "역할 추가", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('[data-role-mobile-header]')).toContainText("함께 정리");
  await page.getByRole("button", { name: "정원 변경" }).click();
  await page.getByRole("region", { name: "담당 학생 선택" }).getByLabel("함께 정리 정원").fill("2");
  await page.getByRole("checkbox", { name: "1번 가상하늘 선택" }).check();
  await page.getByRole("checkbox", { name: "2번 가상바다 선택" }).check();
  await expect(page.locator('[data-role-mobile-actions]').getByRole("button", { name: "배정 확인" })).toBeEnabled();
});

test("모바일 전체 학생에서 다른 역할 담당자를 확인 후 이동한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const board = await seed(page);
  await page.goto(`${root}/assign`);
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await page.getByRole("checkbox", { name: "1번 가상하늘 선택" }).check();
  await page.getByRole("button", { name: `다음 역할: ${board.state.roles[1].name}` }).click();
  await expect(page.locator('[data-role-mobile-header]')).toContainText(board.state.roles[1].name);
  await expect(page.getByRole("checkbox", { name: "1번 가상하늘 선택" })).toHaveCount(0);
  await page.getByRole("group", { name: "학생 범위" }).getByRole("button", { name: "전체 학생" }).click();
  const student = page.getByRole("checkbox", { name: "1번 가상하늘 선택" });
  await expect(student.locator("xpath=..")).toContainText(board.state.roles[0].name);
  await student.click();
  const move = page.getByRole("dialog", { name: "역할 이동" });
  await expect(move).toBeVisible();
  await move.getByRole("button", { name: "취소" }).click();
  await expect(student).not.toBeChecked();
  await student.click();
  await move.getByRole("button", { name: "옮기기" }).click();
  await expect(student).toBeChecked();
  await expect(page.locator('[data-role-mobile-header]')).toContainText("1/2");
});

test("23명·18역할에서 PC 탐색과 작업 영역을 구분한다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const board = await seed(page, false, Array.from({ length: 23 }, (_, i) => `${i + 1} 가상학생${i + 1}`).join("\n"));
  await page.goto(`${root}/assign`);
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  const picker = page.locator('[data-role-desktop-picker]');
  const roleList = picker.getByRole("region", { name: "역할 목록" });
  const studentPanel = picker.getByRole("region", { name: "담당 학생 선택" });
  const [left, right] = await Promise.all([roleList.boundingBox(), studentPanel.boundingBox()]);
  expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x + 1);
  expect(left!.width).toBeGreaterThanOrEqual(238);
  expect(right!.width).toBeGreaterThan(left!.width);
  await expect(studentPanel.getByRole("heading", { name: board.state.roles[0].name })).toBeVisible();
  await expect(studentPanel.getByRole("button", { name: "1번 가상학생1 추가" })).toBeVisible();
  await expect(studentPanel.getByText("역할 설명", { exact: true })).toHaveCount(0);
  await studentPanel.getByRole("button", { name: "1번 가상학생1 추가" }).click();
  await studentPanel.getByRole("button", { name: "2번 가상학생2 추가" }).click();
  const selectedRole = roleList.getByRole("button", { name: `${board.state.roles[0].name} 학생 선택` });
  await expect(selectedRole).toHaveAttribute("aria-pressed", "true");
  await roleList.getByRole("button", { name: `${board.state.roles[1].name} 학생 선택` }).click();
  await expect(selectedRole).toContainText("2/2");
  const audit = await new AxeBuilder({ page }).include('[data-role-desktop-picker]').analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("assignment-desktop-23-students.png"), fullPage: true });
  await page.setViewportSize({ width: 1024, height: 768 });
  const [tabletLeft, tabletRight] = await Promise.all([roleList.boundingBox(), studentPanel.boundingBox()]);
  expect(tabletLeft!.x + tabletLeft!.width).toBeLessThanOrEqual(tabletRight!.x + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("assignment-desktop-1024.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(picker).toBeHidden();
  await expect(page.getByRole("button", { name: /역할 변경/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("적은 명단과 60명 명단에도 PC 두 열과 문서 스크롤을 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  for (const count of [3, 60]) {
    await seed(page, false, Array.from({ length: count }, (_, i) => `${i + 1} 가상학생${i + 1}`).join("\n"));
    await page.goto(`${root}/assign`);
    await page.getByRole("button", { name: "다음: 역할 배정" }).click();
    const picker = page.locator('[data-role-desktop-picker]');
    const roleList = picker.getByRole("region", { name: "역할 목록" });
    const studentPanel = picker.getByRole("region", { name: "담당 학생 선택" });
    const [rolesBox, studentsBox] = await Promise.all([roleList.boundingBox(), studentPanel.boundingBox()]);
    expect(rolesBox!.x + rolesBox!.width).toBeLessThanOrEqual(studentsBox!.x + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`assignment-${count}-students.png`), fullPage: true });
  }
});
test("최대 60개 역할과 긴 역할명에서도 목록과 모바일 선택창이 잘리지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const board = await seed(page, false, Array.from({ length: 23 }, (_, i) => `${i + 1} 가상학생${i + 1}`).join("\n"));
  const longName = "가상으로만든아주아주긴교실정리도우미역할";
  board.state.roles = Array.from({ length: 60 }, (_, i) => ({
    ...board.state.roles[0],
    id: crypto.randomUUID(),
    name: i === 0 ? longName : `가상 역할 ${i + 1}`,
  }));
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: demoKey, value: board });
  await page.goto(`${root}/assign`);
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  const roleList = page.getByRole("region", { name: "역할 목록" });
  await expect(roleList.getByRole("button", { name: /학생 선택/ })).toHaveCount(60);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("assignment-60-roles-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: test.info().outputPath("assignment-long-role-mobile.png"), fullPage: true });
  await page.screenshot({ path: test.info().outputPath("assignment-long-role-mobile-viewport.png") });
  await page.getByRole("button", { name: /역할 변경/ }).click();
  const dialog = page.getByRole("dialog", { name: "역할 선택" });
  await expect(dialog.getByRole("button", { name: `${longName} 학생 선택` })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "닫기" }).click();
});

test("담당·다른 역할·미배정 학생을 필요한 범위에서 구분한다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const board = await seed(page, false, Array.from({ length: 23 }, (_, i) =>
    `${i + 1} ${i === 22 ? "가상학생이름이아주긴사례" : `가상학생${i + 1}`}`,
  ).join("\n"));
  await page.goto(`${root}/assign`);
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await page.getByRole("button", { name: "1번 가상학생1 추가" }).click();
  await page.getByRole("button", { name: "2번 가상학생2 추가" }).click();
  await page.getByRole("button", { name: `${board.state.roles[1].name} 학생 선택` }).click();
  await page.getByRole("button", { name: "3번 가상학생3 추가" }).click();
  await page.getByRole("button", { name: "4번 가상학생4 추가" }).click();
  const panel = page.locator('[data-role-desktop-picker]').getByRole("region", { name: "담당 학생 선택" });
  await expect(panel.getByRole("button", { name: "3번 가상학생3 배정 해제" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "5번 가상학생5 추가" })).toBeDisabled();
  await expect(page.locator('[data-role-desktop-picker]').getByLabel("학생 범위")).toHaveValue("all");
  await expect(panel.getByRole("button", { name: "1번 가상학생1 역할 이동" })).toContainText(board.state.roles[0].name);
  await expect(panel.getByRole("button", { name: "3번 가상학생3 배정 해제" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "23번 가상학생이름이아주긴사례 추가" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const audit = await new AxeBuilder({ page }).include('[data-role-desktop-picker]').analyze();
  expect(audit.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePanel = page.getByRole("region", { name: "담당 학생 선택" });
  await expect(mobilePanel.locator('[data-assignment-state="current"]')).toHaveCount(2);
  await expect(mobilePanel.locator('[data-assignment-state="other"]')).toHaveCount(0);
  await expect(mobilePanel.locator('[data-assignment-state="unassigned"]')).toHaveCount(0);
  await page.getByRole("group", { name: "학생 범위" }).getByRole("button", { name: "전체 학생" }).click();
  await expect(mobilePanel.locator('[data-assignment-state="other"]')).toHaveCount(2);
  await expect(mobilePanel.locator('[data-assignment-state="unassigned"]')).toHaveCount(19);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("빈 명단·역할에서 시작해 새 역할에 여러 명을 배정한다", async ({
  page,
}) => {
  const board = await seed(page, false, "");
  board.state.roles = [];
  await page.evaluate(
    ({ key, board }) => localStorage.setItem(key, JSON.stringify(board)),
    { key: demoKey, board },
  );
  await page.goto(`${root}/assign`);
  await expect(
    page.getByRole("button", { name: "다음: 역할 배정" }),
  ).toBeDisabled();
  await page
    .getByLabel("학생 명단", { exact: true })
    .fill("1 가상하늘\n2 가상바다");
  await page.getByRole("button", { name: "명단 적용", exact: true }).click();
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await expect(page.getByText("역할을 먼저 추가해 주세요.").filter({ visible: true })).toBeVisible();
  const roleList = page.getByRole("region", { name: "역할 목록" });
  await roleList.getByText("+ 역할 추가", { exact: true }).click();
  await roleList.getByLabel("새 역할 이름", { exact: true }).fill("함께 정리");
  await roleList.getByRole("button", { name: "역할 추가", exact: true }).click();
  await page.getByRole("button", { name: "정원 변경" }).click();
  await page.locator('[data-role-desktop-picker]').getByLabel("함께 정리 정원", { exact: true }).fill("2");
  await page.getByRole("button", { name: "1번 가상하늘 추가" }).click();
  await page.getByRole("button", { name: "2번 가상바다 추가" }).click();
  await page.getByRole("button", { name: "1번 가상하늘 배정 해제" }).click();
  await page.getByRole("button", { name: "2번 가상바다 배정 해제" }).click();
  await expect(page.getByRole("button", { name: "1번 가상하늘 추가" })).toBeVisible();
  await page.getByRole("button", { name: "1번 가상하늘 추가" }).click();
  await page.getByRole("button", { name: "2번 가상바다 추가" }).click();
  await confirmAssignment(page);
  await expect(page).toHaveURL(`${root}/board`);
});

test("60명 명단을 CSS 2배 확대해도 배정 화면이 가로로 잘리지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(
    page,
    false,
    Array.from({ length: 60 }, (_, i) => `${i + 1} 가상학생${i + 1}`).join("\n"),
  );
  await page.goto(`${root}/assign`);
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("checkbox", { name: "60번 가상학생60 선택" })).toBeVisible();
  const footerBoxes = await page.locator('[data-role-mobile-actions] > div').evaluate((row) =>
    [...row.children].map((element) => {
      const { left, right, top, bottom } = element.getBoundingClientRect();
      return { left, right, top, bottom };
    }),
  );
  expect(footerBoxes[1].bottom).toBeLessThanOrEqual(footerBoxes[0].top + 1);
  expect(footerBoxes[0].right).toBeLessThanOrEqual(footerBoxes[2].left + 1);
  expect(footerBoxes.every((box) => box.left >= 0 && box.right <= 390)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("role-assignment-mobile-zoom-200.png") });
  const mobileCards = page.locator('[data-role-mobile-picker] [data-assignment-state]');
  const firstCard = await mobileCards.first().boundingBox();
  const secondCard = await mobileCards.nth(1).boundingBox();
  expect(Math.abs(firstCard!.x - secondCard!.x)).toBeLessThanOrEqual(1);
  const filterBoxes = await page.getByRole("group", { name: "학생 범위" }).getByRole("button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const { left, right } = button.getBoundingClientRect();
      return { left, right };
    }),
  );
  expect(filterBoxes.every((box) => box.left >= 0 && box.right <= 390)).toBe(true);
  await mobileCards.first().evaluate((element) => element.scrollIntoView({ block: "center" }));
  await page.screenshot({ path: test.info().outputPath("role-assignment-mobile-zoom-200-students.png") });
});

test("자동 명단 → 2단계 배정 → 공용 제출·재제출 → 월간 상세", async ({
  page,
  context,
}) => {
  const board = await seed(page);
  await page.getByRole("link", { name: /학생 역할 배정/ }).click();
  await expect(
    page.getByText("설정 명단을 불러왔습니다."),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await expect(page.getByRole("button", { name: "배정 확인", exact: true })).toHaveAttribute("aria-disabled", "true");
  for (const [i, s] of board.state.roster.entries()) {
    await page
      .getByRole("button", {
        name: `${board.state.roles[i].name} 학생 선택`,
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: `${s.number}번 ${s.name} 추가`, exact: true })
      .click();
  }
  await expect(page.getByRole("button", { name: "배정 확인", exact: true })).toHaveAttribute("aria-disabled", "false");
  await confirmAssignment(page);
  await expect(page).toHaveURL(`${root}/board`);
  await expect(page.getByRole("button", { name: "전체보기" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("table")).toBeVisible();
  const url = await page.getByLabel("학생 공용 주소").inputValue();
  await expect(page.getByLabel("학생화면 URL QR 코드")).toBeVisible();
  await expect(page.getByRole("link", { name: "학생 화면 열기" })).toHaveAttribute("href", url);
  const qrDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "QR 이미지 저장" }).click();
  await expect((await qrDownload).suggestedFilename()).toContain("학생화면_QR.png");
  const studentPage = await context.newPage();
  await studentPage.setViewportSize({ width: 390, height: 844 });
  await studentPage.goto(url);
  await studentPage
    .getByRole("button", { name: "1번 가상하늘", exact: true })
    .click();
  await studentPage
    .getByRole("button", { name: "했어요", exact: true })
    .click();
  await expect(
    studentPage.getByRole("status").filter({ hasText: "저장했어요" }),
  ).toBeVisible();
  await expect(
    studentPage.getByRole("heading", { name: "내 이름을 선택해 주세요" }),
  ).toBeVisible();
  await studentPage
    .getByRole("button", { name: "1번 가상하늘", exact: true })
    .click();
  await expect(
    studentPage.getByText("오늘 기록:", { exact: false }),
  ).toContainText("했어요");
  await expect(studentPage.getByRole("heading", { name: /이번 주 실천/ })).toBeVisible();
  await studentPage.screenshot({ path: test.info().outputPath("student-week-mobile.png"), fullPage: true });
  await studentPage
    .getByRole("button", { name: "못했어요", exact: true })
    .click();
  await expect(
    studentPage.getByRole("status").filter({ hasText: "못했어요" }),
  ).toBeVisible();
  await studentPage.screenshot({
    path: test.info().outputPath("student-mobile.png"),
    fullPage: true,
  });
  expect(
    await studentPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "기록 새로고침" }).click();
  await page.getByRole("button", { name: "학생화면", exact: true }).click();
  await page.getByRole("button", { name: /1번 가상하늘/ }).first().click();
  await expect(page.getByLabel("1번 가상하늘 기록 정정")).toHaveValue(
    "not_done",
  );
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(`${key}_records`)!).length,
      demoKey,
    ),
  ).toBe(1);
  await page.goto(`${root}/records`);
  await page.getByRole("button", { name: /1번 가상하늘/ }).click();
  await expect(
    page.getByRole("heading", { name: /1번 가상하늘.*상세/ }),
  ).toBeVisible();
  await expect(page.locator("#role-student-history")).toContainText(
    "학생 자기보고",
  );
  await page.screenshot({
    path: test.info().outputPath("teacher-history.png"),
    fullPage: true,
  });
});
test("실천판은 주간 O/X와 월간 횟수를 합쳐 보여주고 역할설정은 2단계로 연다", async ({ page }) => {
  const board = await seed(page, true);
  const today = roleToday();
  const week = roleWeekDates(today);
  const selectedDates = [...new Set([week[0], week[1], today])].filter((date) => date <= today && date >= today.slice(0, 7) + "-01");
  const first = board.state.roster[0];
  const period = board.state.periods[0];
  await page.evaluate(({ key, periodId, studentId, dates }) => {
    localStorage.setItem(`${key}_records`, JSON.stringify(dates.map((date, index) => ({
      period_id: periodId, student_id: studentId, record_date: date,
      status: index === 1 ? "not_done" : "done", source: "student", updated_at: new Date().toISOString(),
    }))));
  }, { key: demoKey, periodId: period.id, studentId: first.id, dates: selectedDates });
  await page.goto(`${root}/board`);
  const row = page.getByRole("row").filter({ has: page.getByRole("button", { name: first.name, exact: true }) });
  await expect(row.getByRole("cell", { name: `${selectedDates[0]} 했어요` })).toHaveText("O");
  if (selectedDates.length > 1) await expect(row.getByRole("cell", { name: `${selectedDates[1]} 못했어요` })).toHaveText("X");
  await expect(row.getByRole("cell", { name: String(selectedDates.length - Number(selectedDates.length > 1)), exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "학생화면", exact: true }).click();
  await expect(page.getByRole("button", { name: /1번 가상하늘/ }).first()).toContainText(`오늘 ${selectedDates.indexOf(today) === 1 ? "못했어요" : "했어요"}`);
  await page.getByRole("button", { name: /1번 가상하늘/ }).first().click();
  await expect(page.getByRole("region", { name: /1번 가상하늘 실천 상세/ })).toContainText("이번 주");
  await page.getByRole("link", { name: "역할설정" }).click();
  await expect(page.locator("[data-role-assignment-step]")) .toHaveAttribute("data-role-assignment-step", "2");
});
test("실천판은 23명 데스크톱·모바일과 확대 화면에서 읽을 수 있다", async ({ page }) => {
  const roster = Array.from({ length: 23 }, (_, index) => `${index + 1} 가상학생${index + 1}${index === 14 ? "긴이름확인" : ""}`).join("\n");
  await seed(page, true, roster);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${root}/board`);
  await expect(page.getByRole("row")).toHaveCount(24);
  await page.screenshot({ path: test.info().outputPath("role-board-desktop-23.png"), fullPage: true });
  await page.getByRole("button", { name: "학생화면", exact: true }).click();
  await page.screenshot({ path: test.info().outputPath("role-students-desktop-23.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath("role-students-mobile-23.png"), fullPage: true });
  await page.getByRole("button", { name: "전체보기", exact: true }).click();
  await page.screenshot({ path: test.info().outputPath("role-board-mobile-23.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { document.body.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("실천판의 빈 상태·한 명·최대 60명도 문서 스크롤을 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.goto(`${root}/board`);
  await expect(page.getByText("오늘 배정된 역할이 없습니다.")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("role-board-empty-mobile.png"), fullPage: true });
  await seed(page, true, "1 가상한명");
  await page.goto(`${root}/board`);
  await expect(page.getByRole("button", { name: "1 가상한명" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("role-board-one-mobile.png"), fullPage: true });
  const roster = Array.from({ length: 60 }, (_, index) => `${index + 1} 가상학생${index + 1}`).join("\n");
  await seed(page, true, roster);
  await page.goto(`${root}/board`);
  await expect(page.getByRole("button", { name: "60 가상학생60" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("role-board-sixty-mobile.png"), fullPage: true });
});
test("결석 정정, 공유 중지, 링크 재발급, 읽기 전용 전자칠판", async ({
  page,
  context,
}) => {
  const board = await seed(page, true);
  await page.goto(`${root}/board`);
  await page.getByRole("button", { name: "학생화면", exact: true }).click();
  await page.getByRole("button", { name: /2번 가상바다/ }).click();
  await page.getByLabel("2번 가상바다 기록 정정").selectOption("exempt");
  await expect(page.getByRole("status")).toContainText("교사 정정");
  const publicPage = await context.newPage();
  await publicPage.goto(`/s/roles/${board.public_token}?view=display`);
  await expect(publicPage.getByText("1번 가○○○")).toBeVisible();
  await expect(
    publicPage.getByRole("button", { name: "했어요", exact: true }),
  ).toHaveCount(0);
  await page.goto(`${root}/settings`);
  await page.getByLabel("학생 화면과 입력 허용").uncheck();
  await page.getByRole("button", { name: "운영 설정 저장" }).click();
  await expect(page.getByRole("status")).toContainText("저장했습니다");
  await publicPage.reload();
  await expect(
    publicPage.getByText("선생님이 학생 입력을 잠시 중지했어요."),
  ).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "공용 링크 재발급", exact: true })
    .click();
  await publicPage.reload();
  await expect(publicPage.getByRole("alert")).toContainText(
    "사용할 수 없는 학급 링크",
  );
});
test("역할 교체는 이전 배정 유지, 다음 기간·잔여 정원 표시", async ({
  page,
}) => {
  const board = await seed(page, true);
  await page.goto(`${root}/rotate`);
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await page.getByRole("button", { name: "이전 역할 보기" }).click();
  await expect(
    page.getByText(`이전: ${board.state.roles[0].name}`).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "기간 변경" }).click();
  const start = await page.getByLabel("시작일", { exact: true }).inputValue();
  expect(start > board.state.periods[0].end).toBe(true);
  await expect(
    page.getByRole("button", { name: "배정 확인", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    demoKey,
  );
  expect(stored.state.periods).toHaveLength(1);
});
test("잘못된 명단·겹친 기간은 입력을 유지하고 안내", async ({ page }) => {
  const board = await seed(page, true);
  await page.goto(`${root}/assign`);
  await page.getByRole("button", { name: "명단 수정", exact: true }).click();
  await page
    .getByLabel("학생 명단", { exact: true })
    .fill("1 가상학생\n1 중복학생");
  await page.getByRole("button", { name: "명단 적용", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("중복");
  await expect(page.getByLabel("학생 명단", { exact: true })).toHaveValue(
    "1 가상학생\n1 중복학생",
  );
  await page.getByLabel("학생 명단", { exact: true }).fill("1 가상학생");
  await page.getByRole("button", { name: "명단 적용", exact: true }).click();
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await page.getByRole("button", { name: "기간 변경" }).click();
  await page
    .getByLabel("시작일", { exact: true })
    .fill(board.state.periods[0].start);
  await page
    .getByLabel("종료일", { exact: true })
    .fill(board.state.periods[0].end);
  await page.getByRole("button", { name: "1번 가상학생 추가", exact: true }).click();
  await page.getByRole("button", { name: "배정 확인", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("겹칩니다");
});

test("설정에서 저장한 명단을 배정에 자동 적용하고 역할 수정은 과거에 영향을 주지 않는다", async ({
  page,
}) => {
  const board = await seed(page, true);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "학급 학생 명단", exact: true })
    .click();
  await page.getByRole("button", { name: "명단 수정", exact: true }).click();
  await page
    .getByLabel("학생 명단 (한 줄에 번호와 이름)")
    .fill("1 새가상학생\n2 가상바다");
  await page
    .getByRole("button", { name: "학생 명단 저장", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "학생 명단을 저장했습니다",
  );
  await page.goto(`${root}/assign`);
  await expect(
    page.getByRole("list", { name: "배정할 학생 명단" }),
  ).toContainText("새가상학생");
  await expect(
    page.getByRole("list", { name: "배정할 학생 명단" }).getByRole("listitem"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("textbox", { name: "학생 명단", exact: true }),
  ).toHaveCount(0);
  await page.goto(`${root}/roles`);
  await page
    .getByLabel("역할 1 이름", { exact: true })
    .fill("변경한 역할 이름");
  await page.getByRole("button", { name: "역할 목록 저장" }).click();
  await expect(page.getByRole("status")).toContainText(
    "다음 배정부터 적용됩니다",
  );
  const current = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    demoKey,
  );
  expect(current.state.periods).toEqual(board.state.periods);
  expect(current.state.roles[0].name).toBe("변경한 역할 이름");
});

test("데스크톱 6개 기능은 3열이고 기록은 선택한 월만 표시한다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await seed(page, true);
  const links = page
    .getByRole("region", { name: "1인 1역 기능" })
    .getByRole("link");
  await expect(links.getByRole("heading", { level: 3 })).toHaveText(
    expectedTileOrder,
  );
  const boxes = await links.evaluateAll((elements) =>
    elements.map((el) => ({
      top: el.getBoundingClientRect().top,
      left: el.getBoundingClientRect().left,
    })),
  );
  expect(boxes).toHaveLength(6);
  expect(boxes[0].top).toBe(boxes[2].top);
  expect(boxes[3].top).toBeGreaterThan(boxes[0].top);
  await page.screenshot({
    path: test.info().outputPath("teacher-home.png"),
    fullPage: true,
  });
  await page.goto(`${root}/records`);
  await expect(
    page.getByRole("button", { name: /날짜별 기록 보기/ }),
  ).toHaveCount(3);
  await page.getByLabel("조회 월").fill("2020-01");
  await expect(page.getByText("이 달의 배정과 기록이 없습니다.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /날짜별 기록 보기/ }),
  ).toHaveCount(0);
});
