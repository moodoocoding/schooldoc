import {
  SpecialRoomError,
  type ExpectedBooking,
  type BookingMutation,
  type SpecialRoomBoardSummary,
} from './types';
import { mondayOf } from './specialRoomWeek';
import { supabase } from '../../utils/supabaseClient';
import { type RepeatOutcome } from './specialRoomsRepeat';
import { toDateKey } from './specialRoomWeek';
import type {
  Period,
  SpecialRoomBoard,
  SpecialRoomBoardDraft,
  SpecialRoomBooking,
} from './types';

/**
 * 실제 Supabase를 쓰는 저장소.
 *
 * 교사 조회는 소유자 RPC/RLS로 격리하고 공개 조회는 토큰·비밀번호를 검증한다. 예약 칸은 가입하지 않은 교사도 고쳐야 하므로 공개 엣지 함수만 쓴다.
 * 그래서 담당자 화면도 칸을 바꿀 때는 같은 함수를 지난다.
 */
const CHANGE_EVENT = 'schooldoc-special-rooms-remote-change';

const client = () => {
  if (!supabase) throw new Error('Supabase 연결 정보가 없습니다.');
  return supabase;
};

const fail = (message: string, error: { message?: string }): never => {
  throw new Error(error?.message ? `${message}: ${error.message}` : message);
};

const notify = () => window.dispatchEvent(new CustomEvent(CHANGE_EVENT));

/** 공개 함수를 부른다. 실패 메시지를 그대로 살려 화면에 보여 준다. */
const callPublic = async <T>(body: Record<string, unknown>) => {
  const { data, error } = await client().functions.invoke(
    'special-rooms-public',
    { body },
  );
  if (error) {
    const context = error.context as Response | undefined;
    if (context) {
      const parsed = (await context
        .clone()
        .json()
        .catch(() => null)) as {
        error?: string;
        code?: string;
        current?: SpecialRoomBooking | null;
      } | null;
      if (parsed?.error)
        throw new SpecialRoomError(
          parsed.error,
          context.status,
          parsed.code,
          parsed.current,
        );
    }
    throw new Error(error.message || '예약을 처리하지 못했습니다.');
  }
  return data as T;
};

const callAdmin = async <T>(body: Record<string, unknown>) => {
  const { data, error } = await client().functions.invoke(
    'special-rooms-admin',
    { body },
  );
  if (error) {
    const context = error.context as Response | undefined;
    if (context) {
      const parsed = (await context
        .clone()
        .json()
        .catch(() => null)) as {
        error?: string;
        code?: string;
        current?: SpecialRoomBooking | null;
      } | null;
      if (parsed?.error)
        throw new SpecialRoomError(
          parsed.error,
          context.status,
          parsed.code,
          parsed.current,
        );
    }
    throw new Error(error.message || '학사일정을 처리하지 못했습니다.');
  }
  return data as T;
};

export interface SummaryPage {
  items: SpecialRoomBoardSummary[];
  nextCursor: { id: string; updatedAt: string } | null;
}
export const listRemoteSummaries = async (
  cursor: SummaryPage['nextCursor'] = null,
  status: string | null = null,
): Promise<SummaryPage> => {
  const { data, error } = await client().rpc('list_special_room_summaries', {
    p_cursor: cursor,
    p_status: status,
    p_limit: 20,
  });
  if (error) fail('예약표를 불러오지 못했습니다', error);
  return data as SummaryPage;
};
export interface ScopeResult {
  board: SpecialRoomBoard;
  unchanged?: boolean;
  locked?: boolean;
  notification?: { token: string; expiresAt: number } | null;
}
export const getRemoteBoard = async (
  boardId: string,
  roomId = '',
  from = mondayOf(toDateKey(new Date())),
  known = {},
) => {
  const { data, error } = await client().rpc('get_special_room_owner_scope', {
    p_board: boardId,
    p_room: roomId || null,
    p_week: from,
    p_known: known,
  });
  if (error) {
    if (error.code === '42501')
      throw new SpecialRoomError('이 예약표를 관리할 권한이 없습니다.', 403);
    fail('예약표를 불러오지 못했습니다', error);
  }
  return (data as ScopeResult)?.board ?? null;
};
const publicReads = new Map<string, Promise<ScopeResult>>();
/** 공개 화면은 로그인하지 않으므로 엣지 함수로만 읽는다. */
export const readRemoteScope = async (
  token: string,
  password: string,
  roomId: string,
  from: string,
  action = 'week',
  known = {},
): Promise<ScopeResult> => {
  const body = {
    action,
    token,
    password,
    roomId,
    from,
    known: Object.keys(known).length ? known : undefined,
  };
  const key = JSON.stringify(body);
  const running = publicReads.get(key);
  if (running) return running;
  const request = callPublic<ScopeResult>(body);
  publicReads.set(key, request);
  try {
    return await request;
  } finally {
    if (publicReads.get(key) === request) publicReads.delete(key);
  }
};
export const setRemoteBooking = async (
  token: string,
  password: string,
  roomId: string,
  date: string,
  period: Period,
  label: string,
  expected: ExpectedBooking,
  operationId: string,
) =>
  callPublic<BookingMutation>({
    action: 'setBooking',
    token,
    password,
    roomId,
    date,
    period,
    label,
    expected,
    operationId,
  });
export const setRemoteRepeat = async (
  token: string,
  password: string,
  roomId: string,
  date: string,
  period: Period,
  label: string,
  until: string,
  operationId: string,
) =>
  callPublic<
    RepeatOutcome & {
      bookings: SpecialRoomBooking[];
      scopes: { weekStart: string; scopeRevision: number }[];
    }
  >({
    action: 'setRepeat',
    token,
    password,
    roomId,
    date,
    period,
    label,
    until,
    operationId,
  });
export const clearRemoteBooking = async (
  token: string,
  password: string,
  roomId: string,
  date: string,
  period: Period,
  expected: ExpectedBooking,
  operationId: string,
) =>
  callPublic<BookingMutation>({
    action: 'clearBooking',
    token,
    password,
    roomId,
    date,
    period,
    expected,
    operationId,
  });
export const ownerAction = async <T>(
  boardId: string,
  action: string,
  data = {},
): Promise<T> => {
  const result = await client().rpc('special_room_owner_action', {
    p_board: boardId,
    p_action: action,
    p_data: data,
  });
  if (result.error) fail('예약표를 처리하지 못했습니다', result.error);
  if (result.data?.status >= 400)
    throw new SpecialRoomError(result.data.error, result.data.status);
  return result.data as T;
};
export const createRemoteBoard = async (draft: SpecialRoomBoardDraft) => {
  const { data: userData, error: userError } = await client().auth.getUser();
  if (userError) fail('로그인 정보를 확인하지 못했습니다', userError);
  const ownerId = userData.user?.id;
  if (!ownerId) throw new Error('로그인이 필요합니다.');

  // 비밀번호는 서버 함수로만 해시한다. 평문이 DB에 닿지 않게 한다.
  let passwordDigest: string | null = null;
  if (draft.password) {
    const { data, error } = await client().rpc('hash_special_room_password', {
      p_password: draft.password,
    });
    if (error) fail('공개 비밀번호를 설정하지 못했습니다', error);
    passwordDigest = data as string;
  }

  const { data: created, error } = await client()
    .from('special_room_boards')
    .insert({
      owner_id: ownerId,
      title: draft.title.trim(),
      description: draft.description.trim(),
      period_count: draft.periodCount,
      include_saturday: draft.includeSaturday,
      school_name: draft.school?.name ?? null,
      neis_office_code: draft.school?.officeCode ?? null,
      neis_school_code: draft.school?.schoolCode ?? null,
      password_digest: passwordDigest,
    })
    .select('id')
    .single();
  if (error) fail('예약표를 만들지 못했습니다', error);
  if (!created) throw new Error('만든 예약표를 확인하지 못했습니다.');

  const boardId = created.id as string;
  try {
    const rooms = draft.rooms.filter((room) => room.name.trim());
    if (rooms.length > 0) {
      const { error: roomError } = await client()
        .from('special_rooms')
        .insert(
          rooms.map((room, position) => ({
            board_id: boardId,
            position,
            name: room.name.trim(),
            location: room.location.trim(),
          })),
        );
      if (roomError) throw roomError;
    }
  } catch (roomError) {
    // 특별실 없는 예약표는 쓸 수 없다. 반쯤 만들어진 것을 남기지 않는다.
    await client().from('special_room_boards').delete().eq('id', boardId);
    throw roomError;
  }

  notify();
  const board = await getRemoteBoard(boardId);
  if (!board) throw new Error('만든 예약표를 확인하지 못했습니다.');
  return board;
};

export const setRemoteBoardStatus = async (
  boardId: string,
  status: 'open' | 'closed',
) => {
  const { error } = await client()
    .from('special_room_boards')
    .update({ status })
    .eq('id', boardId);
  if (error) fail('예약표 상태를 바꾸지 못했습니다', error);
  notify();
};

export const addRemoteClosure = async (
  boardId: string,
  draft: {
    roomId: string;
    startDate: string;
    endDate: string;
    reason: string;
  },
) => {
  const { error } = await client()
    .from('special_room_closures')
    .insert({
      board_id: boardId,
      // 빈 문자열은 `모든 특별실`이라는 뜻이라 null로 저장한다.
      room_id: draft.roomId || null,
      start_date: draft.startDate,
      end_date: draft.endDate,
      reason: draft.reason.trim(),
    });
  if (error) fail('휴관을 저장하지 못했습니다', error);
  notify();
};

export const removeRemoteClosure = async (closureId: string) => {
  const { error } = await client()
    .from('special_room_closures')
    .delete()
    .eq('id', closureId);
  if (error) fail('휴관을 지우지 못했습니다', error);
  notify();
};

export const updateRemoteBoardInfo = async (
  boardId: string,
  info: {
    title: string;
    description: string;
    periodCount: number;
    includeSaturday: boolean;
  },
  expectedRevision?: number,
) => {
  await ownerAction(boardId, 'info', { ...info, expectedRevision });
  notify();
};
export const deleteRemoteBoard = async (
  boardId: string,
  preview: { bookingCount: number; metadataRevision: number },
) => {
  await ownerAction(boardId, 'delete', preview);
  notify();
};
export interface NeisSchool {
  officeCode: string;
  schoolCode: string;
  name: string;
  kind: string;
  address: string;
}

export const searchRemoteSchools = async (schoolName: string) => {
  const { schools } = await callAdmin<{ schools: NeisSchool[] }>({
    action: 'searchSchool',
    schoolName,
  });
  return schools;
};

export const linkRemoteSchool = async (boardId: string, school: NeisSchool) => {
  const { error } = await client()
    .from('special_room_boards')
    .update({
      school_name: school.name,
      neis_office_code: school.officeCode,
      neis_school_code: school.schoolCode,
    })
    .eq('id', boardId);
  if (error) fail('학교를 연결하지 못했습니다', error);
  notify();
};

export const syncRemoteSchoolDays = async (
  boardId: string,
  from: string,
  to: string,
) => {
  const { count } = await callAdmin<{ count: number }>({
    action: 'syncSchoolDays',
    boardId,
    from,
    to,
  });
  notify();
  return count;
};

export const subscribeRemoteSpecialRooms = (listener: () => void) => {
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
  };
};
