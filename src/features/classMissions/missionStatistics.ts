import { missionToday, type MissionEvent, type MissionState } from '../../../supabase/functions/_shared/classMissions';
import { roleDates, validRoleDate } from '../../../supabase/functions/_shared/classroomRoles';

export type MissionStatisticsRange = { start: string; end: string };

const dayMs = 86_400_000;
const pageSize = 14;
const dateMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const dateAt = (time: number) => new Date(time).toISOString().slice(0, 10);

export function recentMissionStatisticsRange(now = new Date()): MissionStatisticsRange {
  const end = missionToday(now);
  return { start: dateAt(dateMs(end) - 6 * dayMs), end };
}

export function missionStatisticsRangeError({ start, end }: MissionStatisticsRange) {
  if (!validRoleDate(start)) return { field: 'start', message: '2000년부터 2099년 사이의 시작일을 입력해 주세요.' } as const;
  if (!validRoleDate(end)) return { field: 'end', message: '2000년부터 2099년 사이의 종료일을 입력해 주세요.' } as const;
  if (start > end) return { field: 'end', message: '종료일은 시작일과 같거나 이후여야 합니다.' } as const;
  return null;
}

export function missionStatisticsPage({ start, end }: MissionStatisticsRange, page: number) {
  const endTime = dateMs(end);
  const startTime = dateMs(start);
  const pageCount = Math.ceil(((endTime - startTime) / dayMs + 1) / pageSize);
  const lastDay = endTime - page * pageSize * dayMs;
  const firstDay = Math.max(startTime, lastDay - (pageSize - 1) * dayMs);
  return { dates: roleDates(dateAt(firstDay), dateAt(lastDay)).reverse(), pageCount };
}

export type MissionActivityCounts = { reported: number; confirmed: number; cancelled: number; corrected: number };
export const emptyMissionActivity = (): MissionActivityCounts => ({ reported: 0, confirmed: 0, cancelled: 0, corrected: 0 });

function eventMetric(event: MissionEvent): keyof MissionActivityCounts {
  if (event.actor === 'teacher') return event.status === 'confirmed' ? 'confirmed' : 'corrected';
  return event.status === 'unmarked' ? 'cancelled' : 'reported';
}

type MissionActivity = { title: string; counts: MissionActivityCounts };
type DailyMissionActivity = { counts: MissionActivityCounts; missions: Map<string, MissionActivity> };

export function summarizeMissionStatistics(state: MissionState, { start, end }: MissionStatisticsRange) {
  const titles = new Map(state.missions.filter((mission) => mission.status !== 'draft').map(({ id, title }) => [id, title]));
  const totals = emptyMissionActivity();
  const byDate = new Map<string, DailyMissionActivity>();

  for (const event of state.events) {
    const title = titles.get(event.missionId);
    const time = new Date(event.updatedAt);
    if (title === undefined || !Number.isFinite(time.getTime())) continue;

    const date = missionToday(time);
    if (date < start || date > end) continue;

    let day = byDate.get(date);
    if (!day) {
      day = { counts: emptyMissionActivity(), missions: new Map() };
      byDate.set(date, day);
    }
    let mission = day.missions.get(event.missionId);
    if (!mission) {
      mission = { title, counts: emptyMissionActivity() };
      day.missions.set(event.missionId, mission);
    }
    const metric = eventMetric(event);
    totals[metric] += 1;
    day.counts[metric] += 1;
    mission.counts[metric] += 1;
  }

  return { totals, byDate };
}
