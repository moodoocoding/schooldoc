import type { ExpectedBooking } from './types';
// 탭 메모리만 사용한다. 권한 변경/계정 전환 시 삭제한다.
export const specialRoomDrafts = new Map<
  string,
  { draft: string; expected: ExpectedBooking; operationId: string }
>();
export const clearSpecialRoomDrafts = () => specialRoomDrafts.clear();
