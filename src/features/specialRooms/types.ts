/**
 * 담을 수 있는 교시의 전부. 예약표마다 이 중 앞에서 몇 개를 쓸지 정한다.
 *
 * 초등은 6교시가 끝이고 중등은 7교시, 고등은 방과후까지 9교시를 쓴다. 학교마다 다른데
 * 예전에는 8교시가 코드에 박혀 있어 초등은 두 줄이 늘 비고 고등은 방과후를 못 넣었다.
 * DB의 `period between 1 and 9`와 같은 값이다.
 */
export const ALL_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** 예약표가 고를 수 있는 교시 수. */
export const PERIOD_COUNT_MIN = 4;
export const PERIOD_COUNT_MAX = ALL_PERIODS.length;
export const DEFAULT_PERIOD_COUNT = 8;
export type Period = (typeof ALL_PERIODS)[number];

export interface SpecialRoom {
  id: string;
  position: number;
  name: string;
  location: string;
}

export interface SpecialRoomBooking {
  id: string;
  roomId: string;
  /** YYYY-MM-DD */
  date: string;
  period: Period;
  /** 칸에 적히는 것. '6-1반'처럼 학급 이름이지 사람 이름이 아니다. */
  label: string;
  updatedAt: string;
}

/** NEIS에서 받아 둔 학사일정 하루치. */
export interface SchoolDay {
  /** YYYY-MM-DD */
  date: string;
  eventName: string;
  isOffDay: boolean;
}

export interface SpecialRoomBoard {
  id: string;
  publicToken: string;
  title: string;
  description: string;
  /** 이 예약표가 쓰는 교시 수. 앞에서부터 이만큼만 표에 나온다. */
  periodCount: number;
  /** 토요일까지 보여 줄지. 고등학교는 주말 모의면접·자습이 있다. */
  includeSaturday: boolean;
  /**
   * 이번 학기 마지막 날. 받아 둔 학사일정에서 다음 방학 앞날을 찾아 둔다.
   * 학교를 연결하지 않았거나 방학을 못 찾으면 빈 문자열이고, 그때는 `학기 말까지`
   * 빠른 선택을 감춘다.
   */
  termEndDate: string;
  schoolName: string;
  status: 'open' | 'closed';
  isPasswordProtected: boolean;
  rooms: SpecialRoom[];
  bookings: SpecialRoomBooking[];
  schoolDays: SchoolDay[];
  createdAt: string;
  updatedAt: string;
}

/** NEIS에서 고른 학교. 이름만으로는 학사일정을 받을 수 없어 코드까지 함께 든다. */
export interface SelectedSchool {
  name: string;
  officeCode: string;
  schoolCode: string;
}

export interface SpecialRoomBoardDraft {
  periodCount: number;
  includeSaturday: boolean;
  title: string;
  description: string;
  school: SelectedSchool | null;
  password: string;
  rooms: Pick<SpecialRoom, 'name' | 'location'>[];
}
