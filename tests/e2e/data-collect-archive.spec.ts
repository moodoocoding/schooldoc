import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const evidence =
  process.env.DATA_COLLECT_TEST_EVIDENCE_DIR ??
  "test-results/data-collect-evidence";
const root = "/tools/data-collect";
const localDateTime = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

async function makeCollection(page: Page, title: string) {
  await page.goto(root + "/new");
  await page.getByLabel("제목").fill(title);
  await page.getByRole("radio", { name: /제출자가 이름 입력/ }).check();
  await page
    .getByRole("button", { name: "자료 수합 만들기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  return {
    manage: page.url(),
    publicUrl: await page.getByLabel("자료 수합 공개 링크").inputValue(),
  };
}

test("실제 Chrome: 수합 중 기한을 바꾸고 보관함에서 재개하거나 선택한 항목만 삭제한다", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 900 });
  const title = "가상 학급 탐구 활동 자료와 사진 수합";
  const links = await makeCollection(page, title);
  const publicPage = await page.context().newPage();
  await publicPage.goto(links.publicUrl);
  await publicPage
    .getByLabel("제출자 이름", { exact: true })
    .fill("가상제출자");
  await publicPage.getByLabel("전달 사항").fill("가상 시험용 메모");
  await publicPage.getByLabel("제출 파일 선택").setInputFiles({
    name: "가상제출.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nFictional test only\n%%EOF"),
  });
  await publicPage
    .getByRole("button", { name: "회신 제출", exact: true })
    .click();
  await expect(
    publicPage.getByRole("heading", { name: "회신을 제출했습니다" }),
  ).toBeVisible();

  await page.goto(links.manage);
  await page.setViewportSize({ width: 390, height: 844 });
  const deadlineControl = page.getByText(/마감 기한 변경 ·/);
  await expect(deadlineControl).toBeInViewport();
  await deadlineControl.focus();
  await page.keyboard.press("Enter");
  const newDeadline = page.getByLabel("새 마감 시각");
  const nextDate = localDateTime(new Date(Date.now() + 172_800_000));
  const nextLabel = await page.evaluate(
    (value) => new Date(value).toLocaleString("ko-KR"),
    nextDate,
  );
  await newDeadline.fill(nextDate);
  await page
    .getByRole("button", { name: "현황 새로고침", exact: true })
    .click();
  await expect(newDeadline).toHaveValue(nextDate);
  await expect(deadlineControl).not.toContainText(nextLabel);
  await deadlineControl.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({
    path: evidence + "/active-deadline-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "기한 저장", exact: true }).click();
  await expect(deadlineControl).toContainText(nextLabel);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.reload();
  await expect(deadlineControl).toContainText(nextLabel);
  await expect(page.getByLabel("자료 수합 공개 링크")).toHaveValue(
    links.publicUrl,
  );
  await expect(
    page.getByRole("cell", { name: "가상제출자", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: evidence + "/active-deadline-desktop.png",
    fullPage: true,
  });
  await deadlineControl.click();
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: evidence + "/active-deadline-zoom200.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });

  await page.getByRole("button", { name: "수합 종료", exact: true }).click();
  await expect(page.getByRole("button", { name: "보관함으로" })).toBeVisible();
  await makeCollection(page, "가상 유지할 보관 항목");
  await page.getByRole("button", { name: "수합 종료", exact: true }).click();
  await expect(page.getByRole("button", { name: "보관함으로" })).toBeVisible();
  await makeCollection(page, "가상 진행 항목");
  await page.goto(root);
  await expect(
    page.getByRole("heading", { name: "가상 진행 항목" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({
    path: evidence + "/archive-active-desktop.png",
    fullPage: true,
  });
  const archiveLink = page.getByRole("link", { name: "보관함", exact: true });
  await archiveLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/view=archive$/);
  await expect(archiveLink).toHaveAttribute("aria-current", "page");
  const card = page.getByRole("button").filter({ hasText: title });
  await expect(card).toContainText("1/1 회신");
  await expect(
    page.getByRole("heading", { name: "가상 진행 항목" }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: evidence + "/archive-list-zoom200.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  await card.click();
  await page.getByRole("button", { name: "다시 열기", exact: true }).click();
  const reopen = page.getByRole("dialog", { name: "자료 수합 다시 열기" });
  const reopenButton = reopen.getByRole("button", {
    name: "다시 열기",
    exact: true,
  });
  await expect(
    reopen.getByRole("button", { name: "취소", exact: true }),
  ).toBeFocused();
  await reopen
    .getByLabel("새 마감 시각")
    .fill(localDateTime(new Date(Date.now() - 86_400_000)));
  await reopenButton.click();
  await expect(reopen.getByRole("alert")).toContainText("현재보다 뒤로");
  await reopen
    .getByLabel("새 마감 시각")
    .fill(localDateTime(new Date(Date.now() + 172_800_000)));
  await page.screenshot({
    path: evidence + "/archive-reopen-desktop.png",
    fullPage: true,
  });
  await reopenButton.click();
  await expect(reopen).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "수합 종료", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("자료 수합 공개 링크")).toHaveValue(
    links.publicUrl,
  );
  await expect(
    page.getByRole("cell", { name: "가상제출자", exact: true }),
  ).toBeVisible();
  await publicPage.reload();
  await expect(
    publicPage.getByRole("heading", { name: "자료 수합이 종료되었습니다" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "자료 수합 목록", exact: true })
    .click();
  await expect(
    page.getByRole("button").filter({ hasText: title }),
  ).toContainText("1/1 회신");
  await expect(
    page.getByRole("button", { name: "영구 삭제", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button").filter({ hasText: title }).click();
  await page.getByRole("button", { name: "수합 종료", exact: true }).click();
  const deleteTrigger = page.getByRole("button", {
    name: "영구 삭제",
    exact: true,
  });
  await deleteTrigger.click();
  const deletion = page.getByRole("dialog", { name: "자료 수합 영구 삭제" });
  const approve = deletion.getByRole("button", {
    name: "영구 삭제",
    exact: true,
  });
  await expect(deletion.getByText("1명", { exact: true })).toBeVisible();
  await expect(deletion.getByText("1건", { exact: true })).toBeVisible();
  await expect(deletion.getByText("1개", { exact: true })).toBeVisible();
  await expect(approve).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(deletion).toHaveCount(0);
  await expect(deleteTrigger).toBeFocused();
  await expect(
    page.getByRole("cell", { name: "가상제출자", exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: evidence + "/archive-detail-mobile.png",
    fullPage: true,
  });
  await deleteTrigger.click();
  await deletion.getByRole("checkbox").check();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id),
  ).toEqual([]);
  await page.screenshot({
    path: evidence + "/archive-delete-mobile.png",
    fullPage: true,
  });
  await approve.click();
  await expect(page).toHaveURL(/view=archive$/);
  await expect(
    page.getByRole("heading", { name: "가상 유지할 보관 항목" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "가상 유지할 보관 항목" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  await publicPage.reload();
  await expect(
    publicPage.getByRole("heading", {
      name: "자료 수합을 찾을 수 없습니다",
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await publicPage.close();
});
