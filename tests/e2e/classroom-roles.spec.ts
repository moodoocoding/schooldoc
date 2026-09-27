import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  defaultRoleState,
  parseRoleRoster,
  roleMonthRange,
  roleToday,
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
          state.roster.map((s, i) => [s.id, state.roles[i].id]),
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
    page.getByRole("table", { name: "배정할 학생 명단" }).getByRole("row"),
  ).toHaveCount(4);
  await expect(
    page.getByRole("textbox", { name: "학생 명단", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  const checkbox = (name: string) =>
    page.getByRole("checkbox", { name, exact: true });
  const studentCard = (name: string) => checkbox(name).locator("..");
  await expect(studentCard("1번 가상하늘 선택")).toHaveAttribute("data-assignment-state", "unassigned");
  await expect(studentCard("1번 가상하늘 선택")).toContainText("미배정");
  await checkbox("1번 가상하늘 선택").check();
  await checkbox("2번 가상바다 선택").check();
  await expect(studentCard("1번 가상하늘 선택")).toHaveAttribute("data-assignment-state", "current");
  await expect(studentCard("1번 가상하늘 선택")).toContainText("이 역할 담당");
  await expect(checkbox("3번 가상하늘 선택")).toBeDisabled();
  await expect(studentCard("3번 가상하늘 선택")).toHaveAttribute("data-assignment-state", "unassigned");
  await expect(studentCard("3번 가상하늘 선택")).toContainText("미배정");
  const [currentColor, unassignedColor] = await Promise.all([
    studentCard("1번 가상하늘 선택").evaluate((element) => getComputedStyle(element).backgroundColor),
    studentCard("3번 가상하늘 선택").evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(currentColor).not.toBe(unassignedColor);
  await page.getByRole("button", { name: "정원 변경" }).click();
  await page.getByLabel(`${first.name} 정원`, { exact: true }).fill("1");
  await expect(page.getByRole("alert")).toContainText("이미 선택한 2명");
  await expect(
    page.getByLabel(`${first.name} 정원`, { exact: true }),
  ).toHaveValue("2");
  await page
    .getByRole("button", { name: `${second.name} 학생 선택`, exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "담당 학생 선택" }).getByText(`배정됨 · ${first.name}`, { exact: true }),
  ).toHaveCount(2);
  await expect(studentCard("1번 가상하늘 선택")).toHaveAttribute("data-assignment-state", "other");
  const [otherColor, stillUnassignedColor] = await Promise.all([
    studentCard("1번 가상하늘 선택").evaluate((element) => getComputedStyle(element).backgroundColor),
    studentCard("3번 가상하늘 선택").evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(otherColor).not.toBe(stillUnassignedColor);
  await checkbox("2번 가상바다 선택").click();
  const move = page.getByRole("dialog", { name: "역할 이동" });
  await expect(move).toContainText(`${first.name} → ${second.name}`);
  await page.keyboard.press("Escape");
  await expect(move).not.toBeVisible();
  await expect(checkbox("2번 가상바다 선택")).toBeFocused();
  await checkbox("2번 가상바다 선택").click();
  await move.getByRole("button", { name: "옮기기" }).click();
  await expect(checkbox("2번 가상바다 선택")).toBeChecked();
  await expect(
    page.getByRole("button", { name: `${first.name} 학생 선택`, exact: true }),
  ).toContainText("1/2");
  await checkbox("3번 가상하늘 선택").check();
  await expect(page.getByRole("status")).toContainText("모두 배정됨");
  await checkbox("2번 가상바다 선택").uncheck();
  await expect(
    page.getByRole("button", { name: "배정 확인", exact: true }),
  ).toBeDisabled();
  await checkbox("2번 가상바다 선택").check();
  await page.getByRole("button", { name: "이전", exact: true }).click();
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await expect(page.getByRole("status")).toContainText("모두 배정됨");
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
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await page
    .getByRole("checkbox", { name: "1번 가상하늘 선택", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "3번 가상하늘 선택", exact: true })
    .check();
  await page.getByRole("button", { name: "이전", exact: true }).click();
  await page.getByRole("button", { name: "명단 수정", exact: true }).click();
  await expect(page.getByLabel("학생 명단", { exact: true })).toBeFocused();
  await page.getByLabel("학생 명단", { exact: true }).fill("1 변경된가상학생");
  await page.getByRole("button", { name: "수정 취소", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "배정할 학생 명단" }).getByRole("row"),
  ).toHaveCount(4);
  await page.getByRole("button", { name: "명단 수정", exact: true }).click();
  await page
    .getByLabel("학생 명단", { exact: true })
    .fill("1 가상하늘\n2 가상바다");
  await page.getByRole("button", { name: "명단 적용", exact: true }).click();
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await expect(
    page.getByRole("checkbox", { name: "1번 가상하늘 선택", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "3번 가상하늘 선택", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "미배정 1명" })).toBeVisible();
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
    page.getByRole("table", { name: "배정할 학생 명단" }).getByRole("row"),
  ).toHaveCount(31);
  await page.screenshot({
    path: test.info().outputPath("roster-confirmation-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  const firstStudent = page.getByRole("checkbox", {
    name: "1번 가상학생01 선택",
    exact: true,
  });
  expect((await firstStudent.boundingBox())?.y).toBeLessThan(844);
  await page.screenshot({
    path: test.info().outputPath("role-assignment-mobile-full.png"),
    fullPage: true,
  });
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
  await page.getByLabel("학생 찾기").fill("학생30");
  await page
    .getByRole("checkbox", { name: "30번 가상학생30 선택", exact: true })
    .check();
  await page.getByLabel("학생 찾기").fill("");
  await expect(first).toBeChecked();
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
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => window.scrollTo(0, 0));
  expect((await firstStudent.boundingBox())?.y).toBeLessThan(768);
  await page.screenshot({
    path: test.info().outputPath("role-assignment-desktop-full.png"),
    fullPage: true,
  });
  await page
    .getByRole("region", { name: "역할별 학생 배정", exact: true })
    .screenshot({ path: test.info().outputPath("role-students-desktop.png") });
});

test("23명·18역할에서 좌우 영역을 구분하고 큰 빈 공간을 남기지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const board = await seed(page, false, Array.from({ length: 23 }, (_, i) => `${i + 1} 가상학생${i + 1}`).join("\n"));
  await page.goto(`${root}/assign`);
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  const roleList = page.getByRole("region", { name: "역할 목록" });
  const studentPanel = page.getByRole("region", { name: "담당 학생 선택" });
  const [left, right] = await Promise.all([roleList.boundingBox(), studentPanel.boundingBox()]);
  expect(left).not.toBeNull();
  expect(right).not.toBeNull();
  expect(Math.abs(left!.y + left!.height - right!.y - right!.height)).toBeLessThanOrEqual(1);
  const [leftHeading, rightHeading] = await Promise.all([
    roleList.locator("h2").boundingBox(), studentPanel.locator("h2").boundingBox(),
  ]);
  expect(Math.abs(leftHeading!.y - rightHeading!.y)).toBeLessThanOrEqual(2);
  const firstRole = roleList.getByRole("button", { name: `${board.state.roles[0].name} 학생 선택` });
  expect((await firstRole.boundingBox())!.width).toBeGreaterThanOrEqual(180);
  await expect(studentPanel).toContainText(board.state.roles[0].description);
  await expect(studentPanel.getByText("역할 설명", { exact: true })).toHaveCount(0);
  await expect(studentPanel.getByText("추가 작업", { exact: true })).toHaveCount(0);
  const [headingSize, roleSize, studentSize, stateSize] = await Promise.all([
    studentPanel.locator("h2").evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    firstRole.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    studentPanel.locator('[data-assignment-state="unassigned"]').first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    studentPanel.locator('[data-assignment-state="unassigned"] [id^="role-student-state-"]').first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ]);
  expect(headingSize).toBeGreaterThan(roleSize);
  expect(roleSize).toBeGreaterThan(stateSize);
  expect(studentSize).toBeGreaterThan(stateSize);
  const [leftColor, rightColor] = await Promise.all([
    roleList.evaluate((element) => getComputedStyle(element).backgroundColor),
    studentPanel.evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(leftColor).not.toBe(rightColor);
  const audit = await new AxeBuilder({ page }).include('[aria-label="역할별 학생 배정"]').analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("balanced-assignment-desktop.png"), fullPage: true });
  await page.getByRole("checkbox", { name: "1번 가상학생1 선택" }).check();
  await page.getByRole("checkbox", { name: "2번 가상학생2 선택" }).check();
  await expect(firstRole).toHaveAttribute("aria-pressed", "true");
  const [fullLeft, fullRight] = await Promise.all([roleList.boundingBox(), studentPanel.boundingBox()]);
  expect(Math.abs(fullLeft!.y + fullLeft!.height - fullRight!.y - fullRight!.height)).toBeLessThanOrEqual(1);
  const [activeColor, inactiveColor] = await Promise.all([
    firstRole.evaluate((element) => getComputedStyle(element).backgroundColor),
    roleList.getByRole("button", { name: `${board.state.roles[1].name} 학생 선택` }).evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(activeColor).not.toBe(inactiveColor);
  await roleList.getByRole("button", { name: `${board.state.roles[1].name} 학생 선택` }).click();
  const [changedLeft, changedRight] = await Promise.all([roleList.boundingBox(), studentPanel.boundingBox()]);
  expect(Math.abs(changedLeft!.y + changedLeft!.height - changedRight!.y - changedRight!.height)).toBeLessThanOrEqual(1);
  const [changedLeftHeading, changedRightHeading] = await Promise.all([
    roleList.locator("h2").boundingBox(), studentPanel.locator("h2").boundingBox(),
  ]);
  expect(Math.abs(changedLeftHeading!.y - changedRightHeading!.y)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: test.info().outputPath("balanced-after-role-change.png"), fullPage: true });
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(roleList).toBeVisible();
  const [tabletRoles, tabletStudents] = await Promise.all([roleList.boundingBox(), studentPanel.boundingBox()]);
  expect(tabletRoles!.y + tabletRoles!.height).toBeLessThanOrEqual(tabletStudents!.y + 1);
  expect(Math.abs(tabletRoles!.width - tabletStudents!.width)).toBeLessThanOrEqual(1);
  expect((await studentPanel.locator('[data-assignment-state="unassigned"]').first().boundingBox())!.width).toBeGreaterThanOrEqual(180);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("balanced-assignment-1024.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(roleList).toBeHidden();
  await expect(studentPanel.locator("h2")).toBeVisible();
  await expect(page.getByRole("button", { name: /역할 변경/ })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("balanced-assignment-mobile.png"), fullPage: true });
});

test("학생 수가 적거나 많으면 데스크톱에서도 빈 옆 패널 없이 위아래로 배치한다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  for (const count of [3, 60]) {
    await seed(page, false, Array.from({ length: count }, (_, i) => `${i + 1} 가상학생${i + 1}`).join("\n"));
    await page.goto(`${root}/assign`);
    await page.getByRole("button", { name: "다음: 역할 설정" }).click();
    const roleList = page.getByRole("region", { name: "역할 목록" });
    const studentPanel = page.getByRole("region", { name: "담당 학생 선택" });
    const [rolesBox, studentsBox] = await Promise.all([roleList.boundingBox(), studentPanel.boundingBox()]);
    expect(rolesBox!.y + rolesBox!.height).toBeLessThanOrEqual(studentsBox!.y + 1);
    expect(Math.abs(rolesBox!.width - studentsBox!.width)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`stacked-assignment-${count}.png`), fullPage: true });
  }
});

test("최대 60개 역할과 긴 역할명에서도 카드와 모바일 선택창이 잘리지 않는다", async ({ page }) => {
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
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  const roleList = page.getByRole("region", { name: "역할 목록" });
  await expect(roleList.getByRole("button", { name: /학생 선택/ })).toHaveCount(60);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("assignment-60-roles-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath("assignment-long-role-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: /역할 변경/ }).click();
  const dialog = page.getByRole("dialog", { name: "역할 선택" });
  await expect(dialog.getByRole("button", { name: `${longName} 학생 선택` })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "닫기" }).click();
});

test("배정 상태 세 가지를 23명 명단에서 바로 구분하고 좁은 화면에서도 읽는다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const board = await seed(page, false, Array.from({ length: 23 }, (_, i) =>
    `${i + 1} ${i === 22 ? "가상학생이름이아주긴사례" : `가상학생${i + 1}`}`,
  ).join("\n"));
  await page.goto(`${root}/assign`);
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await page.getByRole("checkbox", { name: "1번 가상학생1 선택" }).check();
  await page.getByRole("checkbox", { name: "2번 가상학생2 선택" }).check();
  await page.getByRole("button", { name: `${board.state.roles[1].name} 학생 선택` }).click();
  await page.getByRole("checkbox", { name: "3번 가상학생3 선택" }).check();
  await page.getByRole("checkbox", { name: "4번 가상학생4 선택" }).check();
  const panel = page.getByRole("region", { name: "담당 학생 선택" });
  await expect(panel.locator('[data-assignment-state="current"]')).toHaveCount(2);
  await expect(panel.locator('[data-assignment-state="other"]')).toHaveCount(2);
  await expect(panel.locator('[data-assignment-state="unassigned"]')).toHaveCount(19);
  await expect(panel.locator('[data-assignment-state="unassigned"]').first()).toContainText("미배정");
  await expect(panel.locator('[data-assignment-state="other"]').first()).toContainText("배정됨 ·");
  await expect(panel.locator('[data-assignment-state="current"]').first()).toContainText("이 역할 담당");
  await expect(page.getByRole("button", { name: "미배정 19명" })).toBeVisible();
  const colors = await Promise.all(
    (["current", "other", "unassigned"] as const).map((state) =>
      panel.locator(`[data-assignment-state="${state}"]`).first()
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ),
  );
  expect(new Set(colors).size).toBe(3);
  const audit = await new AxeBuilder({ page }).include('[aria-label="역할별 학생 배정"]').analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("assignment-states-desktop.png"), fullPage: true });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(panel.locator('[data-assignment-state="unassigned"]').first()).toBeVisible();
    if (width === 390) {
      await page.screenshot({ path: test.info().outputPath("assignment-states-mobile.png"), fullPage: true });
    }
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("assignment-states-large-text.png"), fullPage: true });
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
    page.getByRole("button", { name: "다음: 역할 설정" }),
  ).toBeDisabled();
  await page
    .getByLabel("학생 명단", { exact: true })
    .fill("1 가상하늘\n2 가상바다");
  await page.getByRole("button", { name: "명단 적용", exact: true }).click();
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await expect(page.getByText("역할을 먼저 추가해 주세요.")).toBeVisible();
  const roleList = page.getByRole("region", { name: "역할 목록" });
  await roleList.getByText("+ 역할 추가", { exact: true }).click();
  await roleList.getByLabel("새 역할 이름", { exact: true }).fill("함께 정리");
  await roleList.getByRole("button", { name: "역할 추가", exact: true }).click();
  await page.getByRole("button", { name: "정원 변경" }).click();
  await page.getByLabel("함께 정리 정원", { exact: true }).fill("2");
  await page.getByRole("checkbox", { name: "1번 가상하늘 선택" }).check();
  await page.getByRole("checkbox", { name: "2번 가상바다 선택" }).check();
  await page.getByRole("checkbox", { name: "1번 가상하늘 선택" }).uncheck();
  await page.getByRole("checkbox", { name: "2번 가상바다 선택" }).uncheck();
  await expect(page.getByRole("button", { name: "미배정 2명", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "1번 가상하늘 선택" }).check();
  await page.getByRole("checkbox", { name: "2번 가상바다 선택" }).check();
  await confirmAssignment(page);
  await expect(page).toHaveURL(`${root}/board`);
});

test("60명 명단을 200% 확대해도 배정 화면이 가로로 잘리지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(
    page,
    false,
    Array.from({ length: 60 }, (_, i) => `${i + 1} 가상학생${i + 1}`).join("\n"),
  );
  await page.goto(`${root}/assign`);
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("checkbox", { name: "60번 가상학생60 선택" })).toBeVisible();
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
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await expect(page.getByRole("button", { name: "미배정 3명" })).toBeVisible();
  for (const [i, s] of board.state.roster.entries()) {
    await page
      .getByRole("button", {
        name: `${board.state.roles[i].name} 학생 선택`,
        exact: true,
      })
      .click();
    await page
      .getByRole("checkbox", {
        name: `${s.number}번 ${s.name} 선택`,
        exact: true,
      })
      .check();
  }
  await expect(page.getByRole("status")).toContainText("모두 배정됨");
  await confirmAssignment(page);
  await expect(page).toHaveURL(`${root}/board`);
  const url = await page.getByLabel("학생 공용 주소").inputValue();
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
test("결석 정정, 공유 중지, 링크 재발급, 읽기 전용 전자칠판", async ({
  page,
  context,
}) => {
  const board = await seed(page, true);
  await page.goto(`${root}/board`);
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
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await page.getByRole("button", { name: "이전 역할 보기" }).click();
  await expect(
    page.getByText(`이전: ${board.state.roles[0].name}`),
  ).toBeVisible();
  await page.getByRole("button", { name: "기간 변경" }).click();
  const start = await page.getByLabel("시작일", { exact: true }).inputValue();
  expect(start > board.state.periods[0].end).toBe(true);
  await expect(
    page.getByRole("button", { name: "배정 확인", exact: true }),
  ).toBeDisabled();
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
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await page.getByRole("button", { name: "기간 변경" }).click();
  await page
    .getByLabel("시작일", { exact: true })
    .fill(board.state.periods[0].start);
  await page
    .getByLabel("종료일", { exact: true })
    .fill(board.state.periods[0].end);
  await page
    .getByRole("checkbox", { name: "1번 가상학생 선택", exact: true })
    .check();
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
    page.getByRole("table", { name: "배정할 학생 명단" }),
  ).toContainText("새가상학생");
  await expect(
    page.getByRole("table", { name: "배정할 학생 명단" }).getByRole("row"),
  ).toHaveCount(3);
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
