import { expect, test, vi } from "vitest";
import { defaultRoleState, parseRoleRoster, type RoleRecord } from "../../supabase/functions/_shared/classroomRoles";
import { summarizeRolePeriod } from "../../src/features/classroomRoles/rolePeriodStats";
import { loadRoleRecords } from "../../src/features/classroomRoles/roleApi";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("../../src/utils/supabaseClient", () => ({ supabase: { functions: { invoke } } }));

test("운영 기간의 역할 요일과 제외일을 적용해 오늘까지 기록을 집계한다", () => {
  const state = defaultRoleState();
  state.settings.schoolDays = [1, 2, 3, 4, 5];
  state.settings.excludedDates = ["2026-11-03"];
  const [first, second] = parseRoleRoster("1 가상하늘\n2 가상하늘");
  const [daily, mondays] = state.roles;
  daily.weekdays = [1, 2, 3, 4, 5, 6];
  mondays.weekdays = [1];
  const period = {
    id: "current",
    start: "2026-10-29",
    end: "2026-11-16",
    students: [first, second],
    roles: [daily, mondays],
    assignments: { [first.id]: daily.id, [second.id]: mondays.id },
  };
  const record = (date: string, status: RoleRecord["status"] = "done", periodId = period.id): RoleRecord => ({
    period_id: periodId,
    student_id: first.id,
    record_date: date,
    status,
    source: "teacher",
    updated_at: `${date}T00:00:00Z`,
  });
  const rows = summarizeRolePeriod(state, period, "2026-11-06", [
    record("2026-10-28"),
    record("2026-10-29"),
    record("2026-10-30", "not_done"),
    record("2026-10-31"),
    record("2026-11-02", "exempt"),
    record("2026-11-03"),
    record("2026-11-04", "done", "another-period"),
    record("2026-11-06"),
    record("2026-11-09"),
  ]);
  expect(rows).toEqual([
    { student: first, done: 2, notDone: 1, missing: 2 },
    { student: second, done: 0, notDone: 0, missing: 1 },
  ]);
});

test("긴 운영 기간은 기존 서버가 지원하는 범위로 빠짐없이 나눠 조회한다", async () => {
  invoke.mockReset();
  invoke.mockImplementation(async (_, { body }) => ({ data: [body.end] }));
  const records = await loadRoleRecords("2026-09-01", "2026-11-13");
  expect(invoke.mock.calls.map(([endpoint, { body }]) => [endpoint, body])).toEqual([
    ["classroom-roles-admin", { action: "records", start: "2026-09-01", end: "2026-10-02" }],
    ["classroom-roles-admin", { action: "records", start: "2026-10-03", end: "2026-11-03" }],
    ["classroom-roles-admin", { action: "records", start: "2026-11-04", end: "2026-11-13" }],
  ]);
  expect(records).toEqual(["2026-10-02", "2026-11-03", "2026-11-13"]);

  invoke.mockReset();
  invoke.mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(new Error("조회 실패"));
  await expect(loadRoleRecords("2026-09-01", "2026-11-13")).rejects.toThrow("조회 실패");
});
