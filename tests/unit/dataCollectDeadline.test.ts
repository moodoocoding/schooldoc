import { describe, expect, it } from "vitest";
import { normalizeDataCollectDeadline } from "../../supabase/functions/_shared/dataCollectDeadline";

const now = Date.parse("2026-10-02T00:00:00Z");
describe("자료 수합 마감 시각", () => {
  it("기존 한국 시각 요청과 새 UTC 요청을 동일한 시각으로 저장한다", () => {
    expect(normalizeDataCollectDeadline("2026-10-09T17:00", "+09:00", now)).toBe("2026-10-09T08:00:00.000Z");
    expect(normalizeDataCollectDeadline("2026-10-09T08:00:00.000Z", "+09:00", now)).toBe("2026-10-09T08:00:00.000Z");
    expect(normalizeDataCollectDeadline("2026-10-09T17:00:00+09:00", "+09:00", now)).toBe("2026-10-09T08:00:00.000Z");
    expect(normalizeDataCollectDeadline("2026-10-09T01:00:00-07:00", "+09:00", now)).toBe("2026-10-09T08:00:00.000Z");
  });
  it("클라이언트의 시간대 없는 입력은 그 브라우저의 현지 시각을 보존한다", () => {
    const local = new Date(2026, 9, 9, 17, 0);
    expect(normalizeDataCollectDeadline("2026-10-09T17:00", undefined, now)).toBe(local.toISOString());
  });
  it("기한 없음은 유지하고 존재하지 않는 날짜나 잘못된 입력은 거절한다", () => {
    for (const value of ["", " ", null, undefined]) expect(normalizeDataCollectDeadline(value, "+09:00", now)).toBe("");
    for (const value of ["2027-02-29T17:00", "2026-02-30T17:00", "2026-13-09T17:00", "2026-10-09T24:00", "2026-10-09T17:60", "2026-10-09T17:00:60Z", "2026-10-09T17:00+24:00", "tomorrow", "2026-10-09", 0, false, {}]) {
      expect(() => normalizeDataCollectDeadline(value, "+09:00", now)).toThrow("마감 날짜와 시간을 확인");
    }
    expect(normalizeDataCollectDeadline("2028-02-29T17:00", "+09:00", now)).toBe("2028-02-29T08:00:00.000Z");
  });
  it("생성과 변경에서 현재 시각 경계와 과거 시각을 거절한다", () => {
    for (const value of ["2026-10-02T09:00", "2026-10-02T08:59:59.999"]) {
      expect(() => normalizeDataCollectDeadline(value, "+09:00", now)).toThrow("현재보다 뒤");
    }
    expect(normalizeDataCollectDeadline("2026-10-02T09:00:00.001", "+09:00", now)).toBe("2026-10-02T00:00:00.001Z");
  });
});
