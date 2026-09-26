import { expect, test, type Page } from "@playwright/test";
import {
  defaultRoleState,
  parseRoleRoster,
  roleMonthRange,
  roleToday,
} from "../../supabase/functions/_shared/classroomRoles";
const root = "/tools/classroom-roles";
const demoKey = "schooldoc_classroom_roles_demo_v1";
async function seed(page: Page, assigned = false) {
  const state = defaultRoleState();
  state.roster = parseRoleRoster("1 가상하늘\n2 가상바다\n3 가상하늘");
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
    page.getByRole("region", { name: "오늘의 간단한 현황" }),
  ).toContainText("오늘 배정된 역할이 없습니다");
  await expect(page.getByRole("button", { name: /가상하늘/ })).toHaveCount(0);
  expect(errors).toEqual([]);
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
  for (const [i, s] of board.state.roster.entries())
    await page
      .getByLabel(`${s.number}번 ${s.name} 역할`, { exact: true })
      .selectOption(board.state.roles[i].id);
  await expect(page.getByRole("status")).toContainText("미배정 학생 0명");
  await page.getByRole("checkbox").check();
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
  await page
    .getByLabel("학생 명단", { exact: true })
    .fill("1 가상학생\n1 중복학생");
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await expect(page.getByRole("alert")).toContainText("중복");
  await expect(page.getByLabel("학생 명단", { exact: true })).toHaveValue(
    "1 가상학생\n1 중복학생",
  );
  await page.getByLabel("학생 명단", { exact: true }).fill("1 가상학생");
  await page.getByRole("button", { name: "다음: 역할 설정" }).click();
  await page
    .getByLabel("시작일", { exact: true })
    .fill(board.state.periods[0].start);
  await page
    .getByLabel("종료일", { exact: true })
    .fill(board.state.periods[0].end);
  await page
    .getByLabel("1번 가상학생 역할")
    .selectOption(board.state.roles[0].id);
  await page.getByRole("checkbox").check();
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
  await expect(page.getByLabel("학생 명단", { exact: true })).toHaveValue(
    "1 새가상학생\n2 가상바다",
  );
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
