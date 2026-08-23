import { supabase } from '../../utils/supabaseClient';
import { termEndFrom, type RepeatOutcome } from './specialRoomsRepeat';
import { toDateKey } from './specialRoomWeek';
import type {
  Period,
  SchoolDay,
  SpecialRoomBoard,
  SpecialRoomBoardDraft,
  SpecialRoomBooking,
} from './types';

/**
 * 실제 Supabase를 쓰는 저장소.
 *
 * 예약표와 특별실은 RLS를 걸고 브라우저가 직접 읽고 쓴다. 개인정보가 없어 암복호가 필요
 * 없기 때문이다. 예약 칸은 가입하지 않은 교사도 고쳐야 하므로 공개 엣지 함수만 쓴다.
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

interface BoardRow {
  id: string;
  public_token: string;
  title: string;
  description: string;
  period_count: number;
  include_saturday: boolean;
  school_name: string | null;
  neis_office_code: string | null;
  neis_school_code: string | null;
  status: 'open' | 'closed';
  password_digest: string | null;
  created_at: string;
  updated_at: string;
}

/** 공개 함수를 부른다. 실패 메시지를 그대로 살려 화면에 보여 준다. */
const callPublic = async <T>(body: Record<string, unknown>) => {
  const { data, error } = await client().functions.invoke('special-rooms-public', { body });
  if (error) {
    const context = error.context as Response | undefined;
    if (context) {
      const parsed = await context.clone().json().catch(() => null) as { error?: string } | null;
      if (parsed?.error) throw new Error(parsed.error);
    }
    throw new Error(error.message || '예약을 처리하지 못했습니다.');
  }
  return data as T;
};

const callAdmin = async <T>(body: Record<string, unknown>) => {
  const { data, error } = await client().functions.invoke('special-rooms-admin', { body });
  if (error) {
    const context = error.context as Response | undefined;
    if (context) {
      const parsed = await context.clone().json().catch(() => null) as { error?: string } | null;
      if (parsed?.error) throw new Error(parsed.error);
    }
    throw new Error(error.message || '학사일정을 처리하지 못했습니다.');
  }
  return data as T;
};

const assemble = async (rows: BoardRow[]): Promise<SpecialRoomBoard[]> => {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [roomsResult, bookingsResult, daysResult] = await Promise.all([
    client().from('special_rooms').select('id, board_id, position, name, location').in('board_id', ids).order('position'),
    client().from('special_room_bookings').select('id, board_id, room_id, booking_date, period, label, updated_at').in('board_id', ids),
    client().from('special_room_school_days').select('board_id, day, event_name, is_off_day').in('board_id', ids),
  ]);
  if (roomsResult.error) fail('특별실 목록을 불러오지 못했습니다', roomsResult.error);
  if (bookingsResult.error) fail('예약을 불러오지 못했습니다', bookingsResult.error);
  if (daysResult.error) fail('학사일정을 불러오지 못했습니다', daysResult.error);

  return rows.map((row) => ({
    id: row.id,
    publicToken: row.public_token,
    title: row.title,
    description: row.description,
    periodCount: row.period_count,
    includeSaturday: row.include_saturday,
    schoolName: row.school_name ?? '',
    status: row.status,
    isPasswordProtected: Boolean(row.password_digest),
    rooms: (roomsResult.data ?? [])
      .filter((room) => room.board_id === row.id)
      .map((room) => ({ id: room.id, position: room.position, name: room.name, location: room.location })),
    bookings: (bookingsResult.data ?? [])
      .filter((booking) => booking.board_id === row.id)
      .map((booking): SpecialRoomBooking => ({
        id: booking.id,
        roomId: booking.room_id,
        date: booking.booking_date,
        period: booking.period as Period,
        label: booking.label,
        updatedAt: booking.updated_at,
      })),
    schoolDays: (daysResult.data ?? [])
      .filter((day) => day.board_id === row.id)
      .map((day): SchoolDay => ({ date: day.day, eventName: day.event_name, isOffDay: day.is_off_day })),
    termEndDate: termEndFrom(
      (daysResult.data ?? []).filter((day) => day.board_id === row.id)
        .map((day) => ({ date: day.day as string, eventName: day.event_name as string })),
      toDateKey(new Date()),
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

const BOARD_COLUMNS = 'id, public_token, title, description, period_count, include_saturday, school_name, neis_office_code, neis_school_code, status, password_digest, created_at, updated_at';

export const listRemoteBoards = async () => {
  const { data, error } = await client().from('special_room_boards')
    .select(BOARD_COLUMNS).order('updated_at', { ascending: false });
  if (error) fail('예약표를 불러오지 못했습니다', error);
  return assemble((data ?? []) as BoardRow[]);
};

export const getRemoteBoard = async (boardId: string) => {
  const { data, error } = await client().from('special_room_boards')
    .select(BOARD_COLUMNS).eq('id', boardId).maybeSingle();
  if (error) fail('예약표를 불러오지 못했습니다', error);
  if (!data) return null;
  return (await assemble([data as BoardRow]))[0] ?? null;
};

/** 공개 화면은 로그인하지 않으므로 엣지 함수로만 읽는다. */
export const getRemotePublicBoard = async (token: string, password: string) => {
  const { board } = await callPublic<{ board: Omit<SpecialRoomBoard, 'bookings' | 'schoolDays' | 'createdAt' | 'updatedAt'> & { hasPassword: boolean } }>({
    action: 'metadata', token,
  });
  return { ...board, isPasswordProtected: board.hasPassword, password };
};

export const unlockRemoteBoard = async (token: string, password: string) => {
  await callPublic({ action: 'unlock', token, password });
  return true;
};

export const readRemoteWeek = async (token: string, password: string, from: string, to: string) => (
  callPublic<{ bookings: SpecialRoomBooking[]; schoolDays: SchoolDay[] }>({
    action: 'week', token, password, from, to,
  })
);

export const setRemoteBooking = async (
  token: string, password: string, roomId: string, date: string, period: Period, label: string,
) => {
  await callPublic({ action: 'setBooking', token, password, roomId, date, period, label });
  notify();
};

export const setRemoteRepeat = async (
  token: string, password: string, roomId: string, date: string, period: Period, label: string, until: string,
) => callPublic<RepeatOutcome>({ action: 'setRepeat', token, password, roomId, date, period, label, until });

export const clearRemoteBooking = async (
  token: string, password: string, roomId: string, date: string, period: Period,
) => {
  await callPublic({ action: 'clearBooking', token, password, roomId, date, period });
  notify();
};

export const createRemoteBoard = async (draft: SpecialRoomBoardDraft) => {
  const { data: userData, error: userError } = await client().auth.getUser();
  if (userError) fail('로그인 정보를 확인하지 못했습니다', userError);
  const ownerId = userData.user?.id;
  if (!ownerId) throw new Error('로그인이 필요합니다.');

  // 비밀번호는 서버 함수로만 해시한다. 평문이 DB에 닿지 않게 한다.
  let passwordDigest: string | null = null;
  if (draft.password) {
    const { data, error } = await client().rpc('hash_special_room_password', { p_password: draft.password });
    if (error) fail('공개 비밀번호를 설정하지 못했습니다', error);
    passwordDigest = data as string;
  }

  const { data: created, error } = await client().from('special_room_boards').insert({
    owner_id: ownerId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    period_count: draft.periodCount,
    include_saturday: draft.includeSaturday,
    school_name: draft.school?.name ?? null,
    neis_office_code: draft.school?.officeCode ?? null,
    neis_school_code: draft.school?.schoolCode ?? null,
    password_digest: passwordDigest,
  }).select('id').single();
  if (error) fail('예약표를 만들지 못했습니다', error);
  if (!created) throw new Error('만든 예약표를 확인하지 못했습니다.');

  const boardId = created.id as string;
  try {
    const rooms = draft.rooms.filter((room) => room.name.trim());
    if (rooms.length > 0) {
      const { error: roomError } = await client().from('special_rooms').insert(
        rooms.map((room, position) => ({
          board_id: boardId, position, name: room.name.trim(), location: room.location.trim(),
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

export const setRemoteBoardStatus = async (boardId: string, status: 'open' | 'closed') => {
  const { error } = await client().from('special_room_boards').update({ status }).eq('id', boardId);
  if (error) fail('예약표 상태를 바꾸지 못했습니다', error);
  notify();
};

export const updateRemoteBoardInfo = async (
  boardId: string,
  info: { title: string; description: string; periodCount: number; includeSaturday: boolean },
) => {
  const { error } = await client().from('special_room_boards')
    .update({
      title: info.title,
      description: info.description,
      period_count: info.periodCount,
      include_saturday: info.includeSaturday,
    }).eq('id', boardId);
  if (error) fail('예약표 정보를 저장하지 못했습니다', error);
  notify();
};

export const deleteRemoteBoard = async (boardId: string) => {
  const { error } = await client().from('special_room_boards').delete().eq('id', boardId);
  if (error) fail('예약표를 지우지 못했습니다', error);
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
  const { schools } = await callAdmin<{ schools: NeisSchool[] }>({ action: 'searchSchool', schoolName });
  return schools;
};

export const linkRemoteSchool = async (boardId: string, school: NeisSchool) => {
  const { error } = await client().from('special_room_boards').update({
    school_name: school.name,
    neis_office_code: school.officeCode,
    neis_school_code: school.schoolCode,
  }).eq('id', boardId);
  if (error) fail('학교를 연결하지 못했습니다', error);
  notify();
};

export const syncRemoteSchoolDays = async (boardId: string, from: string, to: string) => {
  const { count } = await callAdmin<{ count: number }>({ action: 'syncSchoolDays', boardId, from, to });
  notify();
  return count;
};

export const subscribeRemoteSpecialRooms = (listener: () => void) => {
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  const channel = client()
    .channel(`special-rooms-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'special_room_bookings' }, handler)
    .subscribe();
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    void client().removeChannel(channel);
  };
};
