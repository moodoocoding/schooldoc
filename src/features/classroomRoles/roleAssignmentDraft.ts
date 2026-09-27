import type { ClassroomRole } from "../../../supabase/functions/_shared/classroomRoles";

export function roleAssignedCount(
  assignments: Record<string, string>,
  roleId: string,
) {
  return Object.values(assignments).filter((id) => id === roleId).length;
}

/** Keep the persisted student → role contract; a move never creates a second role. */
export function selectRoleStudents(
  assignments: Record<string, string>,
  role: ClassroomRole,
  studentIds: string[],
  selected: boolean,
): Record<string, string> {
  const next = { ...assignments };
  for (const studentId of new Set(studentIds)) {
    if (selected) next[studentId] = role.id;
    else if (next[studentId] === role.id) delete next[studentId];
  }
  if (roleAssignedCount(next, role.id) > role.capacity) {
    throw new Error(
      `${role.name} 정원이 찼습니다. 정원을 늘리거나 선택을 해제해 주세요.`,
    );
  }
  return next;
}
