import { describe, expect, test } from "vitest";
import {
  activeRolePeriod,
  defaultRoleState,
  isRoleDay,
  parseRoleRoster,
  publicRoleProjection,
  roleDates,
  roleMonthRange,
  roleToday,
  validateClassroomRoles,
  validateRoleRecord,
  validateRoleRoster,
  validateRoleState,
  validateRoleStateChange,
  validRoleDate,
  type RoleRecord,
} from "../../supabase/functions/_shared/classroomRoles";

function fixture() {
  const state = defaultRoleState();
  state.roster = parseRoleRoster("1 가상하늘\n2 가상바다");
  state.periods.push({
    id: crypto.randomUUID(),
    start: "2026-10-01",
    end: "2026-10-31",
    students: structuredClone(state.roster),
    roles: structuredClone(state.roles),
    assignments: Object.fromEntries(
      state.roster.map((s) => [s.id, state.roles[0].id]),
    ),
  });
  return state;
}
describe("1인 1역 공통 검증", () => {
  test("기본값은 18개 역할, 공개 상태 숨김, 동명이인은 번호로 구분", () => {
    const state = fixture();
    expect(state.roles).toHaveLength(18);
    expect(state.settings.showPublicStatus).toBe(false);
    expect(() => validateRoleState(state)).not.toThrow();
    expect(parseRoleRoster("1 김가상\n2 김가상")).toHaveLength(2);
  });
  test("같은 명단은 식별자를 유지하고 번호 중복을 거부", () => {
    const students = parseRoleRoster("1 가상하늘\n2 가상바다");
    expect(parseRoleRoster("1 가상하늘\n2 가상바다", students)).toEqual(
      students,
    );
    expect(() => parseRoleRoster("1 하늘\n1 바다")).toThrow("중복");
  });
  test("개행·탭 명단과 번호 없는 이름을 지원", () => {
    expect(parseRoleRoster("1\t가상하늘\r\n2,가상바다")[1].name).toBe(
      "가상바다",
    );
    expect(parseRoleRoster("가상하늘\n가상바다").map((s) => s.number)).toEqual([
      1, 2,
    ]);
  });
  test("날짜는 실제 달력과 한국 시간 자정 기준", () => {
    expect(validRoleDate("2026-02-30")).toBe(false);
    expect(validRoleDate("2024-02-29")).toBe(true);
    expect(roleToday(new Date("2026-09-30T15:00:00Z"))).toBe("2026-10-01");
    expect(roleToday(new Date("2026-09-30T14:59:59Z"))).toBe("2026-09-30");
    expect(roleMonthRange("2024-02").end).toBe("2024-02-29");
  });
  test("기간과 역할 요일·학급 제외일을 교집합으로 판단", () => {
    const state = fixture();
    const p = state.periods[0],
      id = state.roster[0].id;
    expect(isRoleDay(state, p, id, "2026-10-05")).toBe(true);
    expect(isRoleDay(state, p, id, "2026-10-04")).toBe(false);
    state.settings.excludedDates = ["2026-10-05"];
    expect(isRoleDay(state, p, id, "2026-10-05")).toBe(false);
    expect(activeRolePeriod(state, "2026-11-01")).toBeUndefined();
  });
  test("정원 초과, 미배정, 존재하지 않는 역할은 거부", () => {
    const state = fixture();
    state.periods[0].roles[0].capacity = 1;
    expect(() => validateRoleState(state)).toThrow("정원");
    state.periods[0].roles[0].capacity = 2;
    delete state.periods[0].assignments[state.roster[0].id];
    expect(() => validateRoleState(state)).toThrow("모든 학생");
    state.periods[0].assignments[state.roster[0].id] = crypto.randomUUID();
    expect(() => validateRoleState(state)).toThrow("모든 학생");
  });
  test("겹치는 기간, 너무 긴 기간은 거부", () => {
    const state = fixture();
    state.periods.push({
      ...structuredClone(state.periods[0]),
      id: crypto.randomUUID(),
    });
    expect(() => validateRoleState(state)).toThrow("겹칩니다");
    state.periods.pop();
    state.periods[0].end = "2028-01-01";
    expect(() => validateRoleState(state)).toThrow("1년");
  });
  test("역할과 명단을 수정해도 과거 스냅샷은 불변", () => {
    const before = fixture();
    const next = structuredClone(before);
    next.roles[0].name = "바뀐 역할";
    next.roster[0].name = "바뀐 이름";
    expect(() => validateRoleStateChange(before, next)).not.toThrow();
    expect(next.periods[0].roles[0].name).not.toBe("바뀐 역할");
    next.periods[0].students[0].name = "덮어쓴 이름";
    expect(() => validateRoleStateChange(before, next)).toThrow("보존");
  });
  test("잘못된 자료형·한도·요일은 거부", () => {
    expect(() => validateRoleState(null)).toThrow();
    expect(() => validateRoleRoster([null])).toThrow();
    expect(() => validateRoleRoster(Array(61).fill({}))).toThrow("60");
    const state = fixture();
    state.roles[0].weekdays = [];
    expect(() => validateClassroomRoles(state.roles)).toThrow("요일");
  });
  test("학생은 오늘 활성 배정의 두 상태만 입력", () => {
    const state = fixture(),
      p = state.periods[0],
      s = state.roster[0];
    expect(() =>
      validateRoleRecord(
        state,
        p.id,
        s.id,
        "2026-10-05",
        "done",
        "student",
        "2026-10-05",
      ),
    ).not.toThrow();
    for (const status of ["missing", "exempt", "invalid"])
      expect(() =>
        validateRoleRecord(
          state,
          p.id,
          s.id,
          "2026-10-05",
          status,
          "student",
          "2026-10-05",
        ),
      ).toThrow();
    expect(() =>
      validateRoleRecord(
        state,
        p.id,
        s.id,
        "2026-10-02",
        "done",
        "student",
        "2026-10-05",
      ),
    ).toThrow("오늘");
    expect(() =>
      validateRoleRecord(
        state,
        p.id,
        crypto.randomUUID(),
        "2026-10-05",
        "done",
        "student",
        "2026-10-05",
      ),
    ).toThrow("배정");
  });
  test("공개 중지·비실천일·미래일은 서버 규칙에서 거부", () => {
    const state = fixture(),
      p = state.periods[0],
      s = state.roster[0];
    expect(() =>
      validateRoleRecord(
        state,
        p.id,
        s.id,
        "2026-10-06",
        "done",
        "student",
        "2026-10-05",
      ),
    ).toThrow("미래");
    expect(() =>
      validateRoleRecord(
        state,
        p.id,
        s.id,
        "2026-10-04",
        "done",
        "student",
        "2026-10-04",
      ),
    ).toThrow("실천일");
    state.settings.publicEnabled = false;
    expect(() =>
      validateRoleRecord(
        state,
        p.id,
        s.id,
        "2026-10-05",
        "done",
        "student",
        "2026-10-05",
      ),
    ).toThrow("중지");
  });
  test("교사는 과거 정정·미기록 초기화 가능, 미래는 불가", () => {
    const state = fixture(),
      p = state.periods[0],
      s = state.roster[0];
    for (const status of ["done", "not_done", "exempt", "missing"])
      expect(() =>
        validateRoleRecord(
          state,
          p.id,
          s.id,
          "2026-10-02",
          status,
          "teacher",
          "2026-10-05",
        ),
      ).not.toThrow();
    expect(() =>
      validateRoleRecord(
        state,
        p.id,
        s.id,
        "2026-10-06",
        "done",
        "teacher",
        "2026-10-05",
      ),
    ).toThrow("미래");
  });
  test("공개 화면에는 과거·교사 메타데이터와 다른 학생 상태를 보내지 않음", () => {
    const state = fixture(),
      p = state.periods[0],
      s = state.roster[0];
    const records: RoleRecord[] = state.roster.map((student) => ({
      period_id: p.id,
      student_id: student.id,
      record_date: "2026-10-05",
      status: "done",
      source: "teacher",
      updated_at: "2026-10-05",
    }));
    Object.assign(p.students[0], { privateNote: "비공개 메모" });
    const view = publicRoleProjection(state, records, "2026-10-05");
    expect(view.students.every((s) => !("status" in s))).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(
      /privateNote|updated_at|assignments|roster|source/,
    );
    const selected = publicRoleProjection(state, records, "2026-10-05", s.id);
    expect(selected.students[0].status).toBe("done");
    expect(selected.students[1].status).toBeUndefined();
    state.settings.publicEnabled = false;
    expect(publicRoleProjection(state, records, "2026-10-05").students).toEqual(
      [],
    );
  });
  test("학생 상태 공개를 켜도 오늘 자료만 노출", () => {
    const state = fixture();
    state.settings.showPublicStatus = true;
    const p = state.periods[0];
    const old: RoleRecord = {
      period_id: p.id,
      student_id: p.students[0].id,
      record_date: "2026-10-02",
      status: "not_done",
      source: "teacher",
      updated_at: "",
    };
    expect(
      publicRoleProjection(state, [old], "2026-10-05").students[0].status,
    ).toBeUndefined();
  });
  test("날짜 순회는 월 경계·빈 기간·잘못된 날짜를 처리", () => {
    expect(roleDates("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(roleDates("2026-10-02", "2026-10-01")).toEqual([]);
    expect(roleDates("invalid", "2026-10-01")).toEqual([]);
  });
});
