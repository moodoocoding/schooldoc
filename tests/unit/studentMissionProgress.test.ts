import { expect, it } from 'vitest';
import type { Mission, MissionEvent, MissionState } from '../../supabase/functions/_shared/classMissions';
import { summarizeMissionStudentProgress } from '../../src/features/classMissions/studentMissionProgress';
import { orderManagedMissions } from '../../src/features/classMissions/missionManagementOrder';

const first = { id: 'first', number: 1, name: '가상학생' };
const second = { id: 'second', number: 2, name: '가상학생' };
const former = { id: 'former', number: 3, name: '가상전학생' };
const fourth = { id: 'fourth', number: 4, name: '가상미배정' };
const createdAt = '2026-11-01T00:00:00Z';
const now = new Date('2026-11-14T01:00:00Z');
const mission: Mission = { id: 'first-mission', title: '독서', description: '', status: 'open', startDate: '2026-11-01', dueDate: '2026-11-15',
  targets: [first, second, former], createdAt, updatedAt: createdAt, requiresConfirmation: true };
const event = (id: string, updatedAt: string, status: MissionEvent['status'], from: MissionEvent['status']): MissionEvent => ({
  id, updatedAt, status, from, actor: status === 'confirmed' ? 'teacher' : 'student', missionId: mission.id, studentId: first.id,
});

it('선택 기간의 배정 미션과 종료일의 마지막 상태를 학생 ID별로 계산한다', () => {
  const secondMission = { ...mission, id: 'second-mission', title: '수학', status: 'closed' as const, targets: [first, second] };
  const state: MissionState = { className: '가상 학급', roster: [first, second, fourth],
    missions: [mission, secondMission, { ...mission, id: 'draft', status: 'draft' }, { ...mission, id: 'past', dueDate: '2026-11-09' },
      { ...mission, id: 'late', createdAt: '2026-11-12T15:00:00Z' }],
    checks: [
      { missionId: mission.id, studentId: first.id, status: 'confirmed', updatedAt: '2026-11-12T15:00:00Z' },
      { missionId: secondMission.id, studentId: first.id, status: 'reported', updatedAt: '2026-11-05T00:00:00Z' },
      { missionId: secondMission.id, studentId: second.id, status: 'exempt', updatedAt: '2026-11-05T00:00:00Z' },
    ],
    events: [event('confirm', '2026-11-12T15:00:00Z', 'confirmed', 'pending'), event('pending', '2026-11-12T14:59:59Z', 'pending', 'unmarked'),
      event('cancel', '2026-11-12T14:58:00Z', 'unmarked', 'pending'), event('early-report', '2026-11-12T14:50:00Z', 'pending', 'unmarked')],
  };

  const history = summarizeMissionStudentProgress(state, { start: '2026-11-10', end: '2026-11-12' }, now);
  expect(history.asOf).toBe('2026-11-12');
  expect(history.missionCount).toBe(2);
  expect(history.students.map(({ student }) => student.id)).toEqual(['first', 'second', 'former', 'fourth']);
  expect(history.students[0].counts).toMatchObject({ reported: 1, pending: 1, confirmed: 0 });
  expect(history.students[1].counts).toMatchObject({ unmarked: 1, exempt: 1 });
  expect(history.students[2].missions.map(({ id }) => id)).toEqual([mission.id]);
  expect(history.students[3].missions).toEqual([]);
  const later = summarizeMissionStudentProgress(state, { start: '2026-11-10', end: '2026-11-30' }, now);
  expect(later.asOf).toBe('2026-11-14');
  expect(later.students[0].counts.confirmed).toBe(1);
  expect(summarizeMissionStudentProgress(state, { start: '2026-11-15', end: '2026-11-20' }, now).missionCount).toBe(0);
});

it('관리 목록에서 현재 미션을 먼저, 지난 미션은 최근 마감일부터 표시한다', () => {
  const missions: Mission[] = [
    { ...mission, id: 'draft', status: 'draft' }, { ...mission, id: 'past', dueDate: '2026-11-10' },
    { ...mission, id: 'future', startDate: '2026-11-16', dueDate: '2026-11-18' },
    { ...mission, id: 'closed', status: 'closed' }, { ...mission, id: 'due-later', dueDate: '2026-11-16' }, mission,
  ];
  expect(orderManagedMissions(missions, '2026-11-14').map(({ id }) => id)).toEqual(['first-mission', 'due-later', 'future', 'draft', 'closed', 'past']);
  expect(missions[0].id).toBe('draft');
});
