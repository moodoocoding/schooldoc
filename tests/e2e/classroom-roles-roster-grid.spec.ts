import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  defaultRoleState,
  parseRoleRoster,
} from "../../supabase/functions/_shared/classroomRoles";

const root = "/tools/classroom-roles";
const demoKey = "schooldoc_classroom_roles_demo_v1";

async function seed(page: Page, count: number, longName = false) {
  const state = defaultRoleState();
  state.roster = parseRoleRoster(
    Array.from({ length: count }, (_, index) =>
      `${index + 1} ${longName && index === count - 1 ? "가상으로아주긴이름을가진학생가나다라마바사아자차카타파하" : `가상학생${String(index + 1).padStart(2, "0")}`}`,
    ).join("\n"),
  );
  await page.goto(root);
  await page.evaluate(
    ({ key, state }) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          id: crypto.randomUUID(),
          public_token: crypto.randomUUID(),
          version: 1,
          state,
        }),
      ),
    { key: demoKey, state },
  );
  await page.goto(`${root}/assign`);
}

const roster = (page: Page) =>
  page.getByRole("list", { name: "배정할 학생 명단" });

async function positions(page: Page) {
  return roster(page)
    .getByRole("listitem")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        x: element.getBoundingClientRect().x,
        y: element.getBoundingClientRect().y,
      })),
    );
}

test("PC 명단은 인원과 관계없이 최대 4열로 번호순 배치한다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await seed(page, 0);
  await expect(roster(page)).toHaveCount(0);
  await expect(page.getByLabel("학생 명단", { exact: true })).toBeVisible();
  await seed(page, 1);
  await expect(roster(page).getByRole("listitem")).toHaveCount(1);
  await seed(page, 23);
  const items = roster(page).getByRole("listitem");
  await expect(items).toHaveCount(23);
  await expect(items.first()).toContainText("1가상학생01");
  await expect(items.last()).toContainText("23가상학생23");
  const points = await positions(page);
  expect(new Set(points.slice(0, 4).map(({ y }) => y)).size).toBe(1);
  expect(points[0].x).toBeLessThan(points[1].x);
  expect(points[1].x).toBeLessThan(points[2].x);
  expect(points[2].x).toBeLessThan(points[3].x);
  expect(points[4].y).toBeGreaterThan(points[0].y);
  expect(new Set(points.map(({ y }) => y)).size).toBe(6);
  const audit = await new AxeBuilder({ page }).include('ul[aria-label="배정할 학생 명단"]').analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("roster-grid-desktop.png"),
    fullPage: true,
  });
});

test("모바일 명단은 2열이며 전체 보기 후에도 번호순으로 읽힌다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, 23);
  await expect(roster(page).getByRole("listitem")).toHaveCount(6);
  await page.getByRole("button", { name: "전체 명단 보기" }).click();
  await expect(roster(page).getByRole("listitem")).toHaveCount(23);
  const points = await positions(page);
  expect(points[0].y).toBe(points[1].y);
  expect(points[0].x).toBeLessThan(points[1].x);
  expect(points[2].y).toBeGreaterThan(points[0].y);
  expect(new Set(points.map(({ y }) => y)).size).toBe(12);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("roster-grid-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "명단 접기" }).click();
  await expect(roster(page).getByRole("listitem")).toHaveCount(6);
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  await expect(page.locator('[data-role-assignment-step="2"]')).toBeVisible();
});

test("최대 60명과 긴 이름도 잘리지 않고 좁은 화면에서 가로 넘침이 없다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await seed(page, 60, true);
  await expect(roster(page).getByRole("listitem")).toHaveCount(60);
  expect(new Set((await positions(page)).map(({ y }) => y)).size).toBe(15);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "전체 명단 보기" }).click();
  await expect(roster(page).getByRole("listitem")).toHaveCount(60);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.setViewportSize({ width: 195, height: 844 });
  const narrow = await positions(page);
  expect(narrow[0].x).toBe(narrow[1].x);
  expect(narrow[1].y).toBeGreaterThan(narrow[0].y);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
