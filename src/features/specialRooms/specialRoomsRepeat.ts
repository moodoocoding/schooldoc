import { addDays, formatDayLabel } from './specialRoomWeek';

/**
 * 매주 같은 시간에 반복해서 잡는다.
 *
 * 중등 교사는 화 3·4교시 물상실, 목 5·6교시 생물실 하는 식으로 학기 내내 같은 시간을 쓴다.
 * 한 학기면 같은 예약이 60~70번인데, 칸을 하나씩 눌러 넣게 하면 구글 시트보다 느리다.
 * 시트는 한 줄 만들어 복사해 아래로 붙여넣으면 끝나기 때문이다.
 *
 * **반복은 넣는 방식이지 저장하는 방식이 아니다.** 펼쳐서 보통 예약으로 하나씩 저장한다.
 * 그래야 나중에 한 주만 지우는 것이 그냥 그 칸을 지우는 일이 된다. 학교는 예외가 많다.
 * 시험 기간 2주를 빼거나, 비 와서 하루를 옮기는 일이 매주 있다. 규칙으로 묶어 두면 그
 * 예외마다 또 다른 개념이 필요해진다.
 *
 * 휴업일과 이미 찬 칸은 건너뛴다. 추석 주에 자동으로 들어가면 지우는 일이 늘고, 남의
 * 예약을 덮으면 사고가 된다.
 */

/** 빠른 선택. 자료 수합 마감 기한과 같은 모양이라 다시 배울 것이 없다. */
export const REPEAT_PRESETS = [
  { weeks: 2, label: '2주' },
  { weeks: 4, label: '4주' },
  { weeks: 8, label: '8주' },
] as const;

/** 한 번에 펼칠 수 있는 최대 주 수. 한 학년도가 대략 52주다. */
export const REPEAT_WEEKS_MAX = 52;

/** 빠른 선택을 마지막 날짜로 바꾼다. `2주`는 이번 주를 포함해 두 번이다. */
export const repeatUntilFromWeeks = (startDate: string, weeks: number) => (
  addDays(startDate, (Math.max(weeks, 1) - 1) * 7)
);

/**
 * 시작일부터 마지막 날짜까지 매주 같은 요일을 펼친다.
 *
 * 마지막 날짜가 시작일보다 앞서면 시작일 하루만 낸다. 잘못 고른 날짜 때문에 아무것도
 * 안 잡히는 것보다, 누른 그 칸 하나라도 잡히는 편이 낫다.
 */
export const repeatDates = (startDate: string, untilDate: string): string[] => {
  const dates: string[] = [];
  for (let index = 0; index < REPEAT_WEEKS_MAX; index += 1) {
    const date = addDays(startDate, index * 7);
    if (date > untilDate) break;
    dates.push(date);
  }
  return dates.length > 0 ? dates : [startDate];
};

export interface RepeatOutcome {
  /** 실제로 잡은 날짜. */
  created: string[];
  /** 휴업일이라 건너뛴 날짜. */
  skippedOffDay: string[];
  /** 이미 다른 예약이 있어 건너뛴 날짜. */
  skippedTaken: string[];
}

/**
 * 넣기 전에 몇 번 잡히는지 미리 알린다.
 *
 * 누르기 전에 숫자가 보여야 "이게 학기 내내 잡히는 거구나"를 안다. 16번인지 2번인지
 * 모르고 누르면 나중에 60칸을 손으로 지우게 된다.
 */
export const repeatPreview = (dates: string[], weekdayLabel: string, period: number) => {
  if (dates.length <= 1) return `${weekdayLabel} ${period}교시 한 번만 잡습니다.`;
  const last = dates[dates.length - 1];
  return `${formatDayLabel(last)}까지 매주 ${weekdayLabel} ${period}교시에 ${dates.length}번 잡습니다.`;
};

/** 넣은 뒤 결과를 사람이 읽을 말로 바꾼다. 건너뛴 것을 감추면 왜 빈지 알 수 없다. */
export const repeatResultNotice = (outcome: RepeatOutcome) => {
  const parts = [`${outcome.created.length}번 잡았습니다`];
  if (outcome.skippedOffDay.length > 0) {
    parts.push(`휴업일 ${outcome.skippedOffDay.length}번은 건너뛰었습니다`);
  }
  if (outcome.skippedTaken.length > 0) {
    parts.push(`이미 예약이 있는 ${outcome.skippedTaken.length}번은 그대로 두었습니다`);
  }
  return `${parts.join('. ')}.`;
};

/**
 * 학기 말을 찾는다. 오늘 이후 첫 방학 하루 전날이다.
 *
 * NEIS 학사일정의 행사 이름에 `여름방학`·`겨울방학`이 들어온다. 방학 첫날부터는 잡을
 * 이유가 없으므로 그 앞날까지만 반복한다. 방학을 못 찾으면 비운다. 학교를 연결하지 않은
 * 예약표에는 학사일정 자체가 없다.
 */
export const termEndFrom = (
  schoolDays: { date: string; eventName: string }[], from: string,
): string => {
  const vacation = schoolDays
    .filter((day) => day.date > from && day.eventName.includes('방학'))
    .map((day) => day.date)
    .sort()[0];
  return vacation ? addDays(vacation, -1) : '';
};
