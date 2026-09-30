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
