import { describe, expect, test } from 'vitest';
import {
  REPEAT_WEEKS_MAX,
  repeatDates,
  repeatPreview,
  repeatResultNotice,
  repeatUntilFromWeeks,
  termEndFrom,
} from '../../src/features/specialRooms/specialRoomsRepeat';

/**
 * 매주 같은 시간을 한 번에 잡는다.
 *
 * 중등 교사는 한 학기에 같은 예약이 60~70번이다. 칸을 하나씩 눌러 넣게 하면 구글 시트보다
 * 느려서 아무도 안 쓴다. 반복은 펼쳐서 보통 예약으로 저장하므로, 한 주만 지우는 것은
 * 그냥 그 칸을 지우는 일이 된다.
 */
describe('매주 같은 요일로 펼친다', () => {
  test('시작일부터 마지막 날짜까지 7일 간격으로 낸다', () => {
    // 2026-08-25는 화요일
    expect(repeatDates('2026-08-25', '2026-09-15')).toEqual([
      '2026-08-25', '2026-09-01', '2026-09-08', '2026-09-15',
    ]);
  });

  test('마지막 날짜에 딱 걸리지 않으면 그 앞까지만 낸다', () => {
    expect(repeatDates('2026-08-25', '2026-09-14')).toEqual([
      '2026-08-25', '2026-09-01', '2026-09-08',
    ]);
  });

  test('달과 해를 넘어가도 요일이 어긋나지 않는다', () => {
    const dates = repeatDates('2026-12-29', '2027-01-19');
    expect(dates).toEqual(['2026-12-29', '2027-01-05', '2027-01-12', '2027-01-19']);
  });

  test('마지막 날짜가 시작일보다 앞서면 그 칸 하나만 잡는다', () => {
    // 날짜를 잘못 골랐다고 아무것도 안 잡히면, 누른 칸까지 사라져 더 혼란스럽다.
    expect(repeatDates('2026-08-25', '2026-08-01')).toEqual(['2026-08-25']);
  });

  test('아무리 멀리 잡아도 한 학년도를 넘기지 않는다', () => {
    expect(repeatDates('2026-03-02', '2099-12-31')).toHaveLength(REPEAT_WEEKS_MAX);
  });
});

describe('빠른 선택을 날짜로 바꾼다', () => {
  test('2주는 이번 주를 포함해 두 번이다', () => {
    expect(repeatUntilFromWeeks('2026-08-25', 2)).toBe('2026-09-01');
    expect(repeatDates('2026-08-25', repeatUntilFromWeeks('2026-08-25', 2))).toHaveLength(2);
  });

  test('4주와 8주도 누른 수만큼 잡힌다', () => {
    expect(repeatDates('2026-08-25', repeatUntilFromWeeks('2026-08-25', 4))).toHaveLength(4);
    expect(repeatDates('2026-08-25', repeatUntilFromWeeks('2026-08-25', 8))).toHaveLength(8);
  });
});

describe('넣기 전에 몇 번인지 알린다', () => {
  test('여러 번이면 마지막 날짜와 횟수를 적는다', () => {
    // 16번인지 2번인지 모르고 누르면 나중에 60칸을 손으로 지우게 된다.
    const dates = repeatDates('2026-08-25', '2026-12-15');
    const preview = repeatPreview(dates, '화', 3);
    expect(preview).toContain('12/15까지');
    expect(preview).toContain(`${dates.length}번`);
  });

  test('한 번뿐이면 반복이 아니라고 말한다', () => {
    expect(repeatPreview(['2026-08-25'], '화', 3)).toContain('한 번만');
  });
});

describe('넣은 뒤 결과를 알린다', () => {
  test('건너뛴 것이 없으면 잡은 수만 말한다', () => {
    expect(repeatResultNotice({ created: ['a', 'b'], skippedOffDay: [], skippedTaken: [] }))
      .toBe('2번 잡았습니다.');
  });

  test('휴업일과 이미 찬 칸을 각각 알린다', () => {
    // 건너뛴 것을 감추면 왜 그 주가 빈지 알 수 없다.
    const notice = repeatResultNotice({
      created: ['a'], skippedOffDay: ['b', 'c'], skippedTaken: ['d'],
    });
    expect(notice).toContain('1번 잡았습니다');
    expect(notice).toContain('휴업일 2번은 건너뛰었습니다');
    expect(notice).toContain('이미 예약이 있는 1번은 그대로 두었습니다');
  });
});

describe('학기 말을 찾는다', () => {
  const days = [
    { date: '2026-09-24', eventName: '추석' },
    { date: '2027-01-25', eventName: '겨울방학' },
    { date: '2027-01-26', eventName: '겨울방학' },
  ];

  test('오늘 이후 첫 방학 하루 전날이다', () => {
    expect(termEndFrom(days, '2026-08-25')).toBe('2027-01-24');
  });

  test('방학이 여러 날 이어져도 첫날을 기준으로 한다', () => {
    expect(termEndFrom([...days].reverse(), '2026-08-25')).toBe('2027-01-24');
  });

  test('방학이 이미 지났으면 그 뒤 것을 찾는다', () => {
    const withSummer = [{ date: '2026-07-20', eventName: '여름방학' }, ...days];
    expect(termEndFrom(withSummer, '2026-08-25')).toBe('2027-01-24');
  });

  test('방학을 못 찾으면 비운다', () => {
    // 학교를 연결하지 않은 예약표에는 학사일정 자체가 없다. 그때는 빠른 선택을 감춘다.
    expect(termEndFrom([], '2026-08-25')).toBe('');
    expect(termEndFrom([{ date: '2026-09-24', eventName: '추석' }], '2026-08-25')).toBe('');
  });
});
