import { isSpecialRoomsDemoMode } from './specialRoomsConfig';
import * as remote from './specialRoomsRepository';
import * as schoolDays from './specialRoomsSchoolDays';
import * as local from './specialRoomsStore';
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

export const linkSchoolAndSyncDays = (boardId: string, school: schoolDays.LinkableSchool, fromMonday: string) => (
  schoolDays.linkSchoolAndSyncDays(schoolDaysPorts, boardId, school, fromMonday)
);

export const syncSchoolDays = (boardId: string, fromMonday: string) => (
  schoolDays.syncDaysOnly(schoolDaysPorts, boardId, fromMonday)
);

export const unlinkSchool = (boardId: string) => schoolDays.unlinkSchool(schoolDaysPorts, boardId);
