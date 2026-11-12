import {
  isRoleDay,
  roleDates,
  type RolePeriod,
  type RoleRecord,
  type RoleState,
} from "../../../supabase/functions/_shared/classroomRoles";

export function summarizeRolePeriod(
  state: RoleState,
  period: RolePeriod,
  through: string,
  records: RoleRecord[],
) {
  const days = roleDates(period.start, through < period.end ? through : period.end);
  const statuses = new Map(
    records
      .filter((record) => record.period_id === period.id)
      .map((record) => [`${record.student_id}:${record.record_date}`, record.status]),
  );

  return period.students.map((student) => {
    let done = 0;
    let notDone = 0;
    let missing = 0;
    for (const day of days) {
      if (!isRoleDay(state, period, student.id, day)) continue;
      const status = statuses.get(`${student.id}:${day}`);
      if (status === "done") done++;
      if (status === "not_done") notDone++;
      if (!status) missing++;
    }
    return { student, done, notDone, missing };
  });
}
