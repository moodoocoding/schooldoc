import { isSpecialRoomsDemoMode } from './specialRoomsConfig';
import * as remote from './specialRoomsRepository';
import * as schoolDays from './specialRoomsSchoolDays';
import * as local from './specialRoomsStore';
import type { BoardInfoDraft } from './specialRoomsBoardInfo';
import type { ClosureDraft } from './specialRoomsClosure';
import type { Period, SpecialRoomBoardDraft } from './types';

/**
 * 데모 모드와 실제 Supabase를 가른다.
 *
 * 공개 화면은 로그인하지 않으므로 비밀번호를 매 요청에 들려 보낸다. 데모 저장소는 그것을
 * 무시하지만, 두 경로의 호출 모양을 같게 두어야 화면이 갈라지지 않는다.
 */
export const listBoards = async (ownerId: string) => (
  isSpecialRoomsDemoMode ? local.listBoards(ownerId) : remote.listRemoteBoards()
);

export const getBoard = async (ownerId: string, boardId: string) => (
  isSpecialRoomsDemoMode ? local.getBoard(ownerId, boardId) : remote.getRemoteBoard(boardId)
);

export const createBoard = async (ownerId: string, draft: SpecialRoomBoardDraft) => (
  isSpecialRoomsDemoMode ? local.createBoard(ownerId, draft) : remote.createRemoteBoard(draft)
);

/** 제목과 안내 문구를 고친다. 안내 문구는 비워도 된다. 규칙은 `specialRoomsBoardInfo`에 있다. */
export const updateBoardInfo = async (ownerId: string, boardId: string, info: BoardInfoDraft) => {
  if (isSpecialRoomsDemoMode) local.updateBoardInfo(ownerId, boardId, info);
  else await remote.updateRemoteBoardInfo(boardId, info);
};

/** 휴관을 건다. 담당자만 할 수 있다. */
export const addClosure = async (ownerId: string, boardId: string, draft: ClosureDraft) => {
  if (isSpecialRoomsDemoMode) local.addClosure(ownerId, boardId, draft);
  else await remote.addRemoteClosure(boardId, draft);
};

export const removeClosure = async (ownerId: string, boardId: string, closureId: string) => {
  if (isSpecialRoomsDemoMode) local.removeClosure(ownerId, boardId, closureId);
  else await remote.removeRemoteClosure(closureId);
};

export const deleteBoard = async (ownerId: string, boardId: string) => {
  if (isSpecialRoomsDemoMode) local.deleteBoard(ownerId, boardId);
  else await remote.deleteRemoteBoard(boardId);
};

export const setBoardStatus = async (ownerId: string, boardId: string, status: 'open' | 'closed') => {
  if (isSpecialRoomsDemoMode) local.setBoardStatus(ownerId, boardId, status);
  else await remote.setRemoteBoardStatus(boardId, status);
};

export const setBooking = async (
  token: string, password: string, roomId: string, date: string, period: Period, label: string,
) => {
  if (isSpecialRoomsDemoMode) local.setBooking(token, roomId, date, period, label);
  else await remote.setRemoteBooking(token, password, roomId, date, period, label);
};

/** 매주 같은 시간을 한 번에 잡는다. 펼치는 규칙은 `specialRoomsRepeat`에 있다. */
export const setRepeat = async (
  token: string, password: string, roomId: string, date: string, period: Period, label: string, until: string,
) => (
  isSpecialRoomsDemoMode
    ? local.setRepeat(token, roomId, date, period, label, until)
    : remote.setRemoteRepeat(token, password, roomId, date, period, label, until)
);

export const clearBooking = async (
  token: string, password: string, roomId: string, date: string, period: Period,
) => {
  if (isSpecialRoomsDemoMode) local.clearBooking(token, roomId, date, period);
  else await remote.clearRemoteBooking(token, password, roomId, date, period);
};

export const subscribeSpecialRooms = (listener: () => void) => (
  isSpecialRoomsDemoMode ? local.subscribeSpecialRooms(listener) : remote.subscribeRemoteSpecialRooms(listener)
);

export { searchRemoteSchools as searchSchools } from './specialRoomsRepository';
export type { NeisSchool } from './specialRoomsRepository';

/**
 * 학사일정은 Supabase를 거쳐 NEIS에 묻는다. 데모 저장소에는 대응하는 것이 없어 데모 모드에서는
 * 실패하고, 그 실패는 학사일정 영역 안에서만 알린다. 예약 자체는 그대로 된다.
 * 연결과 일정 받기의 순서·실패 처리는 `specialRoomsSchoolDays`에 있다.
 */
const schoolDaysPorts: schoolDays.SchoolDaysPorts = {
  link: (boardId, school) => remote.linkRemoteSchool(boardId, { ...school, kind: '', address: '' }),
  sync: (boardId, from, to) => remote.syncRemoteSchoolDays(boardId, from, to),
};

export const linkSchoolAndSyncDays = (boardId: string, school: schoolDays.LinkableSchool, reference: string) => (
  schoolDays.linkSchoolAndSyncDays(schoolDaysPorts, boardId, school, reference)
);

export const syncSchoolDays = (boardId: string, reference: string) => (
  schoolDays.syncDaysOnly(schoolDaysPorts, boardId, reference)
);

export const unlinkSchool = (boardId: string) => schoolDays.unlinkSchool(schoolDaysPorts, boardId);
