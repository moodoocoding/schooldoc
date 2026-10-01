import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

const evidence = "design/feature-reviews/2026-10-01-data-collect-fix";
const storeKey = "schooldoc_data_collect_v1";

async function observeStoreReads(page: Page) {
  await page.addInitScript((key) => {
    const getItem = Storage.prototype.getItem;
    Reflect.set(window, "__dataCollectStoreReads", 0);
    Storage.prototype.getItem = function (name: string) {
      if (name === key)
        Reflect.set(
          window,
          "__dataCollectStoreReads",
          Number(Reflect.get(window, "__dataCollectStoreReads")) + 1,
        );
      return getItem.call(this, name);
    };
  }, storeKey);
}
async function readCount(page: Page) {
  return page.evaluate(() =>
    Number(Reflect.get(window, "__dataCollectStoreReads")),
  );
}
async function create(page: Page, title: string) {
  await page.goto("/tools/data-collect/new");
  await page.getByLabel("제목").fill(title);
  await page.getByRole("radio", { name: /제출자가 이름 입력/ }).check();
  await page
    .getByRole("button", { name: "자료 수합 만들기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  return page.url();
}
async function saveShot(page: Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.screenshot({
    path: evidence + "/" + name + ".png",
    fullPage: true,
  });
}

test("실제 Chrome: 수동 새로고침 뒤 이전·다음 목록은 유효한 캐시를 다시 사용한다", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await observeStoreReads(page);
  for (let i = 0; i < 21; i++)
    await create(page, "가상 캐시 목록 " + String(i + 1).padStart(2, "0"));
  await page.goto("/tools/data-collect");
  const cards = page.getByRole("button").filter({ hasText: "가상 캐시 목록" });
  const refresh = page.getByRole("button", {
    name: "목록 새로고침",
    exact: true,
  });
  const next = page.getByRole("button", { name: "다음 목록", exact: true });
  const previous = page.getByRole("button", { name: "이전 목록", exact: true });
  await expect(cards).toHaveCount(20);
  await expect(refresh).toBeEnabled();
  const firstPage = await readCount(page);
  const started = Date.now();
  await next.click();
  await expect(cards).toHaveCount(1);
  const secondPage = await readCount(page);
  expect(secondPage).toBe(firstPage + 1);
  await previous.click();
  await expect(cards).toHaveCount(20);
  expect(await readCount(page)).toBe(secondPage);
  await refresh.click();
  await expect(refresh).toBeEnabled();
  await expect(cards).toHaveCount(20);
  const afterRefresh = await readCount(page);
  expect(afterRefresh).toBe(secondPage + 1);
  await next.click();
  await expect(cards).toHaveCount(1);
  const nextAfterRefresh = await readCount(page);
  expect(nextAfterRefresh).toBe(afterRefresh);
  await previous.click();
  await expect(cards).toHaveCount(20);
  const previousAfterRefresh = await readCount(page);
  expect(previousAfterRefresh).toBe(afterRefresh);
  await refresh.click();
  await expect(refresh).toBeEnabled();
  const secondRefresh = await readCount(page);
  expect(secondRefresh).toBe(afterRefresh + 1);
  expect(Date.now() - started).toBeLessThan(15_000);
  expect(errors).toEqual([]);
  await saveShot(page, "chrome-list-cache-followup");
  await writeFile(
    evidence + "/list-cache-followup.json",
    JSON.stringify(
      {
        method:
          "Installed Chrome, UI-created 21 fictional collections; native demo Storage.getItem observed without changing its return value",
        firstPage,
        secondPage,
        afterRefresh,
        nextAfterRefresh,
        previousAfterRefresh,
        secondRefresh,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
});

test("실제 Chrome: 목록을 열어 둔 채 실제 마감 시각을 지나면 조회 없이 상태가 바뀐다", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await observeStoreReads(page);
  await create(page, "가상 기한 없는 수합");
  await page.getByText(/마감 기한 변경 ·/).click();
  await page.getByRole("button", { name: "기한 없음", exact: true }).click();
  await expect(page.getByLabel("새 마감 시각")).toHaveValue("");
  await page.getByRole("button", { name: "기한 저장", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "기한 저장", exact: true }),
  ).toBeEnabled();
  await create(page, "가상 직접 종료 수합");
  await page.getByRole("button", { name: "수합 종료", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "다시 열기", exact: true }),
  ).toBeVisible();
  await create(page, "가상 실제 시각 마감 수합");
  await page.getByText(/마감 기한 변경 ·/).click();
  const deadline = new Date(Math.ceil((Date.now() + 15_000) / 60_000) * 60_000);
  const local = new Date(
    deadline.getTime() - deadline.getTimezoneOffset() * 60_000,
  )
    .toISOString()
    .slice(0, 16);
  await page.getByLabel("새 마감 시각").fill(local);
  await page.getByRole("button", { name: "기한 저장", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "기한 저장", exact: true }),
  ).toBeEnabled();
  await page.goto("/tools/data-collect");
  await page.setViewportSize({ width: 1366, height: 900 });
  const timed = page
    .getByRole("button")
    .filter({ hasText: "가상 실제 시각 마감 수합" });
  const open = page
    .getByRole("button")
    .filter({ hasText: "가상 기한 없는 수합" });
  const closed = page
    .getByRole("button")
    .filter({ hasText: "가상 직접 종료 수합" });
  await expect(timed).toContainText("수합 중");
  await expect(open).toContainText("수합 중");
  await expect(open).toContainText("기한 없음");
  await expect(closed.locator("span").first()).toHaveText("종료");
  const before = await readCount(page);
  const observedAt = new Date().toISOString();
  await saveShot(page, "chrome-list-deadline-before-followup");
  // Real wall-clock time: no page.clock/fake timers and no response mocking.
  await expect(timed).toContainText("기한 마감", {
    timeout: Math.max(0, deadline.getTime() - Date.now()) + 15_000,
  });
  const changedAt = new Date().toISOString();
  expect(Date.now()).toBeGreaterThanOrEqual(deadline.getTime());
  expect(Date.now() - deadline.getTime()).toBeLessThan(15_000);
  expect(await readCount(page)).toBe(before);
  await expect(open).toContainText("수합 중");
  await expect(closed.locator("span").first()).toHaveText("종료");
  await saveShot(page, "chrome-list-deadline-after-followup");
  const desktopAxe = (await new AxeBuilder({ page }).analyze()).violations;
  expect(desktopAxe).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(timed).toContainText("기한 마감");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await saveShot(page, "chrome-list-deadline-mobile-followup");
  const mobileAxe = (await new AxeBuilder({ page }).analyze()).violations;
  expect(mobileAxe).toEqual([]);
  expect(await readCount(page)).toBe(before);
  expect(errors).toEqual([]);
  await writeFile(
    evidence + "/list-deadline-followup.json",
    JSON.stringify(
      {
        method:
          "Installed Chrome and real wall-clock deadline, no mocked clock or API response; original demo storage reads counted",
        observedAt,
        deadline: deadline.toISOString(),
        changedAt,
        before,
        after: await readCount(page),
        desktopAxeViolations: desktopAxe.length,
        mobileAxeViolations: mobileAxe.length,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
});
