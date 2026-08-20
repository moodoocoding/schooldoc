export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type Period = (typeof PERIODS)[number];

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
  schoolName: string;
  status: 'open' | 'closed';
  isPasswordProtected: boolean;
  rooms: SpecialRoom[];
  bookings: SpecialRoomBooking[];
  schoolDays: SchoolDay[];
  createdAt: string;
  updatedAt: string;
}

export interface SpecialRoomBoardDraft {
  title: string;
  description: string;
  schoolName: string;
  password: string;
  rooms: Pick<SpecialRoom, 'name' | 'location'>[];
}
