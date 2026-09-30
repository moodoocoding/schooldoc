import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  defaultRoleState,
  parseRoleRoster,
  roleMonthRange,
  roleToday,
} from "../../supabase/functions/_shared/classroomRoles";

const demoKey = "schooldoc_classroom_roles_demo_v1";

async function seedPublic(page: Page, count = 23, activeToday = true, showStatus = true) {
  const today = roleToday();
  const state = defaultRoleState();
  state.roster = parseRoleRoster(
    Array.from({ length: count }, (_, index) =>
      String(index + 1) + " " + (index === count - 1 ? "가상으로아주긴학생이름" : "가상학생" + (index + 1)),
    ).join("\n"),
  );
  if (activeToday) {
    state.settings.schoolDays = [0, 1, 2, 3, 4, 5, 6];
    state.roles.forEach((role) => { role.weekdays = [0, 1, 2, 3, 4, 5, 6]; });
  } else {
    state.roles.forEach((role) => { role.weekdays = []; });
  }
  state.settings.showPublicStatus = showStatus;
  const period = {
    id: crypto.randomUUID(),
    ...roleMonthRange(today.slice(0, 7)),
    students: structuredClone(state.roster),
    roles: structuredClone(state.roles),
    assignments: Object.fromEntries(state.roster.map((student, index) => [student.id, state.roles[index % state.roles.length].id])),
  };
  state.periods = [period];
  const token = crypto.randomUUID();
  const records = [
    ...(count ? [{ period_id: period.id, student_id: state.roster[0].id, record_date: today, status: "done", source: "student", updated_at: new Date().toISOString() }] : []),
    ...(count > 1 ? [{ period_id: period.id, student_id: state.roster[1].id, record_date: today, status: "not_done", source: "student", updated_at: new Date().toISOString() }] : []),
  ];
  await page.goto("/tools/classroom-roles");
  await page.evaluate(({ key, board, records }) => {
    localStorage.setItem(key, JSON.stringify(board));
    localStorage.setItem(key + "_records", JSON.stringify(records));
  }, { key: demoKey, board: { id: crypto.randomUUID(), public_token: token, version: 1, state }, records });
  await page.goto("/s/roles/" + token);
  return { state, token };
}

test("공개 타일과 학생 상세의 데스크톱·모바일 배치를 확인한다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await seedPublic(page);
  await expect(page.getByRole("button", { name: "1번 가상학생1", exact: true })).toBeVisible();
  await expect(page.getByText("오늘 했어요", { exact: true })).toBeVisible();
  await expect(page.getByText("오늘 못했어요", { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("public-second-desktop.png"), fullPage: true });
  expect((await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath("public-second-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "1번 가상학생1", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "칠판 도우미" });
  await expect(detail).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("public-second-detail-mobile.png") });
  expect((await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(detail).not.toBeVisible();
  await expect(page.getByRole("button", { name: "1번 가상학생1", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("전자칠판은 같은 정보를 읽기 전용 타일로 표시한다", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { token } = await seedPublic(page);
  await page.goto("/s/roles/" + token + "?view=display");
  await expect(page.getByRole("article")).toHaveCount(23);
  await expect(page.getByRole("button", { name: "1번 가상학생1" })).toHaveCount(0);
  await expect(page.getByText("오늘 했어요", { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("public-second-display-desktop.png"), fullPage: true });
});

test("빈 명단·한 명·많은 명단과 확대에서도 가로 스크롤을 만들지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedPublic(page, 0);
  await page.screenshot({ path: test.info().outputPath("public-second-empty-mobile.png"), fullPage: true });
  await seedPublic(page, 1);
  await expect(page.getByRole("button", { name: "1번 가상으로아주긴학생이름", exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("public-second-single-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await seedPublic(page, 60);
  await expect(page.locator("section[aria-label='학생 역할과 오늘 상태'] button")).toHaveCount(60);
  await page.screenshot({ path: test.info().outputPath("public-second-sixty-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 780, height: 844 });
  await page.evaluate(() => { document.body.style.zoom = "200%"; });
  await page.screenshot({ path: test.info().outputPath("public-second-zoom-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("상태 비공개 설정과 비실천일의 기존 기록을 바르게 표시한다", async ({ page }) => {
  await seedPublic(page, 2, true, false);
  await expect(page.getByText("오늘 했어요", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "1번 가상학생1", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await seedPublic(page, 2, false, true);
  await expect(page.locator("section[aria-label='학생 역할과 오늘 상태'] button").filter({ hasText: "오늘 실천일 아님" })).toHaveCount(2);
  await expect(page.getByText("오늘 했어요", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "1번 가상학생1", exact: true }).click();
  await expect(page.getByText("오늘은 실천일이 아니에요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "했어요" })).toHaveCount(0);
});
