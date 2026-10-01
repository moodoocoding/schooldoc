import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Printer,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { SpecialRoomWeekGrid } from './SpecialRoomWeekGrid';
import { SpecialRoomPicker } from './SpecialRoomPicker';
import { SpecialRoomPrint } from './SpecialRoomPrint';
import { useSpecialRoomScope } from './useSpecialRoomScope';
import * as service from './specialRoomsService';
import {
  bookingKey,
  formatWeekRange,
  mondayOf,
  shiftWeek,
  toDateKey,
} from './specialRoomWeek';
import {
  type ExpectedBooking,
  type Period,
  type SpecialRoomBoard,
  SpecialRoomError,
} from './types';
export function PublicSpecialRoomsPage() {
  const { token = '' } = useParams();
  const [roomId, setRoomId] = useState('');
  const [mondayKey, setMondayKey] = useState(() =>
    mondayOf(toDateKey(new Date())),
  );
  const [password, setPassword] = useState('');
  const [acceptedPassword, setAcceptedPassword] = useState('');
  const [savingCell, setSavingCell] = useState('');
  const [saveState, setSaveState] = useState('');
  const [meta, setMeta] = useState<SpecialRoomBoard | null>(null);
  const scope = useSpecialRoomScope({
    token,
    password: acceptedPassword,
    roomId,
    mondayKey,
  });
  const repeatOperation = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    if (scope.board) {
      setMeta(scope.board);
    }
  }, [scope.board, roomId]);
  useEffect(() => {
    setMeta(null);
    setAcceptedPassword('');
    setPassword('');
    setSaveState('');
    setRoomId('');
  }, [token]);
  const board =
    scope.board ??
    (meta?.publicToken === token && ![403, 404].includes(scope.errorStatus)
      ? meta
      : null);
  const selectedRoom =
    roomId || board?.selectedRoomId || board?.rooms[0]?.id || '';
  if (!board) {
    return (
      <main className="special-room-planner min-h-screen bg-[var(--sr-canvas)] px-4 py-20 text-center">
        <p
          role={scope.error ? 'alert' : 'status'}
          className="text-sm font-semibold"
        >
          {scope.error || '불러오는 중입니다.'}
        </p>
        {scope.error ? (
          <button
            type="button"
            onClick={scope.refresh}
            className="mt-4 min-h-[44px] rounded-lg border px-4 font-bold"
          >
            다시 시도
          </button>
        ) : null}
      </main>
    );
  }
  const locked =
    board.isPasswordProtected && scope.board?.scopeRevision === undefined;
  if (locked) {
    return (
      <main className="special-room-planner min-h-screen bg-[var(--sr-canvas)] px-4 py-16">
        <div className="mx-auto max-w-md rounded-2xl border bg-[var(--sr-surface)] p-6">
          <h1 className="text-xl font-bold">{board.title}</h1>
          <p className="mt-2 text-sm">예약표를 열려면 비밀번호가 필요합니다.</p>
          <form
            className="mt-6 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setAcceptedPassword(password);
              scope.refresh();
            }}
          >
            <label className="grid gap-2 text-sm font-bold">
              비밀번호
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-[52px] rounded-lg border px-4 text-base"
              />
            </label>
            {scope.error ? (
              <p role="alert" className="text-sm text-[#B42318]">
                {scope.error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={scope.loading}
              className="min-h-[52px] rounded-lg bg-[var(--sr-accent)] font-bold text-white"
            >
              열기
            </button>
          </form>
        </div>
      </main>
    );
  }
  const current =
    scope.board?.weekStart === mondayKey &&
    scope.board?.selectedRoomId === selectedRoom;
  const writable =
    current && !scope.loading && !scope.error && board.status === 'open';
  const run = async (
    date: string,
    period: Period,
    label: string,
    expected: ExpectedBooking,
    operationId: string,
  ) => {
    if (savingCell) throw new Error('다른 예약을 저장 중입니다.');
    if (!writable) {
      throw new Error('최신 예약표를 확인한 뒤 다시 시도해 주세요.');
    }
    setSavingCell(bookingKey(date, period));
    setSaveState('저장 중');
    try {
      const result = label
        ? await service.setBooking(
            token,
            acceptedPassword,
            selectedRoom,
            date,
            period,
            label,
            expected,
            operationId,
          )
        : await service.clearBooking(
            token,
            acceptedPassword,
            selectedRoom,
            date,
            period,
            expected,
            operationId,
          );
      scope.applyMutation(result);
      setSaveState('저장됨');
    } catch (error) {
      setSaveState('저장 실패');
      if (
        error instanceof SpecialRoomError &&
        error.code === 'BOOKING_CONFLICT'
      )
        scope.applyCurrent(error.current, date, period);
      throw error;
    } finally {
      setSavingCell('');
    }
  };
  return (
    <>
      <main className="special-room-planner special-room-screen min-h-screen w-full bg-[var(--sr-canvas)] px-4 py-8 text-[var(--sr-text)] sm:py-10">
        <header className="mx-auto max-w-[1040px] pb-4">
          <p className="text-xs font-extrabold tracking-wide text-[var(--sr-accent)]">
            특별실 예약
          </p>
          <h1 className="mt-1.5 text-2xl font-extrabold">{board.title}</h1>
          {board.description ? (
            <p className="mt-2 text-sm leading-6 text-[var(--sr-text-muted)]">
              {board.description}
            </p>
          ) : null}
          {board.status !== 'open' ? (
            <p
              role="status"
              className="mt-3 rounded-md bg-[var(--sr-closed)] px-3 py-2 text-sm font-bold"
            >
              예약이 종료되어 보기만 할 수 있습니다
            </p>
          ) : null}
        </header>
        <section
          aria-label="예약 주간 선택"
          className="mx-auto mt-3 max-w-[1040px] rounded-xl border border-[var(--sr-border)] bg-[var(--sr-surface)] p-3 sm:p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SpecialRoomPicker
              rooms={board.rooms}
              value={selectedRoom}
              onChange={setRoomId}
              panelId="public-room-week"
            />
            <div className="flex w-full flex-nowrap items-center gap-1.5 sm:w-auto">
              <span className="mr-auto inline-flex min-w-0 flex-1 items-center gap-1 text-[11px] font-bold sm:text-sm">
                <CalendarDays className="h-4 w-4" />
                {formatWeekRange(mondayKey, board.includeSaturday)}
              </span>
              <button
                type="button"
                onClick={() => setMondayKey(shiftWeek(mondayKey, -1))}
                aria-label="지난 주"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setMondayKey(mondayOf(toDateKey(new Date())))}
                className="min-h-[44px] rounded-lg border px-3 text-xs font-bold"
              >
                이번 주
              </button>
              <button
                type="button"
                onClick={() => setMondayKey(shiftWeek(mondayKey, 1))}
                aria-label="다음 주"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-bold">
              날짜로 이동
              <input
                type="date"
                aria-label="예약 날짜로 이동"
                value={mondayKey}
                onChange={(e) => {
                  if (e.target.value) setMondayKey(mondayOf(e.target.value));
                }}
                className="min-h-[44px] rounded-lg border bg-white px-2 text-xs text-[#24312C]"
              />
            </label>
            <button
              type="button"
              disabled={!current || scope.loading || Boolean(scope.error)}
              onClick={() => window.print()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-xs font-bold"
            >
              <Printer className="h-4 w-4" />
              주간표 인쇄
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--sr-text-muted)]">
            <p aria-live="polite">
              {scope.checkedAt ? '확인 ' + scope.checkedAt : ''}
              {scope.connection === 'SUBSCRIBED' ? ' · 실시간 연결됨' : ''}
            </p>
            <p
              aria-live="polite"
              className="inline-flex items-center gap-1.5 font-bold"
            >
              {savingCell ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : saveState === '저장됨' ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {saveState}
            </p>
            <button
              type="button"
              onClick={scope.refresh}
              className="min-h-[44px] px-2 font-bold"
            >
              새로 확인
            </button>
          </div>
        </section>
        {scope.error ? (
          <div
            role="alert"
            className="mx-auto mt-2 flex max-w-[1040px] items-center gap-2 rounded-lg bg-[#FEF2F2] p-3 text-sm font-semibold text-[#B42318]"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{scope.error}</p>
            <button
              type="button"
              onClick={scope.refresh}
              className="ml-auto min-h-[44px] shrink-0 rounded-lg border px-3"
            >
              다시 시도
            </button>
          </div>
        ) : null}
        <div
          id="public-room-week"
          role={
            board.rooms.length <= 8 && board.rooms.length > 1
              ? 'tabpanel'
              : undefined
          }
          aria-labelledby={
            board.rooms.length <= 8 && board.rooms.length > 1
              ? `public-room-week-tab-${selectedRoom}`
              : undefined
          }
          className="mt-2"
        >
          {!current || scope.loading ? (
            <p
              role="status"
              className="py-16 text-center text-sm font-semibold"
            >
              선택한 주간을 불러오는 중입니다.
            </p>
          ) : selectedRoom ? (
            <SpecialRoomWeekGrid
              mondayKey={mondayKey}
              roomId={selectedRoom}
              roomName={board.rooms.find((r) => r.id === selectedRoom)?.name}
              periodCount={board.periodCount}
              includeSaturday={board.includeSaturday}
              termEndDate={board.termEndDate}
              closures={board.closures}
              bookings={board.bookings}
              schoolDays={board.schoolDays}
              readOnly={!writable}
              savingCell={savingCell}
              onSave={(date, period, label, expected, operationId) =>
                run(date, period, label, expected, operationId)
              }
              onClear={(date, period, expected, operationId) =>
                run(date, period, '', expected, operationId)
              }
              onRepeat={async (date, period, label, until) => {
                const key = [
                  token,
                  selectedRoom,
                  date,
                  period,
                  label,
                  until,
                ].join('|');
                if (repeatOperation.current?.key !== key) {
                  repeatOperation.current = { key, id: crypto.randomUUID() };
                }
                const result = await service.setRepeat(
                  token,
                  acceptedPassword,
                  selectedRoom,
                  date,
                  period,
                  label,
                  until,
                  repeatOperation.current.id,
                );
                const version = result.scopes.find(
                  (s) => s.weekStart === mondayKey,
                );
                if (version) {
                  scope.applyEvents({
                    roomId: selectedRoom,
                    weekStart: mondayKey,
                    scopeRevision: version.scopeRevision,
                    upserts: result.bookings.filter(
                      (b) =>
                        b.date >= mondayKey &&
                        b.date <= shiftWeek(mondayKey, 1),
                    ),
                    deletedIds: [],
                  });
                }
                return result;
              }}
            />
          ) : (
            <p className="py-16 text-center">등록된 특별실이 없습니다.</p>
          )}
        </div>
      </main>
      {current && !scope.loading && !scope.error ? (
        <SpecialRoomPrint
          board={board}
          roomId={selectedRoom}
          mondayKey={mondayKey}
        />
      ) : null}
    </>
  );
}
