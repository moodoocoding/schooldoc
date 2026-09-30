import { describe, expect, test } from "vitest";
import {
  defaultRoleState,
  parseRoleRoster,
  validateRoleStateChange,
  type RoleState,
} from "../../supabase/functions/_shared/classroomRoles";

const today = "2026-09-27";

function fixture(start = "2026-09-01", end = "2026-09-30") {
  const state: RoleState = defaultRoleState();
  state.roster = parseRoleRoster("1 가상학생");
  state.periods = [
    {
      id: crypto.randomUUID(),
      start,
      end,
      students: structuredClone(state.roster),
      roles: structuredClone(state.roles),
      assignments: { [state.roster[0].id]: state.roles[0].id },
    },
  ];
  return state;
}

describe("확정한 운영 기간 수정", () => {
  test("진행 중인 배정은 종료일만 늘리거나 줄일 수 있다", () => {
    const before = fixture();
    const after = structuredClone(before);
    after.periods[0].end = "2026-10-05";
    expect(() => validateRoleStateChange(before, after, today)).not.toThrow();
    after.periods[0].end = today;
    expect(() => validateRoleStateChange(before, after, today)).not.toThrow();
    after.periods[0].end = "2026-09-26";
    expect(() => validateRoleStateChange(before, after, today)).toThrow(
      "지난 운영 날짜",
    );
  });

  test("시작한 배정의 시작일과 지난 기간은 바꾸지 않는다", () => {
    const before = fixture();
    const after = structuredClone(before);
    after.periods[0].start = "2026-09-02";
    expect(() => validateRoleStateChange(before, after, today)).toThrow(
      "지난 운영 날짜",
    );
    const past = fixture("2026-08-01", "2026-08-31");
    const changedPast = structuredClone(past);
    changedPast.periods[0].end = "2026-09-01";
    expect(() => validateRoleStateChange(past, changedPast, today)).toThrow(
      "지난 운영 날짜",
    );
  });

  test("예정 배정은 두 날짜를 수정하되 과거로 옮기지 않는다", () => {
    const before = fixture("2026-10-01", "2026-10-31");
    const after = structuredClone(before);
    after.periods[0].start = "2026-10-05";
    after.periods[0].end = "2026-11-05";
    expect(() => validateRoleStateChange(before, after, today)).not.toThrow();
    after.periods[0].start = "2026-09-26";
    expect(() => validateRoleStateChange(before, after, today)).toThrow(
      "지난 운영 날짜",
    );
  });

  test("날짜를 바꾸더라도 확정 학생·역할을 수정하거나 다른 기간과 겹칠 수 없다", () => {
    const before = fixture();
    before.periods.push({
      ...structuredClone(before.periods[0]),
      id: crypto.randomUUID(),
      start: "2026-10-01",
      end: "2026-10-31",
    });
    const after = structuredClone(before);
    after.periods[0].end = "2026-10-02";
    expect(() => validateRoleStateChange(before, after, today)).toThrow(
      "겹칩니다",
    );
    after.periods[0].end = "2026-09-30";
    after.periods[1].start = "2026-10-02";
    after.periods[1].end = "2026-11-01";
    after.periods[0].end = "2026-09-29";
    expect(() => validateRoleStateChange(before, after, today)).toThrow(
      "한 번에 하나씩",
    );
    after.periods[0].end = "2026-09-30";
    after.periods[1].students[0].name = "변경한 이름";
    expect(() => validateRoleStateChange(before, after, today)).toThrow(
      "보존",
    );
  });
});
