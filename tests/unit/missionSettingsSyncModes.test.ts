import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('../../src/features/classMissions/missionApi');
  vi.doUnmock('../../src/features/classroomRoles/roleApi');
  vi.doUnmock('../../src/features/settings/profileSettings');
  vi.unstubAllGlobals();
  vi.resetModules();
});

test('설정 명단과 미션의 저장 모드가 다르면 원격 자동 등록을 시작하지 않는다', async () => {
  const listMissionBoards = vi.fn(async () => []);
  const createMissionBoard = vi.fn();
  const loadRoleBoard = vi.fn();
  const loadTeacherProfile = vi.fn(() => ({ gradeClass: '3학년 2반' }));
  vi.stubGlobal('navigator', {});
  vi.doMock('../../src/features/classMissions/missionApi', () => ({
    isMissionsDemo: false, listMissionBoards, createMissionBoard,
  }));
  vi.doMock('../../src/features/classroomRoles/roleApi', () => ({
    isRolesDemo: true, loadRoleBoard,
  }));
  vi.doMock('../../src/features/settings/profileSettings', () => ({ loadTeacherProfile }));
  const { syncMissionSettings } = await import('../../src/features/classMissions/missionSettingsSync');
  const result = await syncMissionSettings('test-teacher', '가상교사');
  expect(result.warning).toContain('저장 모드가 달라');
  expect(result.boards).toEqual([]);
  expect(listMissionBoards).toHaveBeenCalledOnce();
  expect(loadTeacherProfile).not.toHaveBeenCalled();
  expect(loadRoleBoard).not.toHaveBeenCalled();
  expect(createMissionBoard).not.toHaveBeenCalled();
});


test('같은 교사의 동시 초기 조회는 탭 간 잠금 앞에서 공유하고 다른 교사와 분리한다', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const student = { id: 'fictional-student', number: 1, name: '가상하늘' };
  const board = { id: 'fictional-board', publicEnabled: true, state: { className: '3학년 2반', roster: [], missions: [] } };
  const issuedCodes = [{ ...student, code: 'ABCDEFGHJKLM' }];
  const listMissionBoards = vi.fn(async () => { await gate; return [board]; });
  const mutateMissionBoard = vi.fn(async () => ({ board: { ...board, state: { ...board.state, roster: [student] } }, issuedCodes }));
  const request = vi.fn(async (_key: string, run: () => Promise<unknown>) => run());
  vi.stubGlobal('navigator', { locks: { request } });
  vi.doMock('../../src/features/classMissions/missionApi', () => ({
    isMissionsDemo: false, listMissionBoards, mutateMissionBoard, createMissionBoard: vi.fn(),
  }));
  vi.doMock('../../src/features/classroomRoles/roleApi', () => ({
    isRolesDemo: false, loadRoleBoard: vi.fn(async () => ({ state: { roster: [student] } })),
  }));
  vi.doMock('../../src/features/settings/profileSettings', () => ({ loadTeacherProfile: () => ({ gradeClass: '3학년 2반' }) }));
  const { syncMissionSettings } = await import('../../src/features/classMissions/missionSettingsSync');
  const first = syncMissionSettings('teacher-a', '가상교사');
  const second = syncMissionSettings('teacher-a', '가상교사');
  const otherTeacher = syncMissionSettings('teacher-b', '가상교사');
  expect(second).toBe(first); expect(otherTeacher).not.toBe(first);
  release();
  const [a, b] = await Promise.all([first, second, otherTeacher]);
  expect(a.issuedCodes).toEqual(issuedCodes); expect(b.issuedCodes).toEqual(issuedCodes);
  expect(request).toHaveBeenCalledTimes(2); expect(mutateMissionBoard).toHaveBeenCalledTimes(2);
});
