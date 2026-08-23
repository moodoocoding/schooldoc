import { cleanBookingLabel, toDateKey } from './specialRoomWeek';
import { repeatDates, termEndFrom } from './specialRoomsRepeat';
import type { Period, SpecialRoomBoard, SpecialRoomBoardDraft, SpecialRoomBooking } from './types';

/**
 * 데모 모드 저장소. localStorage에만 쓴다.
 *
 * E2E가 전부 데모 모드로 돌기 때문에, 이 파일이 있어야 화면 흐름을 자동으로 검증할 수 있다.
 * 서버가 지키는 규칙(같은 칸 중복, 닫힌 예약표)을 여기서도 같은 모양으로 지켜야 E2E가
 * 실제 동작과 어긋나지 않는다.
 */
const STORAGE_KEY = 'schooldoc_special_rooms_v1';
const CHANGE_EVENT = 'schooldoc-special-rooms-change';

/** 학기 말은 학사일정에서 계산하는 값이라 저장하지 않는다. 읽을 때 만들어 준다. */
interface StoredBoard extends Omit<SpecialRoomBoard, 'termEndDate'> {
  ownerId: string;
  password: string;
}

const readAll = (): StoredBoard[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as StoredBoard[] : [];
  } catch {
    return [];
  }
};

const writeAll = (boards: StoredBoard[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

const strip = (board: StoredBoard): SpecialRoomBoard => {
  const { ownerId: _ownerId, password: _password, ...rest } = board;
  return { ...rest, termEndDate: termEndFrom(rest.schoolDays, toDateKey(new Date())) };
};

export const subscribeSpecialRooms = (listener: () => void) => {
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
};

export const listBoards = (ownerId: string) => (
  readAll().filter((board) => board.ownerId === ownerId).map(strip)
);

export const getBoard = (ownerId: string, boardId: string) => {
  const found = readAll().find((board) => board.id === boardId && board.ownerId === ownerId);
  return found ? strip(found) : null;
};

export const getBoardByToken = (token: string) => {
  const found = readAll().find((board) => board.publicToken === token);
  return found ? strip(found) : null;
};

export const createBoard = (ownerId: string, draft: SpecialRoomBoardDraft) => {
  const now = new Date().toISOString();
  const board: StoredBoard = {
    id: crypto.randomUUID(),
    publicToken: crypto.randomUUID(),
    ownerId,
    password: draft.password,
    title: draft.title.trim(),
    description: draft.description.trim(),
    periodCount: draft.periodCount,
    includeSaturday: draft.includeSaturday,
    schoolName: draft.school?.name ?? '',
    status: 'open',
    isPasswordProtected: Boolean(draft.password),
    rooms: draft.rooms.map((room, position) => ({
      id: crypto.randomUUID(),
      position,
      name: room.name.trim(),
      location: room.location.trim(),
    })),
    bookings: [],
    schoolDays: [],
    createdAt: now,
    updatedAt: now,
  };
  writeAll([board, ...readAll()]);
  return strip(board);
};

export const deleteBoard = (ownerId: string, boardId: string) => {
  writeAll(readAll().filter((board) => !(board.id === boardId && board.ownerId === ownerId)));
};

export const setBoardStatus = (ownerId: string, boardId: string, status: 'open' | 'closed') => {
  writeAll(readAll().map((board) => (
    board.id === boardId && board.ownerId === ownerId
      ? { ...board, status, updatedAt: new Date().toISOString() }
      : board
  )));
};

export const updateBoardInfo = (
  ownerId: string,
  boardId: string,
  info: { title: string; description: string; periodCount: number; includeSaturday: boolean },
) => {
  writeAll(readAll().map((board) => (
    board.id === boardId && board.ownerId === ownerId
      ? {
        ...board,
        title: info.title,
        description: info.description,
        periodCount: info.periodCount,
        includeSaturday: info.includeSaturday,
        updatedAt: new Date().toISOString(),
      }
      : board
  )));
};

export const verifyPassword = (token: string, password: string) => {
  const board = readAll().find((entry) => entry.publicToken === token);
  if (!board) return false;
  return !board.password || board.password === password;
};

/**
 * 칸을 채운다. 있으면 고치고 없으면 만든다.
 * 서버와 같은 규칙이라, 아무나 남의 칸도 고칠 수 있다.
 */
export const setBooking = (
  token: string,
  roomId: string,
  date: string,
  period: Period,
  label: string,
) => {
  const cleaned = cleanBookingLabel(label);
  if (!cleaned) throw new Error('내용을 입력해 주세요.');

  writeAll(readAll().map((board) => {
    if (board.publicToken !== token) return board;
    if (board.status !== 'open') throw new Error('예약이 종료되었습니다.');

    const existing = board.bookings.find((booking) => (
      booking.roomId === roomId && booking.date === date && booking.period === period
    ));
    const now = new Date().toISOString();
    const bookings: SpecialRoomBooking[] = existing
      ? board.bookings.map((booking) => (
        booking === existing ? { ...booking, label: cleaned, updatedAt: now } : booking
      ))
      : [...board.bookings, { id: crypto.randomUUID(), roomId, date, period, label: cleaned, updatedAt: now }];
    return { ...board, bookings, updatedAt: now };
  }));
};

/**
 * 데모 저장소의 반복 넣기. 실제 서버와 같은 규칙을 따라야 화면이 갈라지지 않는다.
 * 휴업일과 이미 찬 칸을 건너뛰고, 무엇을 건너뛰었는지 그대로 돌려준다.
 */
export const setRepeat = (
  token: string, roomId: string, date: string, period: Period, label: string, until: string,
) => {
  const clean = cleanBookingLabel(label);
  const outcome = { created: [] as string[], skippedOffDay: [] as string[], skippedTaken: [] as string[] };
  writeAll(readAll().map((board) => {
    if (board.publicToken !== token) return board;
    const offDays = new Set(board.schoolDays.filter((day) => day.isOffDay).map((day) => day.date));
    const taken = new Set(board.bookings
      .filter((booking) => booking.roomId === roomId && booking.period === period)
      .map((booking) => booking.date));
    const added: StoredBoard['bookings'] = [];
    for (const day of repeatDates(date, until)) {
      if (offDays.has(day)) { outcome.skippedOffDay.push(day); continue; }
      if (taken.has(day)) { outcome.skippedTaken.push(day); continue; }
      outcome.created.push(day);
      added.push({
        id: crypto.randomUUID(), roomId, date: day, period, label: clean,
        updatedAt: new Date().toISOString(),
      });
    }
    return { ...board, bookings: [...board.bookings, ...added], updatedAt: new Date().toISOString() };
  }));
  return outcome;
};

export const clearBooking = (token: string, roomId: string, date: string, period: Period) => {
  writeAll(readAll().map((board) => {
    if (board.publicToken !== token) return board;
    if (board.status !== 'open') throw new Error('예약이 종료되었습니다.');
    return {
      ...board,
      bookings: board.bookings.filter((booking) => !(
        booking.roomId === roomId && booking.date === date && booking.period === period
      )),
      updatedAt: new Date().toISOString(),
    };
  }));
};
