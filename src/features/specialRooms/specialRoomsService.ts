import { isSpecialRoomsDemoMode } from './specialRoomsConfig';
import * as remote from './specialRoomsRepository';
import * as schoolDays from './specialRoomsSchoolDays';
import * as local from './specialRoomsStore';
import type { BoardInfoDraft } from './specialRoomsBoardInfo';
import type { ClosureDraft } from './specialRoomsClosure';
import { mondayOf } from './specialRoomWeek';
import type {
  ExpectedBooking,
  BookingMutation,
  SpecialRoomBoardSummary,
  Period,
  SpecialRoomBoardDraft,
} from './types';

/**
 * 데모 모드와 실제 Supabase를 가른다.
 *
 * 공개 화면은 로그인하지 않으므로 비밀번호를 매 요청에 들려 보낸다. 데모 저장소는 그것을
 * 무시하지만, 두 경로의 호출 모양을 같게 두어야 화면이 갈라지지 않는다.
 */
export const createBoard = async (
  ownerId: string,
  draft: SpecialRoomBoardDraft,
) =>
  isSpecialRoomsDemoMode
    ? local.createBoard(ownerId, draft)
    : remote.createRemoteBoard(draft);

/** 제목과 안내 문구를 고친다. 안내 문구는 비워도 된다. 규칙은 `specialRoomsBoardInfo`에 있다. */
export const updateBoardInfo = async (
  ownerId: string,
  boardId: string,
  info: BoardInfoDraft,
  expectedRevision?: number,
) => {
  if (isSpecialRoomsDemoMode)
    local.updateBoardInfo(ownerId, boardId, info, expectedRevision);
  else await remote.updateRemoteBoardInfo(boardId, info, expectedRevision);
};

/** 휴관을 건다. 담당자만 할 수 있다. */
export const addClosure = async (
  ownerId: string,
  boardId: string,
  draft: ClosureDraft,
) => {
  if (isSpecialRoomsDemoMode) local.addClosure(ownerId, boardId, draft);
  else await remote.addRemoteClosure(boardId, draft);
};

export const removeClosure = async (
  ownerId: string,
  boardId: string,
  closureId: string,
) => {
  if (isSpecialRoomsDemoMode) local.removeClosure(ownerId, boardId, closureId);
  else await remote.removeRemoteClosure(closureId);
};

export const deleteBoard = async (
  ownerId: string,
  boardId: string,
  preview?: { bookingCount: number; metadataRevision: number },
) => {
  if (isSpecialRoomsDemoMode) {
    const b = local.getBoard(ownerId, boardId);
    if (
      preview &&
      b &&
      (b.bookings.length !== preview.bookingCount ||
        (b.metadataRevision ?? 1) !== preview.metadataRevision)
    )
      throw new Error(
        '예약표 내용이 변경되었습니다. 건수를 다시 확인해 주세요.',
      );
    local.deleteBoard(ownerId, boardId);
  } else {
    if (!preview) throw new Error('삭제할 건수를 먼저 확인해 주세요.');
    await remote.deleteRemoteBoard(boardId, preview);
  }
};

export const setBoardStatus = async (
  ownerId: string,
  boardId: string,
  status: 'open' | 'closed',
) => {
  if (isSpecialRoomsDemoMode) local.setBoardStatus(ownerId, boardId, status);
  else await remote.setRemoteBoardStatus(boardId, status);
};

const localMutation = (
  token: string,
  roomId: string,
  date: string,
  period: Period,
  operationId: string,
): BookingMutation => {
  const board = local.getBoardByToken(token)!;
  return {
    booking:
      board.bookings.find(
        (b) => b.roomId === roomId && b.date === date && b.period === period,
      ) ?? null,
    roomId,
    weekStart: mondayOf(date),
    scopeRevision: local.localScopeRevision(token, roomId, mondayOf(date)),
    operationId,
  };
};
export const setBooking = async (
  token: string,
  password: string,
  roomId: string,
  date: string,
  period: Period,
  label: string,
  expected: ExpectedBooking,
  operationId: string,
) => {
  if (!isSpecialRoomsDemoMode)
    return remote.setRemoteBooking(
      token,
      password,
      roomId,
      date,
      period,
      label,
      expected,
      operationId,
    );
  local.setBooking(token, roomId, date, period, label, expected);
  return localMutation(token, roomId, date, period, operationId);
};
export const setRepeat = async (
  token: string,
  password: string,
  roomId: string,
  date: string,
  period: Period,
  label: string,
  until: string,
  operationId: string,
) => {
  if (!isSpecialRoomsDemoMode)
    return remote.setRemoteRepeat(
      token,
      password,
      roomId,
      date,
      period,
      label,
      until,
      operationId,
    );
  const result = local.setRepeat(token, roomId, date, period, label, until);
  const board = local.getBoardByToken(token)!;
  return {
    ...result,
    bookings: board.bookings.filter(
      (b) =>
        b.roomId === roomId &&
        result.created.includes(b.date) &&
        b.period === period,
    ),
    scopes: result.created.map((d) => ({
      weekStart: mondayOf(d),
      scopeRevision: local.localScopeRevision(token, roomId, mondayOf(d)),
    })),
  };
};
export const clearBooking = async (
  token: string,
  password: string,
  roomId: string,
  date: string,
  period: Period,
  expected: ExpectedBooking,
  operationId: string,
) => {
  if (!isSpecialRoomsDemoMode)
    return remote.clearRemoteBooking(
      token,
      password,
      roomId,
      date,
      period,
      expected,
      operationId,
    );
  local.clearBooking(token, roomId, date, period, expected);
  return {
    ...localMutation(token, roomId, date, period, operationId),
    deletedId: expected?.id,
  };
};
export const subscribeSpecialRooms = (listener: () => void) =>
  isSpecialRoomsDemoMode
    ? local.subscribeSpecialRooms(listener)
    : remote.subscribeRemoteSpecialRooms(listener);

export { searchRemoteSchools as searchSchools } from './specialRoomsRepository';
export type { NeisSchool } from './specialRoomsRepository';

/**
 * 학사일정은 Supabase를 거쳐 NEIS에 묻는다. 데모 저장소에는 대응하는 것이 없어 데모 모드에서는
 * 실패하고, 그 실패는 학사일정 영역 안에서만 알린다. 예약 자체는 그대로 된다.
 * 연결과 일정 받기의 순서·실패 처리는 `specialRoomsSchoolDays`에 있다.
 */
const schoolDaysPorts: schoolDays.SchoolDaysPorts = {
  link: (boardId, school) =>
    remote.linkRemoteSchool(boardId, { ...school, kind: '', address: '' }),
  sync: (boardId, from, to) => remote.syncRemoteSchoolDays(boardId, from, to),
};

export const linkSchoolAndSyncDays = (
  boardId: string,
  school: schoolDays.LinkableSchool,
  reference: string,
) =>
  schoolDays.linkSchoolAndSyncDays(schoolDaysPorts, boardId, school, reference);

export const syncSchoolDays = (boardId: string, reference: string) =>
  schoolDays.syncDaysOnly(schoolDaysPorts, boardId, reference);

export const unlinkSchool = (boardId: string) =>
  schoolDays.unlinkSchool(schoolDaysPorts, boardId);

export const listSummaries = async (
  ownerId: string,
  cursor: remote.SummaryPage['nextCursor'] = null,
  status: string | null = null,
): Promise<remote.SummaryPage> => {
  if (!isSpecialRoomsDemoMode)
    return remote.listRemoteSummaries(cursor, status);
  const boards = local
    .listBoards(ownerId)
    .filter((b) => !status || b.status === status)
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
    )
    .filter(
      (b) =>
        !cursor ||
        b.updatedAt < cursor.updatedAt ||
        (b.updatedAt === cursor.updatedAt && b.id < cursor.id),
    );
  const items = boards.slice(0, 20).map((b) => ({
    id: b.id,
    title: b.title,
    status: b.status,
    updatedAt: b.updatedAt,
    roomCount: b.rooms.length,
    bookingCount: b.bookings.length,
  }));
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      boards.length > 20 && last
        ? { id: last.id, updatedAt: last.updatedAt }
        : null,
  };
};
export const listAllSummaries = async (
  ownerId: string,
  status: string | null = null,
) => {
  const items: SpecialRoomBoardSummary[] = [];
  let cursor: remote.SummaryPage['nextCursor'] = null;
  do {
    const page = await listSummaries(ownerId, cursor, status);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
};
export const deletePreview = async (ownerId: string, boardId: string) => {
  if (!isSpecialRoomsDemoMode)
    return remote.ownerAction<{
      roomCount: number;
      bookingCount: number;
      metadataRevision: number;
    }>(boardId, 'deletePreview');
  const b = local.getBoard(ownerId, boardId);
  if (!b) throw new Error('예약표를 찾을 수 없습니다.');
  return {
    roomCount: b.rooms.length,
    bookingCount: b.bookings.length,
    metadataRevision: b.metadataRevision ?? 1,
  };
};
export const bookingImpact = async (
  ownerId: string,
  boardId: string,
  draft: Record<string, unknown>,
): Promise<number> => {
  if (!isSpecialRoomsDemoMode)
    return (
      await remote.ownerAction<{ count: number }>(boardId, 'impact', draft)
    ).count;
  const b = local.getBoard(ownerId, boardId)!;
  return b.bookings.filter((x) =>
    draft.kind === 'shape'
      ? x.period > Number(draft.periodCount) ||
        (!draft.includeSaturday &&
          new Date(x.date + 'T00:00:00Z').getUTCDay() === 6)
      : (!draft.roomId || x.roomId === draft.roomId) &&
        x.date >= String(draft.startDate) &&
        x.date <= String(draft.endDate),
  ).length;
};
export const listClosures = async (
  ownerId: string,
  boardId: string,
  offset = 0,
) => {
  if (!isSpecialRoomsDemoMode)
    return remote.ownerAction<{
      items: import('./types').SpecialRoomClosure[];
      count: number;
    }>(boardId, 'closures', { offset });
  const b = local.getBoard(ownerId, boardId)!;
  return {
    items: b.closures.slice(offset, offset + 20),
    count: b.closures.length,
  };
};

export interface ShapeImpact {
  count: number;
  periods: { period: number; count: number }[];
  saturdayCount: number;
}
export const shapeImpact = async (
  ownerId: string,
  boardId: string,
  draft: BoardInfoDraft,
): Promise<ShapeImpact> => {
  if (!isSpecialRoomsDemoMode)
    return remote.ownerAction<ShapeImpact>(boardId, 'impact', {
      kind: 'shape',
      ...draft,
    });
  const b = local.getBoard(ownerId, boardId)!;
  const periods = [
    ...new Set(
      b.bookings
        .filter((x) => x.period > draft.periodCount)
        .map((x) => x.period),
    ),
  ]
    .sort((a, b) => a - b)
    .map((period) => ({
      period,
      count: b.bookings.filter((x) => x.period === period).length,
    }));
  return {
    count: await bookingImpact(ownerId, boardId, { kind: 'shape', ...draft }),
    periods,
    saturdayCount: draft.includeSaturday
      ? 0
      : b.bookings.filter(
          (x) => new Date(x.date + 'T00:00:00Z').getUTCDay() === 6,
        ).length,
  };
};
