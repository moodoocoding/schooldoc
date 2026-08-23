import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, DoorOpen } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { SpecialRoomWeekGrid } from './SpecialRoomWeekGrid';
import { isSpecialRoomsDemoMode } from './specialRoomsConfig';
import * as remote from './specialRoomsRepository';
import * as service from './specialRoomsService';
import * as store from './specialRoomsStore';
import { addDays, bookingKey, formatWeekRange, mondayOf, shiftWeek, toDateKey } from './specialRoomWeek';
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

  const load = useMemo(() => async () => {
    try {
      if (isSpecialRoomsDemoMode) {
        const found = store.getBoardByToken(token);
        if (!found) setError('예약표를 찾을 수 없습니다.');
        setBoard(found);
        return;
      }
      // 원격은 예약표 정보와 주간 자료를 따로 받는다. 한 주 것만 받아야 가볍다.
      const meta = await remote.getRemotePublicBoard(token, password);
      const week = unlocked || !meta.isPasswordProtected
        // 방금 받은 meta를 본다. board는 아직 이전 주 것이거나 비어 있다.
        ? await remote.readRemoteWeek(token, password, mondayKey, addDays(mondayKey, meta.includeSaturday ? 5 : 4))
        : { bookings: [], schoolDays: [] };
      setBoard({ ...meta, bookings: week.bookings, schoolDays: week.schoolDays, createdAt: '', updatedAt: '' });
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '예약표를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, password, unlocked, mondayKey]);

  useEffect(() => {
    void load();
    return service.subscribeSpecialRooms(() => void load());
  }, [load]);

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

  const run = async (cellKey: string, work: () => Promise<void>) => {
    if (savingCell) return;
    setSavingCell(cellKey);
    setActionError('');
    try {
      await work();
      await load();
    } catch (workError) {
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
            roomName={board.rooms.find((room) => room.id === roomId)?.name}
            bookings={board.bookings}
            schoolDays={board.schoolDays}
            readOnly={closed}
            savingCell={savingCell}
            onSave={(date, period, label) => void run(bookingKey(date, period), () => (
              service.setBooking(token, password, roomId, date, period as Period, label)
            ))}
            onClear={(date, period) => void run(bookingKey(date, period), () => (
              service.clearBooking(token, password, roomId, date, period as Period)
            ))}
          />
        ) : (
          <p className="py-16 text-center text-sm text-[#64748B]">등록된 특별실이 없습니다.</p>
        )}
      </div>

    </main>
  );
}
