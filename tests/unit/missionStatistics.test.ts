import { describe, expect, it } from 'vitest';
import type { Mission, MissionEvent, MissionState } from '../../supabase/functions/_shared/classMissions';
import {
  missionStatisticsPage, missionStatisticsRangeError, recentMissionStatisticsRange, summarizeMissionStatistics,
} from '../../src/features/classMissions/missionStatistics';

const mission: Mission = {
  id: 'mission', title: '독서 기록', description: '', targets: [], requiresConfirmation: true,
  startDate: '2026-11-01', dueDate: '2026-11-12', status: 'closed',
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-12T15:00:00Z',
};

function event(id: string, updatedAt: string, actor: MissionEvent['actor'], status: MissionEvent['status'], missionId = mission.id): MissionEvent {
  return { id, updatedAt, actor, status, missionId, studentId: 'student', from: 'unmarked' };
}

describe('학급 미션 통계', () => {
  it('한국 시간 자정과 양쪽 조회 경계를 적용하고, 이후 상태가 바뀌어도 실제 변경일에 집계한다', () => {
    const state: MissionState = {
      className: '가상 학급', roster: [], missions: [mission, { ...mission, id: 'second', status: 'open' }],
      checks: [], events: [
        event('before', '2026-11-11T14:59:59Z', 'student', 'pending'),
        event('report', '2026-11-11T15:00:00Z', 'student', 'pending'),
        event('undo', '2026-11-11T15:01:00Z', 'student', 'unmarked'),
        event('report-again', '2026-11-12T14:59:59Z', 'student', 'pending'),
        event('confirm', '2026-11-12T15:00:00Z', 'teacher', 'confirmed'),
        event('correct', '2026-11-13T01:00:00Z', 'teacher', 'unmarked'),
        event('report-second', '2026-11-13T01:30:00Z', 'student', 'reported', 'second'),
        event('after', '2026-11-13T15:00:00Z', 'student', 'reported', 'second'),
      ],
    };

    const result = summarizeMissionStatistics(state, { start: '2026-11-12', end: '2026-11-13' });
    expect(result.totals).toEqual({ reported: 3, confirmed: 1, cancelled: 1, corrected: 1 });
    expect([...result.byDate.keys()]).toEqual(['2026-11-12', '2026-11-13']);
    expect(result.byDate.get('2026-11-12')?.counts).toEqual({ reported: 2, confirmed: 0, cancelled: 1, corrected: 0 });
    expect(result.byDate.get('2026-11-13')?.missions.get('mission')?.counts).toEqual({ reported: 0, confirmed: 1, cancelled: 0, corrected: 1 });
    expect(result.byDate.get('2026-11-13')?.missions.get('second')?.counts.reported).toBe(1);
  });

  it('초안, 이미 제거된 미션의 기록, 날짜를 읽을 수 없는 기록을 집계에서 제외한다', () => {
    const state: MissionState = {
      className: '가상 학급', roster: [], missions: [{ ...mission, id: 'draft', status: 'draft' }, mission],
      checks: [], events: [
        event('draft-event', '2026-11-12T01:00:00Z', 'teacher', 'confirmed', 'draft'),
        event('missing-event', '2026-11-12T01:00:00Z', 'teacher', 'confirmed', 'missing'),
        event('invalid-time', 'invalid', 'teacher', 'confirmed'),
      ],
    };
    const result = summarizeMissionStatistics(state, { start: '2026-11-12', end: '2026-11-12' });
    expect(result.totals).toEqual({ reported: 0, confirmed: 0, cancelled: 0, corrected: 0 });
    expect(result.byDate.size).toBe(0);
  });

  it('윤년과 월 경계를 넘겨 최신 날짜부터 모든 날을 페이지로 나눈다', () => {
    expect(recentMissionStatisticsRange(new Date('2024-02-29T15:00:00Z'))).toEqual({ start: '2024-02-24', end: '2024-03-01' });
    const range = { start: '2024-02-15', end: '2024-03-01' };
    expect(missionStatisticsRangeError(range)).toBeNull();
    const firstPage = missionStatisticsPage(range, 0);
    expect(firstPage.pageCount).toBe(2);
    expect(firstPage.dates).toHaveLength(14);
    expect(firstPage.dates.slice(0, 2)).toEqual(['2024-03-01', '2024-02-29']);
    expect(firstPage.dates.at(-1)).toBe('2024-02-17');
    expect(missionStatisticsPage(range, 1).dates).toEqual(['2024-02-16', '2024-02-15']);
    expect(missionStatisticsRangeError({ start: range.end, end: range.start })?.field).toBe('end');
    expect(missionStatisticsRangeError({ start: '2023-02-29', end: range.end })?.field).toBe('start');
  });
});
