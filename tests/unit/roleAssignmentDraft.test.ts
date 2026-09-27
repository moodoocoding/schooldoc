import { describe, expect, test } from "vitest";
import {
  roleAssignedCount,
  selectRoleStudents,
} from "../../src/features/classroomRoles/roleAssignmentDraft";
import {
  defaultRoleState,
  validateRoleStateChange,
} from "../../supabase/functions/_shared/classroomRoles";

describe("역할별 학생 다중 선택", () => {
  const role = {
    id: "role-a",
    name: "칠판 도우미",
    description: "",
    capacity: 2,
    weekdays: [1],
  };
  test("여러 학생을 한 역할에 배정하며 중복 선택은 정원을 차지하지 않는다", () => {
    const result = selectRoleStudents({}, role, ["a", "b", "a"], true);
    expect(result).toEqual({ a: role.id, b: role.id });
    expect(roleAssignedCount(result, role.id)).toBe(2);
  });
  test("다른 역할에서 이동해도 한 학생에게는 한 역할만 남고 원본은 유지된다", () => {
    const before = { a: "other", b: "other" };
    expect(selectRoleStudents(before, role, ["a"], true)).toEqual({
      a: role.id,
      b: "other",
    });
    expect(before).toEqual({ a: "other", b: "other" });
  });
  test("정원 초과는 일부만 배정하지 않고 전체 변경을 거부한다", () => {
    const before = { a: role.id, b: "other" };
    expect(() => selectRoleStudents(before, role, ["b", "c"], true)).toThrow(
      "정원이 찼습니다",
    );
    expect(before).toEqual({ a: role.id, b: "other" });
  });
  test("정원이 찬 역할도 선택 해제와 이미 선택된 학생 재선택은 가능하다", () => {
    const before = { a: role.id, b: role.id };
    expect(selectRoleStudents(before, role, ["a"], true)).toEqual(before);
    expect(selectRoleStudents(before, role, ["a"], false)).toEqual({
      b: role.id,
    });
  });
  test("한 역할 전체 해제는 다른 역할의 배정에 영향을 주지 않는다", () => {
    expect(
      selectRoleStudents({ a: role.id, b: "other" }, role, ["a", "b"], false),
    ).toEqual({ b: "other" });
  });
  test("60명 일괄 선택을 지원한다", () => {
    const ids = Array.from({ length: 60 }, (_, index) => String(index));
    expect(
      roleAssignedCount(
        selectRoleStudents({}, { ...role, capacity: 60 }, ids, true),
        role.id,
      ),
    ).toBe(60);
  });
  test("다중 선택 결과는 기존 서버 저장 형식과 정원 검증을 그대로 통과한다", () => {
    const before = defaultRoleState();
    const next = structuredClone(before);
    const students = [1, 2].map((number) => ({
      id: crypto.randomUUID(),
      number,
      name: `가상학생${number}`,
    }));
    next.roles[0].capacity = 2;
    next.roster = students;
    next.periods = [
      {
        id: crypto.randomUUID(),
        start: "2026-10-01",
        end: "2026-10-31",
        students,
        roles: structuredClone(next.roles),
        assignments: selectRoleStudents(
          {},
          next.roles[0],
          students.map((s) => s.id),
          true,
        ),
      },
    ];
    expect(() => validateRoleStateChange(before, next)).not.toThrow();
  });
});
