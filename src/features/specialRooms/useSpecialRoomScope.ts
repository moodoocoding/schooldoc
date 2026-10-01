import { useEffect, useRef, useState } from 'react';
import { addDays, mondayOf, toDateKey } from './specialRoomWeek';
import { isSpecialRoomsDemoMode } from './specialRoomsConfig';
import * as local from './specialRoomsStore';
import * as remote from './specialRoomsRepository';
import { clearSpecialRoomDrafts } from './specialRoomDrafts';
import {
  applyCellEvent,
  subscribeScope,
  type CellEvent,
} from './specialRoomsRealtime';
import {
  SpecialRoomError,
  type SpecialRoomBoard,
  type BookingMutation,
} from './types';
interface Options {
  token?: string;
  password?: string;
  ownerId?: string;
  boardId?: string;
  roomId: string;
  mondayKey: string;
}
export function useSpecialRoomScope(options: Options) {
  const { token, password, ownerId, boardId, roomId, mondayKey } = options;
  const [board, setBoard] = useState<SpecialRoomBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(0);
  const [connection, setConnection] = useState('CONNECTING');
  const [checkedAt, setCheckedAt] = useState('');
  const [retry, setRetry] = useState(0);
  const boardRef = useRef(board);
  boardRef.current = board;
  const cache = useRef(new Map<string, SpecialRoomBoard>());
  const refreshRef = useRef<() => void>(() => {});
  const authKey = `${ownerId ?? ''}|${token ?? boardId}|${password ?? ''}`;
  const lastAuth = useRef(authKey);
  const boardAuth = useRef(authKey);
  if (lastAuth.current !== authKey) {
    cache.current.clear();
    clearSpecialRoomDrafts();
    lastAuth.current = authKey;
  }
  const key = `${authKey}|${roomId}|${mondayKey}`;
  const patch = (event: CellEvent) => {
    if (boardAuth.current !== authKey) return;
    for (const [k, value] of cache.current) {
      if (
        value.selectedRoomId !== event.roomId ||
        value.weekStart !== event.weekStart
      )
        continue;
      const result = applyCellEvent(value, event);
      if (result.gap) cache.current.delete(k);
      else cache.current.set(k, result.board);
    }
    const current = boardRef.current;
    if (!current) return;
    const result = applyCellEvent(current, event);
    if (result.gap) {
      refreshRef.current();
      return;
    }
    boardRef.current = result.board;
    setBoard(result.board);
  };
  useEffect(() => {
    let active = true,
      reading = false,
      queued = false,
      timer: number | undefined,
      stop = () => {};
    let events: CellEvent[] = [];
    let denied = false;
    let notBefore = 0;
    let notification: remote.ScopeResult['notification'];
    let channelKey = '';
    const cached = cache.current.get(key);
    setLoading(!cached);
    setConnection(isSpecialRoomsDemoMode ? 'DEMO' : 'CONNECTING');
    setError('');
    setErrorStatus(0);
    setBoard(cached ?? null);
    boardRef.current = cached ?? null;
    const scope = (full: SpecialRoomBoard): SpecialRoomBoard => {
      const room = roomId || full.rooms[0]?.id || '';
      return {
        ...full,
        selectedRoomId: room,
        weekStart: mondayKey,
        scopeRevision: local.localScopeRevision(
          full.publicToken,
          room,
          mondayKey,
        ),
        bookings: full.bookings.filter(
          (b) =>
            b.roomId === room &&
            b.date >= mondayKey &&
            b.date <= addDays(mondayKey, 5),
        ),
        schoolDays: full.schoolDays.filter(
          (d) => d.date >= mondayKey && d.date <= addDays(mondayKey, 5),
        ),
        thisWeekBookingCount: full.bookings.filter(
          (b) =>
            b.date >= mondayOf(toDateKey(new Date())) &&
            b.date <=
              addDays(
                mondayOf(toDateKey(new Date())),
                full.includeSaturday ? 5 : 4,
              ),
        ).length,
      };
    };
    const save = (next: SpecialRoomBoard) => {
      if (!active) return;
      boardRef.current = next;
      boardAuth.current = authKey;
      setBoard(next);
      cache.current.delete(key);
      cache.current.set(key, next);
      cache.current.set(`${authKey}|${next.selectedRoomId}|${mondayKey}`, next);
      while (cache.current.size > 8)
        cache.current.delete(cache.current.keys().next().value!);
    };
    const request = async () => {
      if (!active || denied) return;
      if (Date.now() < notBefore) {
        schedule();
        return;
      }
      if (document.visibilityState === 'hidden') {
        queued = true;
        return;
      }
      if (reading) {
        queued = true;
        return;
      }
      reading = true;
      queued = false;
      try {
        const current = boardRef.current;
        let next: SpecialRoomBoard | null;
        if (isSpecialRoomsDemoMode) {
          next = ownerId
            ? local.getBoard(ownerId, boardId ?? '')
            : local.getBoardByToken(token ?? '');
          if (
            next?.isPasswordProtected &&
            !ownerId &&
            password &&
            !local.verifyPassword(token ?? '', password)
          )
            throw new SpecialRoomError('비밀번호가 맞지 않습니다.', 401);
          if (
            next &&
            (!next.isPasswordProtected ||
              ownerId ||
              local.verifyPassword(token ?? '', password ?? ''))
          )
            next = scope(next);
          else if (next)
            next = {
              ...next,
              rooms: [],
              bookings: [],
              schoolDays: [],
              closures: [],
              scopeRevision: undefined,
            };
        } else {
          const known =
            current?.scopeRevision !== undefined
              ? {
                  scopeRevision: current.scopeRevision,
                  metadataRevision: current.metadataRevision,
                  calendarRevision: current.calendarRevision,
                }
              : {};
          if (ownerId)
            next = await remote.getRemoteBoard(
              boardId ?? '',
              roomId,
              mondayKey,
              known,
            );
          else {
            const action =
              current?.scopeRevision !== undefined
                ? 'week'
                : password
                  ? 'unlock'
                  : 'bootstrap';
            const result = await remote.readRemoteScope(
              token ?? '',
              password ?? '',
              roomId,
              mondayKey,
              action,
              known,
            );
            next = result.board;
            if (!notification || notification.expiresAt < Date.now() + 360000)
              notification = result.notification;
          }
          if (next && current && next.bookings === null)
            next = {
              ...next,
              bookings: current.bookings,
              schoolDays: current.schoolDays,
              closures: current.closures,
            };
        }
        if (!active) return;
        if (!next) throw new Error('예약표를 찾을 수 없습니다.');
        save(next);
        setError('');
        setErrorStatus(0);
        setLoading(false);
        setCheckedAt(new Date().toLocaleTimeString('ko-KR'));
        const buffered = events;
        events = [];
        for (const e of buffered) {
          const r = applyCellEvent(boardRef.current!, e);
          if (r.gap) queued = true;
          else save(r.board);
        }
        if (!isSpecialRoomsDemoMode && next.scopeRevision !== undefined) {
          // 최초 snapshot→구독 사이 유실은 구독 확인 직후 조건부 버전 조회 한 번으로 막는다.
          const nextKey = `${next.id}|${next.accessEpoch}|${next.selectedRoomId}|${next.weekStart}|${notification?.token ?? 'owner'}`;
          if (nextKey !== channelKey) {
            stop();
            channelKey = nextKey;
            stop = subscribeScope(
              next,
              notification,
              Boolean(ownerId),
              (e) => {
                if (!active) return;
                if (document.visibilityState === 'hidden') {
                  queued = true;
                  return;
                }
                if (reading) events.push(e);
                else {
                  const r = applyCellEvent(boardRef.current!, e);
                  if (r.gap) schedule();
                  else save(r.board);
                }
              },
              (kind) => {
                if (kind === 'access-changed' && !ownerId) {
                  denied = true;
                  cache.current.clear();
                  clearSpecialRoomDrafts();
                  save({
                    ...boardRef.current!,
                    bookings: [],
                    schoolDays: [],
                    closures: [],
                    isPasswordProtected: true,
                    scopeRevision: undefined,
                  });
                  setError(
                    '접근 정보가 변경되었습니다. 비밀번호를 다시 확인해 주세요.',
                  );
                  stop();
                } else schedule();
              },
              (status) => {
                if (!active) return;
                setConnection(status);
                if (status === 'SUBSCRIBED') schedule();
              },
            );
          }
        }
      } catch (thrown) {
        if (!active) return;
        setError(
          thrown instanceof Error
            ? thrown.message
            : '예약표를 불러오지 못했습니다.',
        );
        setLoading(false);
        setErrorStatus(thrown instanceof SpecialRoomError ? thrown.status : 0);
        if (thrown instanceof SpecialRoomError && thrown.status === 429)
          notBefore = Date.now() + 60000;
        if (
          thrown instanceof SpecialRoomError &&
          [401, 403, 404].includes(thrown.status)
        ) {
          denied = true;
          cache.current.clear();
          clearSpecialRoomDrafts();
          setBoard(null);
          boardRef.current = null;
          stop();
        }
      } finally {
        reading = false;
        if (active && queued) schedule();
      }
    };
    const schedule = () => {
      if (timer !== undefined || denied) return;
      timer = window.setTimeout(
        () => {
          timer = undefined;
          void request();
        },
        Math.max(300, notBefore - Date.now()),
      );
    };
    refreshRef.current = schedule;
    if (isSpecialRoomsDemoMode) stop = local.subscribeSpecialRooms(schedule);
    void request();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') schedule();
    }, 300000);
    const resume = () => {
      if (document.visibilityState === 'visible') schedule();
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => {
      active = false;
      stop();
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, [
    key,
    retry,
    token,
    password,
    ownerId,
    boardId,
    roomId,
    mondayKey,
    authKey,
  ]);
  return {
    board: boardAuth.current === authKey ? board : null,
    loading,
    error,
    errorStatus,
    connection,
    checkedAt,
    refresh: () => setRetry((v) => v + 1),
    applyMutation: (result: BookingMutation) =>
      patch({
        scopeRevision: result.scopeRevision,
        roomId: result.roomId,
        weekStart: result.weekStart,
        upserts: result.booking ? [result.booking] : [],
        deletedIds: result.deletedId ? [result.deletedId] : [],
      }),
    applyEvents: patch,
    refreshSoon: () => refreshRef.current(),
    applyCurrent: (
      booking: SpecialRoomBoard['bookings'][number] | null,
      date: string,
      period: number,
    ) => {
      const current = boardRef.current;
      if (
        !current ||
        boardAuth.current !== authKey ||
        !current.weekStart ||
        date < current.weekStart ||
        date > addDays(current.weekStart, 5) ||
        (roomId || current.rooms[0]?.id) !== current.selectedRoomId ||
        (booking && booking.roomId !== current.selectedRoomId)
      )
        return;
      const next = {
        ...current,
        bookings: [
          ...current.bookings.filter(
            (b) => !(b.date === date && b.period === period),
          ),
          ...(booking ? [booking] : []),
        ],
      };
      boardRef.current = next;
      setBoard(next);
    },
  };
}
