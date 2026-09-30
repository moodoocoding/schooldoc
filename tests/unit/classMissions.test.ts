import { describe, expect, test } from 'vitest';
import {
  changeMissionStatus, generateMissionCode, hashMissionCode, missionCanReport, missionCounts, missionPurgeCounts,
  missionRetention, normalizeMissionCode, parseMissionRoster, publicMissionView, purgeMissionState,
  setMissionCheck, validateMissionInput,
  type Mission, type StoredMissionState,
} from '../../supabase/functions/_shared/classMissions';

function fixture(requiresConfirmation = true): StoredMissionState {
  const roster = parseMissionRoster('1 가상하늘\n2 가상바다').map((student) => ({ ...student, codeHash: `hash-${student.id}` }));
  const mission: Mission = {
    id: crypto.randomUUID(), title: '독서 기록하기', description: '책을 읽고 기록하세요.',
    startDate: '2026-09-01', dueDate: '2026-09-30', requiresConfirmation,
    status: 'open', targets: roster.map(({ id, number, name }) => ({ id, number, name })),
    createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  };
  return { className: '가상 5학년 2반', roster, missions: [mission], checks: [], events: [] };
}
describe('학급 미션 규칙', () => {
  test('개인 코드는 정규화 후 해시가 같고 12자리 난수로 만든다', async () => {
    const code = generateMissionCode();
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/);
    expect(normalizeMissionCode(`${code.slice(0, 4)}-${code.slice(4).toLowerCase()}`)).toBe(code);
    expect(await hashMissionCode('board', code)).toBe(await hashMissionCode('board', `${code.slice(0, 4)} ${code.slice(4)}`));
    expect(await hashMissionCode('other', code)).not.toBe(await hashMissionCode('board', code));
  });
  test('중복 번호와 존재하지 않는 대상을 거부한다', () => {
    expect(() => parseMissionRoster('1 학생A\n1 학생B')).toThrow('중복');
    const state = fixture();
    const base = { title: '준비물', description: '', startDate: '2026-09-01', dueDate: '2026-09-30',
      requiresConfirmation: false, status: 'open', targetStudentIds: [state.roster[0].id] };
    expect(validateMissionInput(base, state.roster).targetStudentIds).toEqual([state.roster[0].id]);
    expect(() => validateMissionInput({ ...base, targetStudentIds: [crypto.randomUUID()] }, state.roster)).toThrow('대상');
    expect(() => validateMissionInput({ ...base, dueDate: '2026-02-30' }, state.roster)).toThrow('시작일');
  });
  test('학생 완료는 확인 대기, 취소, 교사 확인으로 이동하며 재전송은 이력을 늘리지 않는다', () => {
    const state = fixture();
    const missionId = state.missions[0].id, studentId = state.roster[0].id;
    const reported = setMissionCheck(state, missionId, studentId, 'pending', 'student', '2026-09-20T01:00:00.000Z', '2026-09-20');
    expect(missionCounts(reported, reported.missions[0])).toEqual({ unmarked: 1, reported: 0, pending: 1, confirmed: 0, exempt: 0 });
    expect(setMissionCheck(reported, missionId, studentId, 'pending', 'student', undefined, '2026-09-20')).toBe(reported);
    const cancelled = setMissionCheck(reported, missionId, studentId, 'unmarked', 'student', undefined, '2026-09-20');
    expect(cancelled.events).toHaveLength(2);
    const confirmed = setMissionCheck(reported, missionId, studentId, 'confirmed', 'teacher');
    expect(() => setMissionCheck(confirmed, missionId, studentId, 'unmarked', 'student', undefined, '2026-09-20')).toThrow('교사 확인');
    expect(() => setMissionCheck(state, missionId, studentId, 'pending', 'student', undefined, '2026-10-01')).toThrow('지금은');
  });
  test('마감·종료에서는 학생의 새 표시를 막고 교사는 정정할 수 있다', () => {
    const state = fixture(false);
    const missionId = state.missions[0].id, studentId = state.roster[0].id;
    expect(missionCanReport(state.missions[0], '2026-09-30')).toBe(true);
    expect(missionCanReport(state.missions[0], '2026-10-01')).toBe(false);
    expect(() => setMissionCheck(state, missionId, studentId, 'reported', 'student', undefined, '2026-10-01')).toThrow();
    const teacherCorrection = setMissionCheck(state, missionId, studentId, 'exempt', 'teacher');
    expect(missionCounts(teacherCorrection, state.missions[0]).exempt).toBe(1);
  });
  test('공개 응답에는 다른 학생 이름·코드·상태가 없다', () => {
    const state = fixture();
    const other = state.roster[1];
    const altered = setMissionCheck(state, state.missions[0].id, other.id, 'confirmed', 'teacher');
    const view = publicMissionView(altered, state.roster[0].id);
    expect(view.studentName).toBe('가상하늘');
    expect(view.missions[0].check).toBe('unmarked');
    expect(JSON.stringify(view)).not.toContain(other.name);
    expect(JSON.stringify(view)).not.toContain('codeHash');
    expect(JSON.stringify(view)).not.toContain(other.id);
  });
  test('종료 후 90일이 지나야 파기할 수 있고 다시 열면 기산점이 초기화된다', () => {
    const state = fixture();
    const missionId = state.missions[0].id;
    const closed = changeMissionStatus(state, missionId, 'closed', '2026-01-01T00:00:00.000Z');
    expect(missionRetention(closed.missions[0], new Date('2026-03-31T23:59:59.999Z'))?.eligible).toBe(false);
    expect(missionRetention(closed.missions[0], new Date('2026-04-01T00:00:00.000Z'))).toEqual({
      eligibleAt: '2026-04-01T00:00:00.000Z', eligible: true,
    });
    expect(() => purgeMissionState(closed, missionId, new Date('2026-03-31T23:59:59.999Z'))).toThrow('보관 기간');
    const reopened = changeMissionStatus(closed, missionId, 'open', '2026-02-01T00:00:00.000Z');
    expect(missionRetention(reopened.missions[0])).toBeNull();
    expect(() => purgeMissionState(reopened, missionId, new Date('2026-05-01T00:00:00.000Z'))).toThrow('보관 기간');
    expect(changeMissionStatus(reopened, missionId, 'closed', '2026-02-02T00:00:00.000Z').missions[0].closedAt)
      .toBe('2026-02-02T00:00:00.000Z');
  });
  test('파기 시 해당 미션 응답·이력만 제거하고 마지막 미션이면 명단도 비운다', () => {
    const initial = fixture();
    const missionId = initial.missions[0].id;
    const withCheck = setMissionCheck(initial, missionId, initial.roster[0].id, 'confirmed', 'teacher');
    const closed = changeMissionStatus(withCheck, missionId, 'closed', '2026-01-01T00:00:00.000Z');
    expect(missionPurgeCounts(closed, missionId)).toEqual({ targetCount: 2, checkCount: 1, eventCount: 1, clearRoster: true });
    const purged = purgeMissionState(closed, missionId, new Date('2026-04-01T00:00:00.000Z'));
    expect(purged).toMatchObject({ missions: [], checks: [], events: [], roster: [] });
    const another = { ...closed, missions: [...closed.missions, { ...closed.missions[0], id: crypto.randomUUID(), status: 'open' as const }] };
    const partlyPurged = purgeMissionState(another, missionId, new Date('2026-04-01T00:00:00.000Z'));
    expect(partlyPurged.missions).toHaveLength(1);
    expect(partlyPurged.roster).toHaveLength(2);
    expect(partlyPurged.checks).toHaveLength(0);
  });
});
