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

async function seed(page: Page, assigned: boolean) {
  const state = defaultRoleState();
  state.roster = parseRoleRoster("1 가상학생");
  if (assigned) {
    state.periods = [
      {
        id: crypto.randomUUID(),
        ...roleMonthRange(roleToday().slice(0, 7)),
        students: structuredClone(state.roster),
        roles: structuredClone(state.roles),
        assignments: { [state.roster[0].id]: state.roles[0].id },
      },
    ];
  }
  await page.goto(root);
  await page.evaluate(
    ({ key, state }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          id: crypto.randomUUID(),
          public_token: crypto.randomUUID(),
          version: 1,
          state,
        }),
      );
      localStorage.setItem(`${key}_records`, "[]");
    },
    { key: demoKey, state },
  );
  await page.goto(`${root}/settings`);
  return state;
}

test("운영 설정에서 진행 중인 종료일과 달력 제외일을 저장한다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const state = await seed(page, true);
  await expect(page.getByLabel("운영 시작일")).toBeEnabled();
  const newEnd = new Date(
    Date.parse(`${state.periods[0].end}T00:00:00Z`) + 3 * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  await page.getByLabel("운영 종료일").fill(newEnd);
  const day = Number(state.periods[0].end.slice(-2));
  const [year, month] = roleToday().slice(0, 7).split("-").map(Number);
  const date = `${roleToday().slice(0, 7)}-${String(day).padStart(2, "0")}`;
  const dayButton = page.getByRole("button", {
    name: `${year}년 ${month}월 ${day}일 실천 제외`,
  });
  await dayButton.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", {
      name: `${year}년 ${month}월 ${day}일 실천 제외 취소`,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: test.info().outputPath("operation-settings-desktop-selected.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "운영 설정 저장" }).click();
  await expect(page.getByRole("status")).toContainText("운영 설정을 저장했습니다");
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    demoKey,
  );
  expect(saved.state.periods[0].end).toBe(newEnd);
  expect(saved.state.periods[0].assignments).toEqual(
    state.periods[0].assignments,
  );
  expect(saved.state.settings.excludedDates).toEqual([date]);
  await page.reload();
  await expect(page.getByLabel("운영 종료일")).toHaveValue(newEnd);
  await expect(
    page.getByRole("button", { name: `${date} 실천 제외 취소` }),
  ).toBeVisible();
  await page.getByRole("button", { name: `${date} 실천 제외 취소` }).click();
  await page.getByRole("button", { name: "운영 설정 저장" }).click();
  await expect(page.getByRole("status")).toContainText("저장했습니다");
  const cleared = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state.settings.excludedDates,
    demoKey,
  );
  expect(cleared).toEqual([]);
});

test("모바일에서는 배정 전 안내와 월 이동·선택을 사용할 수 있다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, false);
  await expect(page.getByText("진행 중인 배정이 없습니다.")).toBeVisible();
  await expect(page.getByRole("link", { name: "학생 역할 배정" })).toBeVisible();
  await page.getByRole("button", { name: "다음 달" }).click();
  const nextMonth = new Date(
    Date.UTC(Number(roleToday().slice(0, 4)), Number(roleToday().slice(5, 7)), 1),
  )
    .toISOString()
    .slice(0, 7);
  const [year, month] = nextMonth.split("-").map(Number);
  await page
    .getByRole("button", { name: `${year}년 ${month}월 1일 실천 제외` })
    .click();
  await expect(
    page.getByRole("button", { name: `${nextMonth}-01 실천 제외 취소` }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .include('[aria-label="실천 제외일 달력"]')
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("operation-settings-mobile-selected.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "운영 설정 저장" }).click();
  await expect(page.getByRole("status")).toContainText("저장했습니다");
  await page.setViewportSize({ width: 195, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

test("예정된 운영 기간은 시작일과 종료일을 함께 수정할 수 있다", async ({
  page,
}) => {
  await seed(page, true);
  const [year, month] = roleToday().slice(0, 7).split("-").map(Number);
  const futureMonth = new Date(Date.UTC(year, month, 1))
    .toISOString()
    .slice(0, 7);
  const range = roleMonthRange(futureMonth);
  await page.evaluate(
    ({ key, range }) => {
      const board = JSON.parse(localStorage.getItem(key)!);
      board.state.periods[0].start = range.start;
      board.state.periods[0].end = range.end;
      localStorage.setItem(key, JSON.stringify(board));
    },
    { key: demoKey, range },
  );
  await page.reload();
  await expect(page.getByLabel("운영 시작일")).toBeEnabled();
  await page.getByLabel("운영 시작일").fill(`${futureMonth}-03`);
  await page.getByLabel("운영 종료일").fill(`${futureMonth}-26`);
  await page.getByRole("button", { name: "운영 설정 저장" }).click();
  await expect(page.getByRole("status")).toContainText("저장했습니다");
  const period = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state.periods[0],
    demoKey,
  );
  expect(period.start).toBe(`${futureMonth}-03`);
  expect(period.end).toBe(`${futureMonth}-26`);
});

test("지난 운영 기간을 선택하고 과거 날짜로 고친 뒤 삭제한다", async ({ page }) => {
  await seed(page, true);
  await page.getByLabel("운영 시작일").fill("2026-01-01");
  await page.getByLabel("운영 종료일").fill("2026-01-31");
  await page.getByRole("button", { name: "운영 설정 저장" }).click();
  await expect(page.getByRole("status")).toContainText("저장했습니다");
  await page.reload();
  await expect(page.getByLabel("운영 시작일")).toHaveValue("2026-01-01");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "이 운영 기간 삭제" }).click();
  await expect(page.getByText("진행 중인 배정이 없습니다.")).toBeVisible();
  const count = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state.periods.length,
    demoKey,
  );
  expect(count).toBe(0);
});

test("지난 기간과 현재 기간을 목록에서 구분해 선택할 수 있다", async ({ page }) => {
  const state = await seed(page, true);
  await page.evaluate(
    ({ key }) => {
      const board = JSON.parse(localStorage.getItem(key)!);
      board.state.periods.unshift({
        ...structuredClone(board.state.periods[0]),
        id: crypto.randomUUID(),
        start: "2026-02-01",
        end: "2026-02-28",
      });
      localStorage.setItem(key, JSON.stringify(board));
    },
    { key: demoKey },
  );
  await page.reload();
  await expect(page.getByLabel("수정할 운영 기간").locator("option")).toHaveCount(2);
  await page.getByLabel("수정할 운영 기간").selectOption(state.periods[0].id);
  await expect(page.getByLabel("운영 시작일")).toHaveValue(state.periods[0].start);
  const pastOption = page.getByLabel("수정할 운영 기간").locator("option", { hasText: "2026-02-01" });
  await page.getByLabel("수정할 운영 기간").selectOption(await pastOption.getAttribute("value") ?? "");
  await expect(page.getByLabel("운영 시작일")).toHaveValue("2026-02-01");
  await expect(page.getByText("2026년 2월")).toBeVisible();
});

test("제출 기록이 있는 기간은 삭제하거나 기록일을 제외할 수 없다", async ({ page }) => {
  const state = await seed(page, true);
  await page.evaluate(
    ({ key, periodId, studentId, date }) => {
      localStorage.setItem(`${key}_records`, JSON.stringify([{
        period_id: periodId,
        student_id: studentId,
        record_date: date,
        status: "done",
        source: "student",
        updated_at: new Date().toISOString(),
      }]));
    },
    {
      key: demoKey,
      periodId: state.periods[0].id,
      studentId: state.roster[0].id,
      date: roleToday(),
    },
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "이 운영 기간 삭제" }).click();
  await expect(page.getByText(/이미 기록된 날짜가 있습니다/)).toBeVisible();
  await page.getByLabel("운영 시작일").fill("2026-01-01");
  await page.getByLabel("운영 종료일").fill("2026-01-31");
  await page.getByRole("button", { name: "운영 설정 저장" }).click();
  await expect(page.getByText(/이미 기록된 날짜가 있습니다/)).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state.periods.length, demoKey)).toBe(1);
});
