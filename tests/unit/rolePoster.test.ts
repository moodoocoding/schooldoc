import { describe, expect, it } from "vitest";
import {
  defaultRoleState,
  roleMonthRange,
  type RolePeriod,
} from "../../supabase/functions/_shared/classroomRoles";
import { rolePosterPages } from "../../src/features/classroomRoles/rolePoster";

function periodWithRoles(count: number): RolePeriod {
  const roles = defaultRoleState().roles.slice(0, count);
  while (roles.length < count) {
    roles.push({ ...roles[0], id: crypto.randomUUID(), name: `추가 역할 ${roles.length + 1}` });
  }
  return {
    id: crypto.randomUUID(),
    ...roleMonthRange("2026-09"),
    roles,
    students: [
      { id: "a", number: 2, name: "가상바다" },
      { id: "b", number: 1, name: "가상하늘" },
    ],
    assignments: { a: roles[0].id, b: roles[0].id },
  };
}

describe("게시판 안내문 20칸", () => {
  it.each([16, 17, 20])("%i개 역할을 20칸 한 장에 배치한다", (count) => {
    const pages = rolePosterPages(periodWithRoles(count));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(20);
    expect(pages[0].filter((slot) => slot.roleName)).toHaveLength(count);
    expect(pages[0].slice(count).every((slot) => slot.roleName === "" && slot.students.length === 0)).toBe(true);
    expect(pages[0].map((slot) => slot.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("역할별 담당 학생을 번호순으로 묶고 배정 없는 역할도 남긴다", () => {
    const pages = rolePosterPages(periodWithRoles(16));
    expect(pages[0][0].students).toEqual(["1번 가상하늘", "2번 가상바다"]);
    expect(pages[0][1].students).toEqual([]);
  });

  it("20개를 넘겨도 역할을 자르지 않고 다음 20칸으로 이어 간다", () => {
    const pages = rolePosterPages(periodWithRoles(21));
    expect(pages).toHaveLength(2);
    expect(pages[1]).toHaveLength(20);
    expect(pages[1][0].number).toBe(21);
    expect(pages[1][0].roleName).toBe("추가 역할 21");
    expect(pages[1][1].roleName).toBe("");
  });
});
