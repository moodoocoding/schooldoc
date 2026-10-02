import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// 실제 Supabase SDK + 가상 인증/업무 HTTP 응답을 사용한다. 실제 Google/EXE 검증이 아니다.
const user = { id: "d0739101-9368-44b8-932f-23a082b22722", aud: "authenticated", role: "authenticated", email: "recovery@example.invalid", app_metadata: { provider: "google", providers: ["google"] }, user_metadata: { name: "가상 복구 교사" }, created_at: "2026-10-02T00:00:00Z" };
const token = (marker: string) => Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ sub: user.id, aud: "authenticated", role: "authenticated", exp: 4102444800, iat: 1790884800, marker })).toString("base64url") + ".fictional-signature";
const session = (marker: string) => ({ access_token: token(marker), token_type: "bearer", refresh_token: "fictional-refresh-" + marker, expires_in: 3600, expires_at: 4102444800, user });
async function setup(page: Page, authStatus: number | "offline") {
  const errors: string[] = [];
  let authChecks = 0, createCalls = 0;
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(initialSession => {
    localStorage.setItem("sb-schooldoc-e2e-auth-token", JSON.stringify(initialSession));
    window.electronAPI = {
      isElectron: true,
      getInfo: async () => ({ version: "fixture", commit: "fixture", dirty: false, supabaseUrl: "", publicAppUrl: "" }),
      prepareGoogleOAuth: async () => ({ id: "fixture-attempt", redirectUrl: "http://127.0.0.1:45999/callback" }),
      completeGoogleOAuth: async () => "fictional-code",
      cancelGoogleOAuth: async () => {},
    };
  }, session("old"));
  await page.route("**/src/features/studentResults/studentResultsConfig.ts", route => route.fulfill({ contentType: "application/javascript", body: `
    export const isStudentResultsDemoMode = false;
    export const studentResultsOwnerId = id => id || "";
    export { getPublicAppOrigin as getStudentResultsPublicOrigin } from "/src/utils/publicAppOrigin.ts";
  ` }));
  await page.route("https://schooldoc-e2e.invalid/auth/v1/user", async route => {
    authChecks++;
    if (authStatus === "offline") return route.abort("failed");
    await route.fulfill({ status: authStatus, json: authStatus === 200 ? user : { code: "bad_jwt", message: "Fictional session is invalid" } });
  });
  await page.route("https://schooldoc-e2e.invalid/auth/v1/token**", route => route.fulfill({ json: session("new") }));
  await page.route("https://schooldoc-e2e.invalid/rest/v1/**", route => route.fulfill({ json: [] }));
  await page.route("https://schooldoc-e2e.invalid/functions/v1/**", async route => {
    const body = route.request().postDataJSON() as { action: string };
    if (route.request().url().endsWith("student-results-admin") && body.action === "create") {
      createCalls++;
      return route.fulfill({ status: 401, json: { error: "Google 로그인이 필요합니다." } });
    }
    return route.fulfill({ json: { events: [] } });
  });
  await page.goto("/#/tools/student-results/new");
  await page.getByLabel("제목", { exact: true }).fill("가상 세션 복구 검사");
  await page.getByLabel("1번 학생 성명").fill("가상하늘");
  await page.getByLabel("1번 학생 확인번호").fill("4821");
  await page.getByLabel("1번 학생 평가 점수 점수").fill("82");
  return { errors, counts: () => ({ authChecks, createCalls }) };
}

for (const width of [1366, 390]) test("서버 만료 확인 → 재로그인 → 같은 탭 입력 복원 " + width, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const state = await setup(page, 401);
  await page.getByRole("button", { name: "결과 안내 만들기", exact: true }).click();
  const login = page.getByRole("button", { name: "Google로 로그인", exact: true });
  await expect(login).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "로그인 연결이 만료" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "사용자 메뉴: 가상 복구 교사" })).toHaveCount(0);
  expect(state.counts()).toEqual({ authChecks: 1, createCalls: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dimensions = await login.boundingBox(); expect(dimensions!.height).toBeGreaterThanOrEqual(44);
  await login.focus(); await expect(login).toBeFocused();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(scan.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("login-recovery-" + width + ".png"), fullPage: true });
  await login.press("Enter");
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue("가상 세션 복구 검사");
  await expect(page.getByLabel("1번 학생 성명")).toHaveValue("가상하늘");
  await expect(page.getByLabel("1번 학생 평가 점수 점수")).toHaveValue("82");
  await expect(page.getByText("이 탭에서 작성하던 내용을 복원했습니다.")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "로그인 연결이 만료" })).toHaveCount(0);
  expect(state.counts().createCalls).toBe(1); // 저장을 자동 재시도하지 않는다.
  expect(state.errors).toEqual([]);
});

for (const authStatus of [200, 500, "offline"] as const) test("업무 401 뒤 인증 확인 " + authStatus + "은 입력과 사용자 상태를 유지", async ({ page }) => {
  const state = await setup(page, authStatus);
  await page.getByRole("button", { name: "결과 안내 만들기", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Google 로그인이 필요합니다." })).toBeVisible();
  await expect.poll(() => state.counts().authChecks).toBe(1);
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue("가상 세션 복구 검사");
  await expect(page.getByRole("button", { name: "사용자 메뉴: 가상 복구 교사" })).toBeVisible();
  expect(state.counts().createCalls).toBe(1);
  expect(state.errors).toEqual([]);
});
