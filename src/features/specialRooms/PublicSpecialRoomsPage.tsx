import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, DoorOpen } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { SpecialRoomWeekGrid } from './SpecialRoomWeekGrid';
import { isSpecialRoomsDemoMode } from './specialRoomsConfig';
import * as remote from './specialRoomsRepository';
import * as service from './specialRoomsService';
import * as store from './specialRoomsStore';
import { addDays, bookingKey, formatWeekRange, mondayOf, shiftWeek, toDateKey } from './specialRoomWeek';
import { applyBooking, removeBooking } from './specialRoomsOptimistic';
import type { Period, SpecialRoomBoard } from './types';

const inputClass = 'min-h-[52px] w-full rounded-lg border border-[#DCE3EA] bg-white px-4 text-base text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]/15';

/**
 * 가입하지 않은 교사가 링크로 들어와 쓰는 화면.
 *
 * 시간표와 같은 표라 설명이 필요 없다. 이번 주가 기본이고 앞뒤로 넘긴다.
 */
export function PublicSpecialRoomsPage() {
  const { token = '' } = useParams();
  const [board, setBoard] = useState<SpecialRoomBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [roomId, setRoomId] = useState('');
  const [mondayKey, setMondayKey] = useState(() => mondayOf(toDateKey(new Date())));
  const [savingCell, setSavingCell] = useState('');
  const [actionError, setActionError] = useState('');

  // `loadWeek`가 board 전체에 의존하면 board가 바뀔 때마다 새로 만들어져 구독이 다시 붙는다.
  // 필요한 값만 ref에 담아 둔다.
  const boardShapeRef = useRef({ includeSaturday: false, needsPassword: false });
  useEffect(() => {
    boardShapeRef.current = {
      includeSaturday: board?.includeSaturday ?? false,
      needsPassword: board?.isPasswordProtected ?? false,
    };
  }, [board?.includeSaturday, board?.isPasswordProtected]);

  const load = useMemo(() => async () => {
    try {
      if (isSpecialRoomsDemoMode) {
        const found = store.getBoardByToken(token);
        if (!found) setError('예약표를 찾을 수 없습니다.');
        setBoard(found);
        return;
      }
      /*
        예약표 정보와 주간 자료를 나란히 받는다.

        예전에는 토요일을 쓰는 예약표인지 알아야 받을 끝 날짜를 정할 수 있어 정보를 먼저
        기다렸다. 그래서 화면을 열 때마다 느린 호출을 둘 줄 세웠다. 토요일까지 통째로
        받아 두면 기다릴 이유가 없다. 표는 어차피 쓰는 요일만 그린다.
      */
      const canReadWeek = unlocked || !boardShapeRef.current.needsPassword;
      const [metaResult, weekResult] = await Promise.allSettled([
        remote.getRemotePublicBoard(token, password),
        canReadWeek
          ? remote.readRemoteWeek(token, password, mondayKey, addDays(mondayKey, 5))
          : Promise.resolve({ bookings: [], schoolDays: [] }),
      ]);
      if (metaResult.status === 'rejected') throw metaResult.reason;
      const meta = metaResult.value;

      /*
        주간 자료가 실패했을 때 그냥 빈 주로 넘기면 예약이 통째로 사라진 것처럼 보인다.
        볼 자격이 없어서 막힌 경우에만 조용히 넘긴다. 비밀번호가 걸린 예약표를 처음 열면
        아직 걸린 줄 모르고 함께 부르는데, 그건 여기서 걸러진다. 다음부터는 위의
        `canReadWeek`가 아예 부르지 않는다.
      */
      const entitled = unlocked || !meta.isPasswordProtected;
      if (weekResult.status === 'rejected') {
        if (entitled) throw weekResult.reason;
      }
      const week = weekResult.status === 'fulfilled' && entitled
        ? weekResult.value
        : { bookings: [], schoolDays: [] };
      setBoard({ ...meta, bookings: week.bookings, schoolDays: week.schoolDays, createdAt: '', updatedAt: '' });
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '예약표를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, password, unlocked, mondayKey]);

  /**
   * 예약만 바뀌었을 때 쓰는 가벼운 갱신.
   *
   * 예약을 잡아도 예약표 정보(제목·교시 수·휴관·학사일정)는 바뀌지 않는다. 그런데
   * `load()`는 그것까지 매번 다시 받아 왔다. 실측에서 저장 한 번에 엣지 함수를 다섯 번
   * 불렀는데, 그중 둘이 필요 없는 metadata였다.
   */
  const loadWeek = useMemo(() => async () => {
    if (isSpecialRoomsDemoMode) {
      setBoard(store.getBoardByToken(token));
      return;
    }
    const week = await remote.readRemoteWeek(
      token, password, mondayKey, addDays(mondayKey, boardShapeRef.current.includeSaturday ? 5 : 4),
    );
    setBoard((current) => (current ? { ...current, bookings: week.bookings, schoolDays: week.schoolDays } : current));
  }, [token, password, mondayKey]);

  /*
    갱신 요청이 겹치면 한 번만 부른다.

    저장하면 우리가 직접 갱신하고, 같은 변경을 실시간 구독도 알려 준다. 둘을 그대로 두면
    같은 자료를 두 번 받는다. 실측에서 저장 한 번에 다섯 번을 부른 원인 중 하나였다.
  */
  const refreshTimer = useRef<number | undefined>(undefined);
  const refreshWeek = useMemo(() => () => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => { void loadWeek(); }, 250);
  }, [loadWeek]);

  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  useEffect(() => {
    void load();
    return service.subscribeSpecialRooms(() => refreshWeek());
  }, [load, refreshWeek]);

  useEffect(() => {
    if (board && !roomId && board.rooms.length > 0) setRoomId(board.rooms[0].id);
  }, [board, roomId]);

  if (loading) return <main className="py-20 text-center text-sm font-semibold text-[#526174]">불러오는 중입니다.</main>;
  if (!board) {
    return (
      <main className="py-20 text-center">
        <p className="font-bold text-[#0F172A]">{error || '예약표를 찾을 수 없습니다.'}</p>
      </main>
    );
  }

  if (board.isPasswordProtected && !unlocked) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="text-xl font-extrabold text-[#0F172A]">{board.title}</h1>
        <p className="mt-2 text-sm text-[#526174]">예약표를 열려면 비밀번호가 필요합니다.</p>
        <form
          className="mt-6 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              try {
                if (isSpecialRoomsDemoMode) {
                  if (!store.verifyPassword(token, password)) throw new Error('비밀번호가 맞지 않습니다.');
                } else {
                  await remote.unlockRemoteBoard(token, password);
                }
                setUnlocked(true);
                setPasswordError('');
              } catch (unlockError) {
                setPasswordError(unlockError instanceof Error ? unlockError.message : '비밀번호가 맞지 않습니다.');
              }
            })();
          }}
        >
          <label className="grid gap-2 text-sm font-bold text-[#334155]">
            비밀번호
            <input type="password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {passwordError ? <p role="alert" className="text-sm font-semibold text-[#B42318]">{passwordError}</p> : null}
          <button type="submit" className="min-h-[52px] rounded-lg bg-[#0F6CBD] text-base font-bold text-white">열기</button>
        </form>
      </main>
    );
  }

  const closed = board.status !== 'open';

  /**
   * 누른 즉시 화면에 반영하고, 저장은 뒤에서 한다.
   *
   * 예전에는 서버가 끝날 때까지 회전 표시만 돌았다. 실측에서 저장 한 번에 엣지 함수를
   * 다섯 번 부르고 표에 반영되기까지 4초가 걸렸는데, 40칸을 훑으며 몇 개씩 잡는 화면에서
   * 한 번에 4초는 쓰지 못할 속도다.
   *
   * 실패하면 누르기 전 상태로 되돌리고 무엇이 잘못됐는지 알린다. 되돌릴 수 있어야 하므로
   * 이전 목록을 그대로 들고 있는다.
   *
   * 칸에 회전 표시를 얹지 않는 것도 같은 이유다. 누른 즉시 값이 그려지는데 그 위에 회전
   * 표시를 덮으면 정작 방금 적은 내용이 가려진다. 그래서 `savingCell`은 연속 저장을 막는
   * 빗장으로만 쓰고 표에는 넘기지 않는다.
   */
  const run = async (
    cellKey: string,
    optimistic: (bookings: SpecialRoomBoard['bookings']) => SpecialRoomBoard['bookings'],
    work: () => Promise<void>,
  ) => {
    if (savingCell) return;
    const previous = board.bookings;
    setBoard((current) => (current ? { ...current, bookings: optimistic(current.bookings) } : current));
    setSavingCell(cellKey);
    setActionError('');
    try {
      await work();
      // 서버가 만든 진짜 값으로 확정한다. 실시간 구독이 같은 변경을 알려 와도 한 번만 받는다.
      refreshWeek();
    } catch (workError) {
      setBoard((current) => (current ? { ...current, bookings: previous } : current));
      setActionError(workError instanceof Error ? workError.message : '예약을 처리하지 못했습니다.');
    } finally {
      setSavingCell('');
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="border-b border-[#DCE3EA] pb-5">
        <p className="text-xs font-bold text-[#0F6CBD]">특별실 예약</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#0F172A]">{board.title}</h1>
        {board.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526174]">{board.description}</p> : null}
        {closed ? (
          <p role="status" className="mt-3 inline-flex rounded-md bg-[#EEF1F4] px-3 py-1 text-xs font-bold text-[#526174]">
            예약이 종료되어 보기만 할 수 있습니다
          </p>
        ) : null}
      </header>

      {board.rooms.length > 1 ? (
        <div role="tablist" aria-label="특별실 선택" className="mt-5 flex flex-wrap gap-2">
          {board.rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              role="tab"
              aria-selected={roomId === room.id}
              onClick={() => setRoomId(room.id)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 text-sm font-bold ${
                roomId === room.id
                  ? 'border-[#0F6CBD] bg-[#0F6CBD] text-white'
                  : 'border-[#C8D0DA] bg-white text-[#334155] hover:border-[#8ABBE0]'
              }`}
            >
              <DoorOpen className="h-4 w-4" />{room.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
          <CalendarDays className="h-4 w-4 text-[#0F6CBD]" />
          {formatWeekRange(mondayKey)}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMondayKey(shiftWeek(mondayKey, -1))} aria-label="지난 주" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#C8D0DA] text-[#334155]">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setMondayKey(mondayOf(toDateKey(new Date())))} className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-4 text-sm font-bold text-[#334155]">
            이번 주
          </button>
          <button type="button" onClick={() => setMondayKey(shiftWeek(mondayKey, 1))} aria-label="다음 주" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#C8D0DA] text-[#334155]">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {actionError ? (
        <p role="alert" className="mt-4 flex items-start gap-2 border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{actionError}
        </p>
      ) : null}

      <div className="mt-4">
        {roomId ? (
          <SpecialRoomWeekGrid
            mondayKey={mondayKey}
            roomId={roomId}
            periodCount={board.periodCount}
            includeSaturday={board.includeSaturday}
            termEndDate={board.termEndDate}
            closures={board.closures}
            onRepeat={async (date, period, label, until) => {
              const outcome = await service.setRepeat(token, password, roomId, date, period, label, until);
              await load();
              return outcome;
            }}
            roomName={board.rooms.find((room) => room.id === roomId)?.name}
            bookings={board.bookings}
            schoolDays={board.schoolDays}
            readOnly={closed}
            onSave={(date, period, label) => void run(
              bookingKey(date, period),
              (bookings) => applyBooking(bookings, { roomId, date, period: period as Period }, label),
              () => service.setBooking(token, password, roomId, date, period as Period, label),
            )}
            onClear={(date, period) => void run(
              bookingKey(date, period),
              (bookings) => removeBooking(bookings, { roomId, date, period: period as Period }),
              () => service.clearBooking(token, password, roomId, date, period as Period),
            )}
          />
        ) : (
          <p className="py-16 text-center text-sm text-[#64748B]">등록된 특별실이 없습니다.</p>
        )}
      </div>

    </main>
  );
}
