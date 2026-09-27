import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  defaultRoleState,
  parseRoleRoster,
} from "../../supabase/functions/_shared/classroomRoles";

const root = "/tools/classroom-roles";
const demoKey = "schooldoc_classroom_roles_demo_v1";

async function seed(page: Page, count: number, roleCount: number, longNames = false) {
  const state = defaultRoleState();
  state.roster = parseRoleRoster(
    Array.from({ length: count }, (_, index) =>
      `${index + 1} ${longNames && index === count - 1 ? "가상으로아주긴학생이름가나다라마바사" : `가상학생${String(index + 1).padStart(2, "0")}`}`,
    ).join("\n"),
  );
  const templates = state.roles;
  state.roles = Array.from({ length: roleCount }, (_, index) => ({
    ...templates[index % templates.length],
    id: crypto.randomUUID(),
    name: longNames && index === roleCount - 1 ? "가상으로아주긴학생지원도우미역할" : index < templates.length ? templates[index].name : `가상 역할 ${index + 1}`,
    capacity: Math.ceil(count / roleCount),
  }));
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
  await page.getByRole("button", { name: "다음: 역할 배정" }).click();
  return state;
}

test("확인창은 PC에서 세 열로 훑고 모바일에서는 확정 동작을 계속 볼 수 있다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const state = await seed(page, 23, 12);
  const picker = page.locator("[data-role-desktop-picker]");
  await expect(picker.getByRole("heading", { name: "학생 선택" })).toHaveCount(0);
  await expect(picker.getByRole("button", { name: "학생 검색 열기" })).toHaveCount(0);
  for (let index = 0; index < 23; index++) {
    if (index % 2 === 0) {
      await picker.getByRole("button", { name: `${state.roles[Math.floor(index / 2)].name} 학생 선택` }).click();
    }
    const student = state.roster[index];
    await picker.getByRole("button", { name: `${student.number}번 ${student.name} 추가` }).click();
  }
  await page.screenshot({ path: test.info().outputPath("assignment-compact-desktop.png"), fullPage: true });
  await page.locator("[data-role-topbar]").getByRole("button", { name: "배정 확인" }).click();
  const dialog = page.getByRole("dialog", { name: "배정 확인" });
  const rows = dialog.getByRole("list", { name: "역할별 배정" }).getByRole("listitem");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toContainText("1 가상학생01 · 2 가상학생02");
  const desktopPositions = await rows.evaluateAll((elements) =>
    elements.map((element) => ({ x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y })),
  );
  expect(desktopPositions[0].y).toBe(desktopPositions[1].y);
  expect(desktopPositions[1].y).toBe(desktopPositions[2].y);
  expect(desktopPositions[0].x).toBeLessThan(desktopPositions[1].x);
  expect(desktopPositions[1].x).toBeLessThan(desktopPositions[2].x);
  expect(new Set(desktopPositions.map(({ y }) => y)).size).toBe(4);
  await expect(dialog.getByRole("button", { name: "확정하기" })).toBeInViewport();
  expect(await dialog.locator("[data-role-review-list]").evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
  const audit = await new AxeBuilder({ page }).include("dialog[aria-labelledby='role-review-heading']").analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("review-dialog-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePositions = await rows.evaluateAll((elements) =>
    elements.map((element) => ({ x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y })),
  );
  expect(mobilePositions[0].x).toBe(mobilePositions[1].x);
  expect(mobilePositions[1].y).toBeGreaterThan(mobilePositions[0].y);
  const list = dialog.locator("[data-role-review-list]");
  expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await expect(dialog.getByRole("button", { name: "확정하기" })).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath("review-dialog-mobile.png"), fullPage: true });
  await list.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(dialog.getByRole("button", { name: "확정하기" })).toBeInViewport();
  await page.setViewportSize({ width: 195, height: 844 });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(dialog.getByRole("button", { name: "확정하기" })).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("[data-role-mobile-actions]").getByRole("button", { name: "배정 확인" })).toBeFocused();
});

test("많은 학생에게만 검색을 제공하고 닫으면 전체 명단으로 돌아온다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await seed(page, 60, 18);
  const picker = page.locator("[data-role-desktop-picker]");
  await expect(picker.locator(".role-assignment-student-card")).toHaveCount(60);
  await picker.getByRole("button", { name: "학생 검색 열기" }).click();
  const search = picker.getByRole("searchbox", { name: "학생 찾기" });
  await expect(search).toBeFocused();
  await search.fill("가상학생60");
  await expect(picker.locator(".role-assignment-student-card")).toHaveCount(1);
  await picker.getByRole("button", { name: "학생 검색 닫기" }).click();
  await expect(picker.locator(".role-assignment-student-card")).toHaveCount(60);
});

test("60명·30개 역할의 긴 확인 목록에서도 하단 동작을 볼 수 있다", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  const state = await seed(page, 60, 30, true);
  const picker = page.locator("[data-role-desktop-picker]");
  for (let index = 0; index < 60; index++) {
    if (index % 2 === 0) {
      await picker.getByRole("button", { name: `${state.roles[Math.floor(index / 2)].name} 학생 선택` }).click();
    }
    const student = state.roster[index];
    await picker.getByRole("button", { name: `${student.number}번 ${student.name} 추가` }).click();
  }
  await page.locator("[data-role-topbar]").getByRole("button", { name: "배정 확인" }).click();
  const dialog = page.getByRole("dialog", { name: "배정 확인" });
  const list = dialog.locator("[data-role-review-list]");
  await expect(dialog.getByRole("listitem")).toHaveCount(30);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await expect(dialog.getByRole("button", { name: "확정하기" })).toBeInViewport();
  await list.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(dialog.getByText("가상으로아주긴학생지원도우미역할")).toBeInViewport();
  await expect(dialog.getByText("가상으로아주긴학생이름가나다라마바사")).toBeInViewport();
  await expect(dialog.getByRole("button", { name: "확정하기" })).toBeInViewport();
});
