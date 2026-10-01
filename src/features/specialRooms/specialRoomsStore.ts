import {
  newBookingAllowed,
  repeatRangeError,
} from '../../../supabase/functions/_shared/specialRooms';
import {
  SpecialRoomError,
  expectedBooking,
  type ExpectedBooking,
} from './types';
import { cleanBookingLabel, toDateKey, mondayOf } from './specialRoomWeek';
import { repeatDates, termEndFrom } from './specialRoomsRepeat';
import { closureAt } from './specialRoomsClosure';
import type {
  Period,
  SpecialRoomBoard,
  SpecialRoomBoardDraft,
  SpecialRoomBooking,
} from './types';

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
  weekRevisions?: Record<string, number>;
}

const readAll = (): StoredBoard[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredBoard[]) : [];
  } catch {
    return [];
  }
};

const writeAll = (boards: StoredBoard[]) => {
  const previous = readAll();
  for (const board of boards) {
    const old = previous.find((b) => b.id === board.id);
    const revisions = { ...old?.weekRevisions };
    const scopes = new Set<string>();
    for (const b of [...board.bookings, ...(old?.bookings ?? [])]) {
      const before = old?.bookings.find((x) => x.id === b.id);
      const after = board.bookings.find((x) => x.id === b.id);
      if (JSON.stringify(before) !== JSON.stringify(after))
        scopes.add(b.roomId + '|' + mondayOf(b.date));
    }
    for (const scope of scopes) revisions[scope] = (revisions[scope] ?? 0) + 1;
    board.weekRevisions = revisions;
    const fields = (b: StoredBoard) =>
      JSON.stringify([
        b.title,
        b.description,
        b.periodCount,
        b.includeSaturday,
        b.status,
        b.schoolName,
        b.isPasswordProtected,
        b.closures,
        b.rooms,
      ]);
    board.metadataRevision =
      (old?.metadataRevision ?? 1) +
      (old && fields(old) !== fields(board) ? 1 : 0);
    board.calendarRevision =
      (old?.calendarRevision ?? 1) +
      (old &&
      JSON.stringify(old.schoolDays) !== JSON.stringify(board.schoolDays)
        ? 1
        : 0);
    board.accessEpoch = old?.accessEpoch ?? 1;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

const strip = (board: StoredBoard): SpecialRoomBoard => {
  const {
    ownerId: _ownerId,
    password: _password,
    weekRevisions: _weekRevisions,
    ...rest
  } = board;
  return {
    ...rest,
    termEndDate: termEndFrom(rest.schoolDays, toDateKey(new Date())),
  };
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

export const listBoards = (ownerId: string) =>
  readAll()
    .filter((board) => board.ownerId === ownerId)
    .map(strip);

export const getBoard = (ownerId: string, boardId: string) => {
  const found = readAll().find(
    (board) => board.id === boardId && board.ownerId === ownerId,
  );
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
    closures: [],
    schoolDays: [],
    createdAt: now,
    updatedAt: now,
  };
  writeAll([board, ...readAll()]);
  return strip(board);
};

export const deleteBoard = (ownerId: string, boardId: string) => {
  writeAll(
    readAll().filter(
      (board) => !(board.id === boardId && board.ownerId === ownerId),
    ),
  );
};

export const setBoardStatus = (
  ownerId: string,
  boardId: string,
  status: 'open' | 'closed',
) => {
  writeAll(
    readAll().map((board) =>
      board.id === boardId && board.ownerId === ownerId
        ? { ...board, status, updatedAt: new Date().toISOString() }
        : board,
    ),
  );
};

export const updateBoardInfo = (
  ownerId: string,
  boardId: string,
  info: {
    title: string;
    description: string;
    periodCount: number;
    includeSaturday: boolean;
  },
  expectedRevision?: number,
) => {
  const current = getBoard(ownerId, boardId);
  if (!current) throw new Error('예약표를 찾을 수 없습니다.');
  if (
    expectedRevision !== undefined &&
    (current.metadataRevision ?? 1) !== expectedRevision
  )
    throw new SpecialRoomError(
      '설정이 변경되었습니다. 최신 설정을 확인해 주세요.',
      409,
      'METADATA_CONFLICT',
    );
  writeAll(
    readAll().map((board) =>
      board.id === boardId && board.ownerId === ownerId
        ? {
            ...board,
            title: info.title,
            description: info.description,
            periodCount: info.periodCount,
            includeSaturday: info.includeSaturday,
            updatedAt: new Date().toISOString(),
          }
        : board,
    ),
  );
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
  expected?: ExpectedBooking,
) => {
  const cleaned = cleanBookingLabel(label);
  if (!cleaned) throw new Error('내용을 입력해 주세요.');

  writeAll(
    readAll().map((board) => {
      if (board.publicToken !== token) return board;
      if (board.status !== 'open') throw new Error('예약이 종료되었습니다.');

      const existing = board.bookings.find(
        (booking) =>
          booking.roomId === roomId &&
          booking.date === date &&
          booking.period === period,
      );
      if (!board.rooms.some((room) => room.id === roomId))
        throw new Error('특별실을 찾을 수 없습니다.');
      if (closureAt(board.closures, roomId, date))
        throw new Error('휴관 기간에는 예약을 바꿀 수 없습니다.');
      if (
        expected !== undefined &&
        JSON.stringify(expectedBooking(existing)) !== JSON.stringify(expected)
      )
        throw new SpecialRoomError(
          '다른 사람이 예약을 변경했습니다. 현재 내용을 확인해 주세요.',
          409,
          'BOOKING_CONFLICT',
          existing ?? null,
        );
      if (!existing && !newBookingAllowed(date, period, board))
        throw new Error('운영 요일과 교시 안에서 예약해 주세요.');
      if (existing?.label === cleaned) return board;
      const now = new Date().toISOString();
      const bookings: SpecialRoomBooking[] = existing
        ? board.bookings.map((booking) =>
            booking === existing
              ? {
                  ...booking,
                  label: cleaned,
                  updatedAt: now,
                  revision: (booking.revision ?? 1) + 1,
                }
              : booking,
          )
        : [
            ...board.bookings,
            {
              id: crypto.randomUUID(),
              roomId,
              date,
              period,
              label: cleaned,
              updatedAt: now,
              revision: 1,
            },
          ];
      return { ...board, bookings, updatedAt: now };
    }),
  );
};

/**
 * 데모 저장소의 반복 넣기. 실제 서버와 같은 규칙을 따라야 화면이 갈라지지 않는다.
 * 휴업일과 이미 찬 칸을 건너뛰고, 무엇을 건너뛰었는지 그대로 돌려준다.
 */
export const addClosure = (
  ownerId: string,
  boardId: string,
  draft: {
    roomId: string;
    startDate: string;
    endDate: string;
    reason: string;
  },
) => {
  writeAll(
    readAll().map((board) =>
      board.id === boardId && board.ownerId === ownerId
        ? {
            ...board,
            closures: [
              ...board.closures,
              {
                id: crypto.randomUUID(),
                ...draft,
                reason: draft.reason.trim(),
              },
            ],
            updatedAt: new Date().toISOString(),
          }
        : board,
    ),
  );
};

export const removeClosure = (
  ownerId: string,
  boardId: string,
  closureId: string,
) => {
  writeAll(
    readAll().map((board) =>
      board.id === boardId && board.ownerId === ownerId
        ? {
            ...board,
            closures: board.closures.filter(
              (closure) => closure.id !== closureId,
            ),
            updatedAt: new Date().toISOString(),
          }
        : board,
    ),
  );
};

export const setRepeat = (
  token: string,
  roomId: string,
  date: string,
  period: Period,
  label: string,
  until: string,
) => {
  const clean = cleanBookingLabel(label);
  if (!clean) throw new Error('내용을 입력해 주세요.');
  const rangeError = repeatRangeError(date, until);
  if (rangeError) throw new Error(rangeError);
  const outcome = {
    created: [] as string[],
    skippedOffDay: [] as string[],
    skippedTaken: [] as string[],
  };
  writeAll(
    readAll().map((board) => {
      if (board.publicToken !== token) return board;
      if (board.status !== 'open') throw new Error('예약이 종료되었습니다.');
      if (
        !board.rooms.some((room) => room.id === roomId) ||
        !newBookingAllowed(date, period, board)
      )
        throw new Error('운영 요일과 교시 안에서 예약해 주세요.');
      const offDays = new Set(
        board.schoolDays.filter((day) => day.isOffDay).map((day) => day.date),
      );
      const taken = new Set(
        board.bookings
          .filter(
            (booking) => booking.roomId === roomId && booking.period === period,
          )
          .map((booking) => booking.date),
      );
      const added: StoredBoard['bookings'] = [];
      for (const day of repeatDates(date, until)) {
        // 휴관도 휴업일과 같이 건너뛴다. 담당이 자리를 비운 날에 자동으로 넣으면 안 된다.
        if (offDays.has(day) || closureAt(board.closures, roomId, day)) {
          outcome.skippedOffDay.push(day);
          continue;
        }
        if (taken.has(day)) {
          outcome.skippedTaken.push(day);
          continue;
        }
        outcome.created.push(day);
        added.push({
          id: crypto.randomUUID(),
          roomId,
          date: day,
          period,
          label: clean,
          updatedAt: new Date().toISOString(),
        });
      }
      return {
        ...board,
        bookings: [...board.bookings, ...added],
        updatedAt: new Date().toISOString(),
      };
    }),
  );
  return outcome;
};

export const clearBooking = (
  token: string,
  roomId: string,
  date: string,
  period: Period,
  expected?: ExpectedBooking,
) => {
  writeAll(
    readAll().map((board) => {
      if (board.publicToken !== token) return board;
      if (board.status !== 'open') throw new Error('예약이 종료되었습니다.');
      const existing = board.bookings.find(
        (b) => b.roomId === roomId && b.date === date && b.period === period,
      );
      if (closureAt(board.closures, roomId, date))
        throw new Error('휴관 기간에는 예약을 바꿀 수 없습니다.');
      if (
        expected !== undefined &&
        JSON.stringify(expectedBooking(existing)) !== JSON.stringify(expected)
      )
        throw new SpecialRoomError(
          '다른 사람이 예약을 변경했습니다. 현재 내용을 확인해 주세요.',
          409,
          'BOOKING_CONFLICT',
          existing ?? null,
        );
      return {
        ...board,
        bookings: board.bookings.filter(
          (booking) =>
            !(
              booking.roomId === roomId &&
              booking.date === date &&
              booking.period === period
            ),
        ),
        updatedAt: new Date().toISOString(),
      };
    }),
  );
};

export const localScopeRevision = (token: string, room: string, week: string) =>
  readAll().find((b) => b.publicToken === token)?.weekRevisions?.[
    room + '|' + week
  ] ?? 0;
