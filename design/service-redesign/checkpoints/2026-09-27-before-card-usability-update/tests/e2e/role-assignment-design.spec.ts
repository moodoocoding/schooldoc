import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { defaultRoleState, parseRoleRoster } from "../../supabase/functions/_shared/classroomRoles";

const route = "/tools/classroom-roles/assign";
const demoKey = "schooldoc_classroom_roles_demo_v1";

test("승인된 PC 시안의 역할·담당자·미배정 후보를 보여 주고 배정한다", async ({ page }) => {
  await page.setViewportSize({ width: 1584, height: 993 });
  const state = defaultRoleState();
  const roleNames = [
    "도서 정리", "환경 정리", "준비물 확인", "기기 도우미", "학급 회장", "학급 부회장",
    "출석 확인", "칠판 정리", "분리수거", "급식 도우미", "게시판 정리", "환기 도우미",
  ];
  state.roles = roleNames.map((name, i) => ({ ...state.roles[i], name, description: "", capacity: 2 }));
  const names = [
    "김하온", "박서우", "이도겸", "최나린", "정이안", "강소율", "윤도하", "장하린",
    "임시온", "오서준", "한다온", "신유나", "서지안", "권이든", "황서진", "안예린",
    "송도윤", "홍채아", "문유준", "유라온", "백지호", "남아린", "노하준", "전소윤",
  ];
  state.roster = parseRoleRoster(names.map((name, i) => `${i + 1} ${name}`).join("\n"));
  state.settings.title = "5학년 3반";
  const board = { id: crypto.randomUUID(), public_token: crypto.randomUUID(), version: 1, state };
  await page.goto("/tools/classroom-roles");
  await page.evaluate(({ board, key }) => localStorage.setItem(key, JSON.stringify(board)), { board, key: demoKey });
  await page.reload();
  await page.goto(route);
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  for (let i = 0; i < 16; i++) {
    const role = state.roles[4 + Math.floor(i / 2)];
    const student = state.roster[i];
    await page.getByRole("button", { name: `${role.name} 학생 선택` }).click();
    await page.getByRole("button", { name: `${student.number}번 ${student.name} 추가` }).click();
  }
  for (let i = 16; i < 20; i++) {
    const role = state.roles[i - 16];
    const student = state.roster[i];
    await page.getByRole("button", { name: `${role.name} 학생 선택` }).click();
    await page.getByRole("button", { name: `${student.number}번 ${student.name} 추가` }).click();
  }
  await page.getByRole("button", { name: "도서 정리 학생 선택" }).click();
  const desktop = page.locator("[data-role-desktop-picker]");
  await expect(desktop.getByRole("heading", { name: "담당 학생" })).toBeVisible();
  await expect(desktop.getByText("송도윤", { exact: true })).toBeVisible();
  await expect(desktop.getByRole("button", { name: "21번 백지호 추가" })).toBeVisible();
  await expect(desktop.getByRole("button", { name: "22번 남아린 추가" })).toBeVisible();
  await expect(desktop.getByRole("button", { name: "23번 노하준 추가" })).toBeVisible();
  await expect(desktop.getByRole("button", { name: "24번 전소윤 추가" })).toBeVisible();
  await expect(desktop.getByRole("button", { name: "도서 정리 학생 선택" })).toContainText("1/2");
  await expect(desktop.getByRole("heading", { name: "배정 완료" })).toBeVisible();
  await expect(page.getByText(/24명 중 20명 배정|4명을 더 배정하면|미배정 4명/).filter({ visible: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const audit = await new AxeBuilder({ page }).include('[data-role-desktop-picker]').analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("approved-role-assignment-desktop.png"), fullPage: true });
  await desktop.getByRole("button", { name: "21번 백지호 추가" }).click();
  await expect(desktop.getByText("백지호", { exact: true })).toBeVisible();
  await expect(desktop.getByRole("heading", { name: "학생 추가" })).toBeFocused();
  await expect(desktop.getByRole("button", { name: "도서 정리 학생 선택" })).toHaveAttribute("aria-pressed", "true");
  await desktop.getByRole("button", { name: "21번 백지호 배정 해제" }).click();
  await expect(desktop.getByRole("button", { name: "21번 백지호 추가" })).toBeFocused();
});

test("큰 글자와 야간 테마에서도 PC 배정 화면을 읽고 조작할 수 있다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const state = defaultRoleState();
  state.roster = parseRoleRoster("1 가상하늘\n2 가상바다\n3 가상나무");
  const board = { id: crypto.randomUUID(), public_token: crypto.randomUUID(), version: 1, state };
  await page.goto("/tools/classroom-roles");
  await page.evaluate(({ board, key }) => {
    localStorage.setItem(key, JSON.stringify(board));
    localStorage.setItem("schooldoc_appearance_v1", JSON.stringify({ themeId: "midnight", fontSize: "large" }));
  }, { board, key: demoKey });
  await page.reload();
  await page.goto(route);
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  const picker = page.locator('[data-role-desktop-picker]');
  await expect(picker.getByRole("button", { name: "1번 가상하늘 추가" })).toBeVisible();
  const colors = await picker.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    text: getComputedStyle(element.querySelector("h2")!).color,
  }));
  expect(colors.background).toBe("rgb(17, 24, 39)");
  expect(colors.text).toBe("rgb(248, 250, 252)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await picker.getByRole("button", { name: "1번 가상하늘 추가" }).click();
  await expect(picker.getByRole("button", { name: "1번 가상하늘 배정 해제" })).toBeVisible();
  expect(await picker.getByRole("button", { name: "2번 가상바다 추가" }).evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe("rgb(250, 249, 247)");
  await page.screenshot({ path: test.info().outputPath("role-assignment-midnight-large.png"), fullPage: true });
});
