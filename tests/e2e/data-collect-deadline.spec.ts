import { expect, test } from "@playwright/test";
// API 왕복은 가상 HTTP 응답이다. 실제 PostgreSQL 저장·마감 차단은 별도 SQL 검사로 확인한다.
for (const timezoneId of ["Asia/Seoul", "America/Los_Angeles"]) test.describe(timezoneId, () => {
  test.use({ timezoneId });
  test("생성·재조회·마감 변경에서 선택한 현지 시각을 유지한다", async ({ page }, testInfo) => {
    const writes: { action: string; dueAt: string }[] = [];
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    let dueAt = "";
    const collection = () => ({ id: "fixture-collection", title: "가상 마감 왕복", mode: "custom", status: "open", dueAt, createdAt: "2026-10-02T00:00:00Z", hasTemplate: false, total: 0, responded: 0, needsRepair: 0, confirmed: 0, corrected: 0, submitted: 0, publicToken: "fixture-public", description: "", allowResubmit: true, templateName: "", closedAt: "", retentionMonths: 12 });
    const overview = () => ({ collection: collection(), targets: [], nextAfter: null });
    await page.route("**/src/features/dataCollect/dataCollectConfig.ts", route => route.fulfill({ contentType: "application/javascript", body: 'export const isDataCollectDemoMode = false; export const dataCollectOwnerId = id => id || "";' }));
    await page.route("**/src/utils/supabaseClient.ts", route => route.fulfill({ contentType: "application/javascript", body: `
      export const isSupabaseConfigured = true;
      const user = {id:"virtual-deadline-teacher",user_metadata:{name:"가상 마감 교사"}};
      export const supabase = {
        auth:{getSession:async()=>({data:{session:{user}}}),getUser:async()=>({data:{user}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
        functions:{invoke:async(name,options)=>{const r=await fetch("/__fixture_deadline",{method:"POST",body:JSON.stringify(options.body)});return r.ok?{data:await r.json(),error:null}:{data:null,error:{context:r}}}},
        from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:null,error:null})};return q},
        channel(){const c={on(){return c},subscribe(){return c}};return c},removeChannel:async()=>{},
      };
    ` }));
    await page.route("**/__fixture_deadline", async route => {
      const body = route.request().postDataJSON() as { action: string; dueAt: string };
      if (body.action === "create" || body.action === "due") {
        writes.push({ action: body.action, dueAt: body.dueAt });
        if (body.dueAt && !/Z$|[+-]\d{2}:\d{2}$/.test(body.dueAt)) {
          return route.fulfill({ status: 422, json: { error: "Fixture requires an explicit timezone" } });
        }
        dueAt = body.dueAt ? new Date(body.dueAt).toISOString() : "";
        return route.fulfill({ json: body.action === "create" ? { id: "fixture-collection" } : overview() });
      }
      return route.fulfill({ json: overview() });
    });
    await page.goto("/tools/data-collect/new");
    await page.getByRole("textbox", { name: "제목 필수", exact: true }).fill("가상 마감 왕복");
    await page.getByRole("radio", { name: /제출자가 이름 입력/ }).check();
    await page.getByLabel("마감 날짜").fill("2030-10-09");
    await page.getByLabel("마감 시간").selectOption("17:00");
    await page.getByRole("button", { name: "자료 수합 만들기", exact: true }).click();
    await expect(page.getByRole("heading", { name: "가상 마감 왕복", exact: true })).toBeVisible();
    expect(writes).toEqual([{ action: "create", dueAt: timezoneId === "Asia/Seoul" ? "2030-10-09T08:00:00.000Z" : "2030-10-10T00:00:00.000Z" }]);
    await page.reload();
    await page.locator("summary").filter({ hasText: "마감 기한 변경" }).click();
    await expect(page.getByLabel("새 마감 시각")).toHaveValue("2030-10-09T17:00");
    await page.screenshot({ path: testInfo.outputPath("deadline-roundtrip.png"), fullPage: true });
    await page.getByLabel("새 마감 시각").fill("2030-10-10T17:30");
    await page.getByRole("button", { name: "기한 저장", exact: true }).click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1]).toEqual({ action: "due", dueAt: timezoneId === "Asia/Seoul" ? "2030-10-10T08:30:00.000Z" : "2030-10-11T00:30:00.000Z" });
    await page.reload(); await page.locator("summary").filter({ hasText: "마감 기한 변경" }).click();
    await expect(page.getByLabel("새 마감 시각")).toHaveValue("2030-10-10T17:30");
    await page.getByRole("button", { name: "기한 없음", exact: true }).click();
    await page.getByRole("button", { name: "기한 저장", exact: true }).click();
    await expect.poll(() => writes.length).toBe(3); expect(writes[2].dueAt).toBe("");
    await page.reload(); await page.locator("summary").filter({ hasText: "마감 기한 변경" }).click();
    await expect(page.getByLabel("새 마감 시각")).toHaveValue("");
    expect(errors).toEqual([]);
  });
});
