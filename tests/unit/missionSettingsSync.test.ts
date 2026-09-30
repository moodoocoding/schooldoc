import { describe, expect, test } from 'vitest';
import {
  rosterWithSettingsStudents, settingsMissionClassName,
} from '../../src/features/classMissions/missionSettingsSync';

describe('학급 미션 설정 연동', () => {
  test('프로필의 학급명은 직책을 제외하고 같은 학급 표현으로 맞춘다', () => {
    expect(settingsMissionClassName('3학년 2반 담임')).toBe('3학년 2반');
    expect(settingsMissionClassName('3학년2반')).toBe('3학년 2반');
    expect(settingsMissionClassName('3-2 담임')).toBe('3학년 2반');
    expect(settingsMissionClassName('햇살반 담임')).toBe('햇살반');
    expect(settingsMissionClassName('2025학년도 3학년 2반')).toBe('2025학년도 3학년 2반');
    expect(settingsMissionClassName('가상 3학년 2반 담임')).toBe('가상 3학년 2반');
    expect(settingsMissionClassName('교과전담')).toBe('');
  });

  test('설정의 새 학생만 더하고 기존 번호·이름과 순서를 보존한다', () => {
    const current = [{ id: 'mission-1', number: 2, name: '가상바다' }];
    const configured = [
      { id: 'settings-1', number: 1, name: '가상하늘' },
      { id: 'settings-2', number: 2, name: '가상바다' },
    ];
    expect(rosterWithSettingsStudents(current, configured)).toEqual({
      rosterText: '1 가상하늘\n2 가상바다', addedCount: 1,
    });
    expect(current).toEqual([{ id: 'mission-1', number: 2, name: '가상바다' }]);
    expect(rosterWithSettingsStudents(current, [configured[1]])).toBeNull();
  });

  test('같은 번호의 다른 학생과 60명 초과는 자동 덮어쓰지 않는다', () => {
    const current = [{ id: 'mission-1', number: 1, name: '가상하늘' }];
    expect(() => rosterWithSettingsStudents(current, [{ id: 'settings-1', number: 1, name: '가상바다' }]))
      .toThrow('번호·이름');
    const full = Array.from({ length: 60 }, (_, index) => ({ id: `mission-${index}`, number: index + 1, name: `가상${index + 1}` }));
    expect(() => rosterWithSettingsStudents(full, [{ id: 'settings-61', number: 61, name: '가상61' }]))
      .toThrow('60명');
  });
});
