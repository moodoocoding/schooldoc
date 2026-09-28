import type { RolePeriod } from "./roleApi";

export const ROLE_POSTER_SLOTS_PER_PAGE = 20;

export type RolePosterSlot = {
  number: number;
  roleName: string;
  students: string[];
};

/** Keep each printed sheet at twenty slots without dropping additional roles. */
export function rolePosterPages(period: RolePeriod): RolePosterSlot[][] {
  const studentsByRole = new Map<string, string[]>();
  for (const student of [...period.students].sort((a, b) => a.number - b.number)) {
    const roleId = period.assignments[student.id];
    if (!roleId) continue;
    const students = studentsByRole.get(roleId) ?? [];
    students.push(`${student.number}번 ${student.name}`);
    studentsByRole.set(roleId, students);
  }
  const pageCount = Math.max(1, Math.ceil(period.roles.length / ROLE_POSTER_SLOTS_PER_PAGE));
  return Array.from({ length: pageCount }, (_, pageIndex) =>
    Array.from({ length: ROLE_POSTER_SLOTS_PER_PAGE }, (_, slotIndex) => {
      const index = pageIndex * ROLE_POSTER_SLOTS_PER_PAGE + slotIndex;
      const role = period.roles[index];
      return {
        number: index + 1,
        roleName: role?.name ?? "",
        students: role ? studentsByRole.get(role.id) ?? [] : [],
      };
    }),
  );
}
