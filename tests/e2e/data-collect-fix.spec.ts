import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
const evidence = "design/feature-reviews/2026-10-01-data-collect-fix";
const pdf = {
  name: "가상자료.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7\nvirtual test\n%%EOF"),
};
async function create(
  page: Page,
  title: string,
  custom = true,
  template = false,
  noResubmit = false,
  roster = "국어",
) {
  await page.goto("/tools/data-collect/new");
  await page.getByLabel("제목").fill(title);
  if (custom)
    await page.getByRole("radio", { name: /제출자가 이름 입력/ }).check();
  else {
    await page.getByLabel("이름 입력 또는 붙여넣기").fill(roster);
    await page
      .getByRole("button", { name: "입력한 이름 반영", exact: true })
      .click();
  }
  if (template) {
    await page.getByRole("radio", { name: /파일을 보내 검토받기/ }).check();
    await page.locator('input[type=file][accept*=".pdf"]').setInputFiles(pdf);
  }
  if (noResubmit) {
    await page.getByText("추가 설정", { exact: true }).click();
    await page.getByLabel("제출 후 파일 교체 허용").uncheck();
  }
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
async function saveShot(page: Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.screenshot({
    path: evidence + "/" + name + ".png",
    fullPage: true,
  });
}
test("실제 Chrome: 잘못된 파일은 대상 생성 없이 차단하고 코드를 복구하여 버전을 유지한다", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const links = await create(page, "실제 검증: 복구와 파일 제한");
  await page.goto(links.publicUrl);
  await page.getByLabel("제출자 이름", { exact: true }).fill("가상 제출자");
  await page.getByLabel("전달 사항").fill("검증용 전달 사항");
  await page.getByLabel("제출 파일 선택").setInputFiles({
    name: "위장.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not PDF"),
  });
  await page.getByRole("button", { name: "회신 제출", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("실제 파일 형식");
  await expect(page.getByLabel("전달 사항")).toHaveValue("검증용 전달 사항");
  await page.goto(links.manage);
  await expect(
    page.getByRole("cell", { name: "아직 제출 대상이 없습니다.", exact: true }),
  ).toBeVisible();
  await page.goto(links.publicUrl);
  await page.getByLabel("제출자 이름", { exact: true }).fill("가상 제출자");
  await page.getByLabel("제출 파일 선택").setInputFiles(pdf);
  await page.getByLabel("전달 사항").fill("첫 제출 메모");
  await page.getByRole("button", { name: "회신 제출", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "회신을 제출했습니다" }),
  ).toBeVisible();
  const receipt = await page
    .getByLabel("제출 복구 코드", { exact: true })
    .inputValue();
  expect(receipt).toMatch(/^[a-f\d-]{36}$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "회신을 제출했습니다" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다시 회신하기" }).click();
  await expect(page.getByText(/이미 1차/)).toBeVisible();
  await page
    .getByLabel("제출 파일 선택")
    .setInputFiles({ ...pdf, name: "수정자료.pdf" });
  await page.getByLabel("전달 사항").fill("둘째 제출 메모");
  await page.getByRole("button", { name: "새 버전으로 회신" }).click();
  await expect(page.getByText(/제출 완료 · 2차/)).toBeVisible();
  await page.screenshot({
    path: evidence + "/chrome-custom-complete.png",
    fullPage: true,
  });
  // 별도 탭(동일 데모 자료 저장소)에서 보관한 코드로 명시적으로 복구.
  const second = await page.context().newPage();
  await second.goto(links.publicUrl);
  await second.getByText("이전에 제출한 자료 찾기", { exact: true }).click();
  await second.getByLabel("제출 복구 코드", { exact: true }).fill(receipt);
  await second.getByRole("button", { name: "내 제출 찾기" }).click();
  await expect(second.getByText(/제출 완료 · 2차/)).toBeVisible();
  await second.close();
  await page.goto(links.manage);
  await expect(
    page.getByRole("cell", { name: "가상 제출자", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "전달 사항 있음 · 이력" }).click();
  await expect(page.getByText("둘째 제출 메모", { exact: true })).toBeVisible();
  await expect(page.getByText("첫 제출 메모", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await saveShot(page, "chrome-manage-first");
  expect(errors).toEqual([]);
  expect(browser.browserType().name()).toBe("chromium");
});
test("실제 Chrome: 재제출 금지·동명이인·검색 빈 결과와 오류가 구분된다", async ({
  page,
}) => {
  const links = await create(page, "실제 검증: 재제출 금지", true, false, true);
  await page.goto(links.publicUrl);
  await page.getByLabel("제출자 이름", { exact: true }).fill("가상 동명이인");
  await page.getByLabel("제출 파일 선택").setInputFiles(pdf);
  await page.getByRole("button", { name: "회신 제출", exact: true }).click();
  await page.reload();
  await expect(page.getByText("제출이 끝나 바꿀 수 없습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 회신하기" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "다른 사람 제출" }).click();
  await page.getByLabel("제출자 이름", { exact: true }).fill("가상 동명이인");
  await page.getByLabel("제출 파일 선택").setInputFiles(pdf);
  await page.getByRole("button", { name: "회신 제출", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "회신을 제출했습니다" }),
  ).toBeVisible();
  await page.goto(links.manage);
  await expect(
    page.getByRole("cell", { name: "가상 동명이인", exact: true }),
  ).toHaveCount(2);
  const fixed = await create(page, "실제 검증: 검색 상태", false, true);
  await page.goto(fixed.publicUrl);
  await page.getByRole("button", { name: "찾기", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "두 글자 이상 입력해 주세요.",
  );
  await page.getByLabel("제출 대상 이름", { exact: true }).fill("없는 이름");
  await page.getByRole("button", { name: "찾기", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "일치하는 대상이 없습니다.",
  );
  await page.getByLabel("제출 대상 이름", { exact: true }).fill("국어");
  await page.getByRole("button", { name: "찾기", exact: true }).click();
  await page.getByRole("button", { name: "국○", exact: true }).click();
  await page.getByRole("button", { name: "이상 없음", exact: true }).click();
  await page.getByRole("button", { name: "회신 제출", exact: true }).click();
  await expect(page.getByText(/이상 없음 · 1차/)).toBeVisible();
  await page.goto(fixed.manage);
  await expect(
    page.getByRole("cell", { name: "이상 없음", exact: true }),
  ).toBeVisible();
});
test("실제 Chrome: Excel·ZIP·QR을 실제 파일로 저장하고 A4 PDF를 만든다", async ({
  page,
}) => {
  const links = await create(page, "실제 검증: 내보내기");
  await page.goto(links.publicUrl);
  await page.getByLabel("제출자 이름", { exact: true }).fill("가상 내보내기");
  await page.getByLabel("제출 파일 선택").setInputFiles(pdf);
  await page.getByLabel("전달 사항").fill("줄바꿈 첫째\n둘째 전달 사항");
  await page.getByRole("button", { name: "회신 제출", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "회신을 제출했습니다" }),
  ).toBeVisible();
  await page.goto(links.manage);
  for (const [label, fileName] of [
    ["Excel 저장", "current.xlsx"],
    ["QR 이미지 저장", "qr.png"],
  ] as const) {
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    await (await downloaded).saveAs(evidence + "/" + fileName);
  }
  await page
    .getByRole("checkbox", { name: "1번 파일 ZIP 선택", exact: true })
    .check();
  await expect(page.getByText(/ZIP 선택 1개/)).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "선택 파일 ZIP 저장" }).click();
  await (await downloaded).saveAs(evidence + "/current.zip");
  // 실제 인쇄 버튼이 만든 동일한 출력 DOM을 Chrome PDF 엔진으로 출력.
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByRole("button", { name: "A4 인쇄 · PDF" }).click();
  await expect(page.locator(".data-collect-print-root")).toHaveCount(1);
  await page.pdf({
    path: evidence + "/current.pdf",
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await saveShot(page, "chrome-export-first");
});
test("실제 Chrome: 120명 페이지 이동·미제출 필터·마감 연장·모바일 및 200% 화면", async ({
  page,
}) => {
  const roster = Array.from(
    { length: 120 },
    (_, i) => "가상대상" + String(i + 1).padStart(3, "0"),
  ).join("\n");
  const links = await create(
    page,
    "실제 검증: 120명 현황",
    false,
    false,
    false,
    roster,
  );
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await page.getByRole("button", { name: "다음 50명" }).click();
  await expect(
    page.getByRole("cell", { name: "가상대상051", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음 50명" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await expect(page.getByRole("button", { name: "다음 50명" })).toBeDisabled();
  await page.getByRole("button", { name: "이전 50명" }).click();
  await expect(
    page.getByRole("cell", { name: "가상대상051", exact: true }),
  ).toBeVisible();
  await page.getByLabel("미제출만 보기").check();
  await expect(
    page.getByRole("cell", { name: "가상대상001", exact: true }),
  ).toBeVisible();
  await page.getByText(/마감 기한 변경 ·/).click();
  await page.getByRole("button", { name: "기한 없음", exact: true }).click();
  await page.getByRole("button", { name: "기한 저장", exact: true }).click();
  await expect(
    page.getByText("마감 기한 변경 · 기한 없음", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "수합 종료", exact: true }).click();
  await expect(page.getByText("종료", { exact: true })).toBeVisible();
  await page.goto(links.publicUrl);
  await expect(
    page.getByRole("heading", { name: "자료 수합이 종료되었습니다" }),
  ).toBeVisible();
  await page.goto(links.manage);
  await page.getByRole("button", { name: "다시 열기", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await saveShot(page, "chrome-manage-mobile-first");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const qr = page.locator("svg[role=img]");
  await expect(qr).toBeVisible();
  const card = page.getByText("공유 링크와 QR", { exact: true }).locator("..");
  const qrBox = await qr.boundingBox(),
    cardBox = await card.boundingBox();
  expect(qrBox!.x + qrBox!.width).toBeLessThanOrEqual(
    cardBox!.x + cardBox!.width,
  );
  await page.setViewportSize({ width: 720, height: 450 });
  await saveShot(page, "chrome-manage-200-first");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto(links.publicUrl);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("제출 대상 이름", { exact: true }).fill("가상대상001");
  await page.getByRole("button", { name: "찾기", exact: true }).click();
  await page.getByRole("button", { name: /가○○1/ }).click();
  await saveShot(page, "chrome-public-mobile-first");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => ({ id: v.id, impact: v.impact }))).toEqual(
    [],
  );
});

test("실제 Chrome: 긴 이름·혼합 상태·4000자 메모를 30명 A4 전체 페이지에 출력한다", async ({
  page,
}) => {
  const labels = Array.from(
    { length: 30 },
    (_, i) =>
      "가상긴대상" + "가나다라".repeat(15) + String(i + 1).padStart(3, "0"),
  );
  const links = await create(
    page,
    "실제 검증: 긴 내용 A4",
    false,
    true,
    false,
    labels.join("\n"),
  );
  for (let i = 0; i < 3; i++) {
    await page.goto(links.publicUrl);
    await page.getByLabel("제출 대상 이름", { exact: true }).fill(labels[i]);
    await page.getByRole("button", { name: "찾기", exact: true }).click();
    await page
      .getByRole("button", { name: "가○○" + labels[i].at(-1), exact: true })
      .click();
    await page
      .getByRole("button", {
        name: i === 1 ? "수정본 제출" : "이상 없음",
        exact: true,
      })
      .click();
    if (i === 1) await page.getByLabel("제출 파일 선택").setInputFiles(pdf);
    if (i === 1)
      await page
        .getByLabel("전달 사항")
        .fill("가상 검증 메모입니다. ".repeat(400).slice(0, 3997) + "끝표시");
    await page.getByRole("button", { name: "회신 제출", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "회신을 제출했습니다" }),
    ).toBeVisible();
  }
  await page.goto(links.manage);
  await saveShot(page, "chrome-manage-mixed-final");
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByRole("button", { name: "A4 인쇄 · PDF" }).click();
  await expect(page.locator(".data-collect-print-root")).toHaveCount(1);
  await page.pdf({
    path: evidence + "/long-current.pdf",
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await saveShot(page, "chrome-manage-mixed-mobile-final");
  const axe = await new AxeBuilder({ page })
    .exclude(".data-collect-print-root")
    .analyze();
  expect(axe.violations.map((v) => ({ id: v.id, impact: v.impact }))).toEqual(
    [],
  );
});

test("실제 Chrome: 실제 마감 시각 경과 후 차단되고 연장 시 입력을 유지한다", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const links = await create(page, "실제 검증: 시각 경계", false);
  const future = new Date(Math.ceil((Date.now() + 5000) / 60000) * 60000);
  const local = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  await page.getByText(/마감 기한 변경 ·/).click();
  await page.getByLabel("새 마감 시각").fill(local(future));
  await page.getByRole("button", { name: "기한 저장", exact: true }).click();
  const publicPage = await page.context().newPage();
  await publicPage.goto(links.publicUrl);
  await publicPage.getByLabel("제출 대상 이름", { exact: true }).fill("국어");
  await publicPage.getByRole("button", { name: "찾기", exact: true }).click();
  await publicPage.getByRole("button", { name: "국○", exact: true }).click();
  await publicPage.getByLabel("전달 사항").fill("기한 중 작성한 메모");
  await publicPage.getByLabel("제출 파일 선택").focus();
  const chooser = publicPage.waitForEvent("filechooser");
  await publicPage.keyboard.press("Space");
  await (await chooser).setFiles(pdf);
  await publicPage.waitForTimeout(
    Math.max(0, future.getTime() - Date.now() + 11000),
  );
  await expect(
    publicPage.getByRole("heading", { name: "자료 수합이 종료되었습니다" }),
  ).toBeVisible();
  await expect(page.getByText("기한 마감", { exact: true })).toBeVisible();
  await publicPage
    .getByRole("button", { name: "상태 다시 확인", exact: true })
    .click();
  await expect(
    publicPage.getByRole("heading", { name: "자료 수합이 종료되었습니다" }),
  ).toBeVisible();
  await saveShot(publicPage, "chrome-public-deadline-final");
  await page
    .getByLabel("새 마감 시각")
    .fill(local(new Date(Date.now() + 86400000)));
  await page.getByRole("button", { name: "기한 저장", exact: true }).click();
  await expect(publicPage.getByLabel("전달 사항")).toHaveValue(
    "기한 중 작성한 메모",
  );
  await expect(publicPage.getByText(pdf.name, { exact: true })).toBeVisible();
  await publicPage
    .getByRole("button", { name: "회신 제출", exact: true })
    .click();
  await expect(
    publicPage.getByRole("heading", { name: "회신을 제출했습니다" }),
  ).toBeVisible();
  await publicPage.close();
});

test("실제 Chrome: 설정 명단 미리보기·취소·반영과 목록 20개 페이지를 확인한다", async ({
  page,
}) => {
  await page.goto("/tools/data-collect");
  await expect(
    page.getByRole("heading", { name: "아직 자료 수합이 없습니다" }),
  ).toBeVisible();
  await saveShot(page, "chrome-list-empty-final");
  await page.goto("/tools/data-collect/new");
  await page.getByLabel("이름 입력 또는 붙여넣기").fill("기존가상");
  await page
    .getByRole("button", { name: "입력한 이름 반영", exact: true })
    .click();
  await page.getByRole("button", { name: "설정의 학급 명단 가져오기" }).click();
  await expect(
    page.getByText("설정에 저장된 명단이 없습니다. 기존 입력은 유지됩니다."),
  ).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByLabel("1번 제출 대상")).toHaveValue("기존가상");
  await page.goto("/");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "학급 학생 명단", exact: true })
    .click();
  await page
    .getByLabel("학생 명단 (한 줄에 번호와 이름)")
    .fill("1 가상하늘\n2 가상바다");
  await page
    .getByRole("button", { name: "학생 명단 저장", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "저장된 학급 명단" }),
  ).toContainText("가상하늘");
  await page.goto("/tools/data-collect/new");
  await page.getByRole("button", { name: "설정의 학급 명단 가져오기" }).click();
  await expect(page.getByText("설정 명단 미리보기 · 2명")).toBeVisible();
  await page.getByRole("button", { name: "설정 명단 반영" }).click();
  await expect(page.getByLabel("1번 제출 대상")).toHaveValue("기존가상");
  await expect(page.getByLabel("2번 제출 대상")).toHaveValue("가상하늘");
  await page.getByRole("button", { name: "실행 취소", exact: true }).click();
  await expect(page.getByLabel("2번 제출 대상")).toHaveCount(0);
  await page.getByLabel("제목").fill("가상 설정 명단 생성");
  await page
    .getByRole("button", { name: "자료 수합 만들기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "가상 설정 명단 생성" }),
  ).toBeVisible();
  for (let i = 0; i < 20; i++)
    await create(page, "가상 목록 " + String(i + 1).padStart(2, "0"));
  await page.goto("/tools/data-collect");
  await expect(
    page.getByRole("button").filter({ hasText: /가상 (목록|설정)/ }),
  ).toHaveCount(20);
  await saveShot(page, "chrome-list-20-final");
  await page.getByRole("button", { name: "다음 목록", exact: true }).click();
  await expect(
    page.getByRole("button").filter({ hasText: /가상 (목록|설정)/ }),
  ).toHaveCount(1);
  await saveShot(page, "chrome-list-next-final");
  await page.getByRole("button", { name: "이전 목록", exact: true }).click();
  await expect(
    page.getByRole("button").filter({ hasText: /가상 (목록|설정)/ }),
  ).toHaveCount(20);
});

test("실제 Chrome: CSS 200% 확대에서 QR과 화면 바닥이 잘리지 않는다", async ({
  page,
}) => {
  const links = await create(
    page,
    "실제 검증: 200% 확대",
    false,
    false,
    false,
    "가상하늘\n가상바다",
  );
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await saveShot(page, "chrome-manage-css200-final");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const qr = await page.locator("svg[role=img]").boundingBox();
  const share = await page
    .getByText("공유 링크와 QR", { exact: true })
    .locator("..")
    .boundingBox();
  expect(qr!.x + qr!.width).toBeLessThanOrEqual(share!.x + share!.width);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  const bottom = await page.evaluate(() => {
    const root = document.getElementById("root")?.firstElementChild;
    return root ? window.innerHeight - root.getBoundingClientRect().bottom : 0;
  });
  expect(bottom).toBeLessThanOrEqual(1);
  await page.goto(links.publicUrl);
  await page.setViewportSize({ width: 390, height: 844 });
  await saveShot(page, "chrome-public-search-mobile-final");
});
