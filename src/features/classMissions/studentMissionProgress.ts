import { missionToday, type CheckStatus, type MissionState, type MissionStudent } from '../../../supabase/functions/_shared/classMissions';
import type { MissionStatisticsRange } from './missionStatistics';

type StudentMission = { id: string; title: string; dueDate: string; status: CheckStatus };
type StudentProgress = { student: MissionStudent; missions: StudentMission[]; counts: Record<CheckStatus, number> };

export function summarizeMissionStudentProgress(state: MissionState, range: MissionStatisticsRange, now = new Date()) {
  const today = missionToday(now);
  const asOf = range.end < today ? range.end : today;
  if (range.start > asOf) return { asOf, missionCount: 0, students: [] };
  const endOfDay = Date.parse(`${asOf}T15:00:00Z`);
  const latestTime = Math.min(endOfDay - 1, now.getTime());
  const missions = state.missions.filter((mission) => mission.status !== 'draft' && mission.startDate <= asOf
    && mission.dueDate >= range.start && !(Date.parse(mission.createdAt) > latestTime))
    .sort((first, second) => second.dueDate.localeCompare(first.dueDate) || second.createdAt.localeCompare(first.createdAt));
  const byMission = new Map(missions.map((mission) => [mission.id, new Map<string, { status: CheckStatus; time: number }>()]));

  // Existing records can have a current check without a matching event. On ties, the event log wins.
  for (const record of [...state.checks, ...state.events]) {
    const students = byMission.get(record.missionId);
    if (!students) continue;
    const time = Date.parse(record.updatedAt);
    if (Number.isFinite(time) && time <= latestTime && time >= (students.get(record.studentId)?.time ?? -Infinity)) {
      students.set(record.studentId, { status: record.status, time });
    }
  }

  const byStudent = new Map<string, StudentProgress>();
  const addStudent = (student: MissionStudent): StudentProgress => {
    const row: StudentProgress = {
      student, missions: [], counts: { unmarked: 0, reported: 0, pending: 0, confirmed: 0, exempt: 0 },
    };
    byStudent.set(student.id, row);
    return row;
  };
  if (missions.length) for (const student of state.roster) addStudent(student);
  for (const mission of missions) {
    const checks = byMission.get(mission.id);
    for (const target of mission.targets) {
      const student = byStudent.get(target.id) ?? addStudent(target);
      const status = checks?.get(target.id)?.status ?? 'unmarked';
      student.counts[status] += 1;
      student.missions.push({ id: mission.id, title: mission.title, dueDate: mission.dueDate, status });
    }
  }

  const students = [...byStudent.values()].sort((a, b) => a.student.number - b.student.number || a.student.name.localeCompare(b.student.name, 'ko'));
  return { asOf, missionCount: missions.length, students };
}
