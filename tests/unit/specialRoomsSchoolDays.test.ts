import { describe, expect, test, vi } from 'vitest';
import {
  SCHOOL_DAYS_AHEAD,
  linkSchoolAndSyncDays,
  schoolDaysRange,
  syncDaysOnly,
  unlinkSchool,
  type SchoolDaysPorts,
} from '../../src/features/specialRooms/specialRoomsSchoolDays';

/**
 * 학교를 고르면 학사일정까지 받아야 한다.
 *
 * 예전에는 고르면 학교 코드만 저장되고, 관리 화면의 `학사일정 받기`를 따로 눌러야 표에
 * 휴업일이 나왔다. 고르는 자리에는 "표에 표시됩니다"라고만 적혀 있어 남은 단계를 알 수
 * 없었고, 학교를 제대로 고른 선생님이 빈 표를 배부하게 됐다.
 *
 * Supabase를 타는 경로라 데모 모드 e2e로는 덮이지 않는다. 순서와 실패 처리를 여기서 본다.
 */
const school = { name: '한빛초등학교', officeCode: 'B10', schoolCode: '7011569' };

const portsWith = (overrides: Partial<SchoolDaysPorts> = {}): SchoolDaysPorts => ({
  link: vi.fn(async () => {}),
  sync: vi.fn(async () => 12),
  ...overrides,
});

describe('학교를 고르면 학사일정까지 이어서 받는다', () => {
  test('연결과 일정 받기를 한 번에 끝낸다', async () => {
    const ports = portsWith();
    const outcome = await linkSchoolAndSyncDays(ports, 'board-1', school, '2026-08-17');

    expect(ports.link).toHaveBeenCalledWith('board-1', school);
    expect(ports.sync).toHaveBeenCalledWith('board-1', '2026-08-17', '2027-02-13');
    expect(outcome.linked).toBe(true);
    expect(outcome.count).toBe(12);
    expect(outcome.error).toBe('');
    expect(outcome.notice).toContain('한빛초등학교');
    expect(outcome.notice).toContain('12건');
  });

  test('고른 주부터 한 학기 남짓을 받는다', () => {
    // 화면을 열 때마다 NEIS를 부르지 않으려고 한 번에 받아 둔다.
    expect(schoolDaysRange('2026-08-17')).toEqual({ from: '2026-08-17', to: '2027-02-13' });
    expect(SCHOOL_DAYS_AHEAD).toBe(180);
  });

  test('연결에 실패하면 일정을 받으러 가지 않는다', async () => {
    const ports = portsWith({ link: vi.fn(async () => { throw new Error('학교를 연결하지 못했습니다'); }) });
    const outcome = await linkSchoolAndSyncDays(ports, 'board-1', school, '2026-08-17');

    expect(ports.sync).not.toHaveBeenCalled();
    expect(outcome.linked).toBe(false);
    expect(outcome.error).toContain('연결하지 못했습니다');
    expect(outcome.notice).toBe('');
  });

  test('일정 받기만 실패하면 학교는 연결된 것으로 알리고 무엇을 다시 할지 말해 준다', async () => {
    // 이 구분이 없으면 선생님이 학교를 다시 고르러 간다. 이미 연결되어 있는데도.
    const ports = portsWith({ sync: vi.fn(async () => { throw new Error('NEIS가 응답하지 않습니다'); }) });
    const outcome = await linkSchoolAndSyncDays(ports, 'board-1', school, '2026-08-17');

    expect(outcome.linked).toBe(true);
    expect(outcome.count).toBe(0);
    expect(outcome.notice).toContain('한빛초등학교');
    expect(outcome.notice).not.toContain('건을 받았습니다');
    expect(outcome.error).toContain('NEIS가 응답하지 않습니다');
    expect(outcome.error).toContain('다시 받기');
  });

  test('메시지가 없는 오류도 사람이 읽을 말로 바꾼다', async () => {
    const ports = portsWith({ sync: vi.fn(async () => { throw new Error(''); }) });
    const outcome = await linkSchoolAndSyncDays(ports, 'board-1', school, '2026-08-17');

    expect(outcome.error).toContain('학사일정을 가져오지 못했습니다');
  });
});

describe('이미 연결된 학교의 일정만 다시 받는다', () => {
  test('연결은 건드리지 않는다', async () => {
    const ports = portsWith({ sync: vi.fn(async () => 3) });
    const outcome = await syncDaysOnly(ports, 'board-1', '2026-08-17');

    expect(ports.link).not.toHaveBeenCalled();
    expect(outcome.notice).toBe('학사일정 3건을 받았습니다.');
    expect(outcome.error).toBe('');
  });

  test('실패해도 연결은 그대로다', async () => {
    const ports = portsWith({ sync: vi.fn(async () => { throw new Error('잠시 후 다시 시도해 주세요'); }) });
    const outcome = await syncDaysOnly(ports, 'board-1', '2026-08-17');

    expect(outcome.linked).toBe(true);
    expect(outcome.error).toContain('잠시 후');
  });
});

describe('연결을 지운다', () => {
  test('빈 학교로 덮어 연결을 끊는다', async () => {
    const ports = portsWith();
    const outcome = await unlinkSchool(ports, 'board-1');

    expect(ports.link).toHaveBeenCalledWith('board-1', { name: '', officeCode: '', schoolCode: '' });
    expect(ports.sync).not.toHaveBeenCalled();
    expect(outcome.linked).toBe(false);
    expect(outcome.notice).toBe('학교 연결을 지웠습니다.');
  });
});
