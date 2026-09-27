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
    await expect(link).toContainText(
      index === 3 || index === 4 ? "학급 실천" : "운영 관리",
    );
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

test("역할별 다중 선택·정원 제한·역할 이동·일괄 선택과 저장", async ({
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
  await checkbox("1번 가상하늘 선택").check();
  await checkbox("2번 가상바다 선택").check();
  await expect(checkbox("3번 가상하늘 선택")).toBeDisabled();
  await page.getByLabel(`${first.name} 정원`, { exact: true }).fill("1");
  await expect(page.getByRole("alert")).toContainText("이미 선택한 2명");
  await expect(
    page.getByLabel(`${first.name} 정원`, { exact: true }),
  ).toHaveValue("2");
  await page
    .getByRole("button", { name: `${second.name} 학생 선택`, exact: true })
    .click();
  await expect(
    page.getByText(`현재: ${first.name} · 선택 시 이동`),
  ).toHaveCount(2);
  await checkbox("2번 가상바다 선택").check();
  await expect(
    page.getByRole("button", { name: `${first.name} 학생 선택`, exact: true }),
  ).toContainText("배정 1/2명");
  await page
    .getByRole("button", { name: "미배정 1명 모두 선택", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("미배정 학생 0명");
  await checkbox("배정 내용 확인").check();
  await checkbox("2번 가상바다 선택").uncheck();
  await expect(checkbox("배정 내용 확인")).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "배정 확정하기" }),
  ).toBeDisabled();
  await checkbox("2번 가상바다 선택").check();
  await page.getByRole("button", { name: "이전: 명단 확인" }).click();
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await expect(page.getByRole("status")).toContainText("미배정 학생 0명");
  await checkbox("배정 내용 확인").check();
  await page.getByRole("button", { name: "배정 확정하기" }).click();
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
  await page.getByRole("button", { name: "이전: 명단 확인" }).click();
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
  await expect(page.getByRole("status")).toContainText("미배정 학생 1명");
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
  await page
    .getByRole("button", {
      name: `${board.state.roles[0].name} 학생 선택`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", { name: "담당 학생 선택", exact: true }),
  ).toBeFocused();
  const first = page.getByRole("checkbox", {
    name: "1번 가상학생01 선택",
    exact: true,
  });
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  await page.getByLabel("학생 이름 또는 번호 검색").fill("학생30");
  await page
    .getByRole("checkbox", { name: "30번 가상학생30 선택", exact: true })
    .check();
  await page.getByLabel("학생 이름 또는 번호 검색").fill("");
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
  await page
    .getByRole("button", { name: "다른 역할 선택", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: `${board.state.roles[0].name} 학생 선택`,
      exact: true,
    }),
  ).toBeFocused();
  await page.setViewportSize({ width: 1366, height: 900 });
  await page
    .getByRole("region", { name: "역할별 학생 배정", exact: true })
    .screenshot({ path: test.info().outputPath("role-students-desktop.png") });
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
  await page.getByText("새 역할 추가", { exact: true }).click();
  await page.getByLabel("새 역할 이름", { exact: true }).fill("함께 정리");
  await page.getByRole("button", { name: "역할 추가", exact: true }).click();
  await page.getByLabel("함께 정리 정원", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "미배정 2명 모두 선택", exact: true })
    .click();
  await page
    .getByRole("button", { name: "이 역할 선택 해제", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("미배정 학생 2명");
  await page
    .getByRole("button", { name: "미배정 2명 모두 선택", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "배정 내용 확인", exact: true })
    .check();
  await page.getByRole("button", { name: "배정 확정하기" }).click();
  await expect(page).toHaveURL(`${root}/board`);
});

test("자동 명단 → 2단계 배정 → 공용 제출·재제출 → 월간 상세", async ({
  page,
  context,
}) => {
  const board = await seed(page);
  await page.getByRole("link", { name: /학생 역할 배정/ }).click();
  await expect(
    page.getByText("설정에 저장된 학생 명단을 자동으로 불러왔습니다."),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await expect(page.getByRole("status")).toContainText("미배정 학생 3명");
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
  await expect(page.getByRole("status")).toContainText("미배정 학생 0명");
  await page
    .getByRole("checkbox", { name: "배정 내용 확인", exact: true })
    .check();
  await page.getByRole("button", { name: "배정 확정하기" }).click();
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
  await expect(
    page.getByText(`이전 역할: ${board.state.roles[0].name}`),
  ).toBeVisible();
  const start = await page.getByLabel("시작일", { exact: true }).inputValue();
  expect(start > board.state.periods[0].end).toBe(true);
  await expect(
    page.getByRole("button", { name: "배정 확정하기" }),
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
  await page
    .getByLabel("시작일", { exact: true })
    .fill(board.state.periods[0].start);
  await page
    .getByLabel("종료일", { exact: true })
    .fill(board.state.periods[0].end);
  await page
    .getByRole("checkbox", { name: "1번 가상학생 선택", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "배정 내용 확인", exact: true })
    .check();
  await page.getByRole("button", { name: "배정 확정하기" }).click();
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
