import { missionDateLabel, type Mission } from '../../../supabase/functions/_shared/classMissions';

export const missionFilters = ['전체', '진행 중', '시작 전', '초안', '지난 미션'] as const;
export type MissionFilter = (typeof missionFilters)[number];

export function matchesMissionFilter(mission: Mission, today: string, query: string, filter: MissionFilter) {
  const status = missionDateLabel(mission, today);
  const category = status === '종료' || status === '마감 지남' ? '지난 미션' : status;
  return (filter === '전체' || filter === category) && mission.title.toLocaleLowerCase('ko').includes(query.trim().toLocaleLowerCase('ko'));
}

export function orderManagedMissions(missions: Mission[], today: string) {
  const priority = (mission: Mission) => {
    if (mission.status === 'draft') return 2;
    if (mission.status === 'closed' || mission.dueDate < today) return 3;
    return mission.startDate > today ? 1 : 0;
  };
  return [...missions].reverse().sort((first, second) => {
    const group = priority(first);
    const comparison = group - priority(second);
    if (comparison) return comparison;
    if (group === 0) return first.dueDate.localeCompare(second.dueDate);
    if (group === 1) return first.startDate.localeCompare(second.startDate);
    if (group === 2) return second.updatedAt.localeCompare(first.updatedAt);
    return second.dueDate.localeCompare(first.dueDate);
  });
}
