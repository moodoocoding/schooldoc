import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CalendarSync, Check, CircleDot, CircleSlash, Copy, ExternalLink, Eye, ImageDown, LoaderCircle, QrCode, School } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { qrImageFileName, saveQrImage } from '../../utils/qrImage';
import { SpecialRoomWeekGrid } from './SpecialRoomWeekGrid';
import { getSpecialRoomsPublicOrigin, isSpecialRoomsDemoMode } from './specialRoomsConfig';
import * as service from './specialRoomsService';
import { BoardInfoCard } from './BoardInfoCard';
import { SchoolPicker } from './SchoolPicker';
import { formatWeekRange, mondayOf, shiftWeek, toDateKey, weekDates } from './specialRoomWeek';
import type { SchoolDaysOutcome } from './specialRoomsSchoolDays';
import type { SpecialRoomBoard } from './types';

export function SpecialRoomsManagePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { boardId = '' } = useParams();
  const { user } = useTeacherAuth();
  const ownerId = user?.id ?? (isSpecialRoomsDemoMode ? 'local-demo-teacher' : '');
  const [board, setBoard] = useState<SpecialRoomBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomId, setRoomId] = useState('');
  const [mondayKey, setMondayKey] = useState(() => mondayOf(toDateKey(new Date())));
  const [copied, setCopied] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const [qrError, setQrError] = useState('');
  const qrRef = useRef<HTMLDivElement>(null);
  const [schoolBusy, setSchoolBusy] = useState('');
  // 만들면서 학사일정까지 받아 왔다면 그 결과를 여기서 이어 보여 준다.
  const handoff = location.state as { schoolNotice?: string; schoolError?: string } | null;
  const [schoolError, setSchoolError] = useState(handoff?.schoolError ?? '');
  const [schoolNotice, setSchoolNotice] = useState(handoff?.schoolNotice ?? '');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!ownerId) { setBoard(null); setLoading(false); return; }
      try {
        const next = await service.getBoard(ownerId, boardId);
        if (active) setBoard(next);
      } catch {
        if (active) setBoard(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const stop = service.subscribeSpecialRooms(() => void load());
    return () => { active = false; stop(); };
  }, [ownerId, boardId]);

  useEffect(() => {
    if (board && !roomId && board.rooms.length > 0) setRoomId(board.rooms[0].id);
  }, [board, roomId]);

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#526174]">불러오는 중입니다.</div>;
  if (!board) {
    return (
      <div className="py-20 text-center">
        <p className="font-bold">예약판을 찾을 수 없습니다.</p>
        <button type="button" onClick={() => navigate('/tools/special-rooms')} className="mt-4 text-sm font-bold text-[#0F6CBD]">목록으로</button>
      </div>
    );
  }

  const publicLink = `${getSpecialRoomsPublicOrigin()}/s/rooms/${board.publicToken}`;

  const downloadQrImage = async () => {
    if (savingQr) return;
    setSavingQr(true);
    setQrError('');
    try {
      await saveQrImage(qrRef.current, qrImageFileName(board.title, '예약QR', '특별실 예약'));
    } catch (error) {
      setQrError(error instanceof Error ? error.message : 'QR 이미지를 저장하지 못했습니다.');
    } finally {
      setSavingQr(false);
    }
  };

  /**
   * NEIS는 곁들이는 기능이다. 실패해도 예약은 그대로 되어야 하므로 이 영역 안에서만 알린다.
   * 연결과 일정 받기의 순서·실패 처리는 `specialRoomsSchoolDays`가 정한다.
   */
  const runSchool = async (key: string, work: () => Promise<SchoolDaysOutcome>) => {
    if (schoolBusy) return;
    setSchoolBusy(key);
    setSchoolError('');
    setSchoolNotice('');
    try {
      const outcome = await work();
      setSchoolNotice(outcome.notice);
      setSchoolError(outcome.error);
    } finally {
      setSchoolBusy('');
    }
  };

  const thisMonday = mondayOf(toDateKey(new Date()));
  const isThisWeek = mondayKey === thisMonday;
  // 머리글 수치는 보는 주나 고른 특별실에 따라 흔들리면 안 된다. 늘 이번 주 전체를 센다.
  const thisWeekDates = weekDates(thisMonday);
  const thisWeekBookings = board.bookings.filter((booking) => (
    thisWeekDates.includes(booking.bookingDate)
  )).length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-12">
      {/*
        담당자가 이 화면에 오는 이유는 대개 이번 주 예약 현황을 보는 것이다. QR과 학사일정은
        처음 한 번 쓰고 만다. 그래서 표를 첫 자리에 두고 설정은 옆 단으로 내린다.
      */}
      <header className="border-b border-[#DCE3EA] pb-4">
        <button type="button" onClick={() => navigate('/tools/special-rooms')} className="-ml-2 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:text-[#0F6CBD]">
          <ArrowLeft className="h-5 w-5" />목록으로
        </button>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-[#0F172A] sm:text-2xl">{board.title}</h1>
              {/* 상태는 색만으로 알리지 않는다. 흑백으로 봐도 글자로 구분된다. */}
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${board.status === 'open' ? 'bg-[#E7F3EA] text-[#166534]' : 'bg-[#EEF1F4] text-[#526174]'}`}>
                {board.status === 'open' ? <CircleDot className="h-3.5 w-3.5" /> : <CircleSlash className="h-3.5 w-3.5" />}
                {board.status === 'open' ? '예약 받는 중' : '예약 종료됨'}
              </span>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#526174]">
              <span className="font-semibold text-[#334155]">특별실 {board.rooms.length}곳</span>
              <span aria-hidden="true">·</span>
              <span>이번 주 예약 {thisWeekBookings}건</span>
              {board.schoolName ? (<><span aria-hidden="true">·</span><span>{board.schoolName}</span></>) : null}
            </p>
          </div>
          <button type="button" onClick={() => { if (ownerId) void service.setBoardStatus(ownerId, board.id, board.status === 'open' ? 'closed' : 'open'); }} className="min-h-[40px] shrink-0 rounded-lg border border-[#C8D0DA] bg-white px-4 text-xs font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD]">
            {board.status === 'open' ? '예약 종료' : '예약 다시 열기'}
          </button>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* 매일 보는 것 */}
        <section className="min-w-0 rounded-lg border border-[#DCE3EA] bg-white px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#0F172A]">
                예약 현황 · {formatWeekRange(mondayKey)}
                {isThisWeek ? <span className="ml-2 rounded bg-[#EFF6FC] px-1.5 py-0.5 align-middle text-[11px] font-bold text-[#0F6CBD]">이번 주</span> : null}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setMondayKey(shiftWeek(mondayKey, -1))} aria-label="지난 주 보기" className="min-h-[40px] rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD]">지난 주</button>
              <button type="button" disabled={isThisWeek} onClick={() => setMondayKey(thisMonday)} aria-label="이번 주로 돌아가기" className="min-h-[40px] rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD] disabled:border-[#EEF1F4] disabled:bg-[#F6F8FB] disabled:text-[#94A3B8]">이번 주</button>
              <button type="button" onClick={() => setMondayKey(shiftWeek(mondayKey, 1))} aria-label="다음 주 보기" className="min-h-[40px] rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD]">다음 주</button>
            </div>
          </div>

          {board.rooms.length > 1 ? (
            <div role="tablist" aria-label="특별실 선택" className="mt-4 flex flex-wrap gap-2">
              {board.rooms.map((room) => (
                <button key={room.id} type="button" role="tab" aria-selected={roomId === room.id} onClick={() => setRoomId(room.id)} className={`min-h-[40px] rounded-lg border px-4 text-sm font-bold ${roomId === room.id ? 'border-[#0F6CBD] bg-[#0F6CBD] text-white' : 'border-[#C8D0DA] bg-white text-[#334155] hover:border-[#0F6CBD]'}`}>
                  {room.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4">
            {roomId ? (
              <SpecialRoomWeekGrid mondayKey={mondayKey} roomId={roomId} bookings={board.bookings} schoolDays={board.schoolDays} readOnly />
            ) : (
              <p className="py-12 text-center text-sm text-[#64748B]">등록된 특별실이 없습니다.</p>
            )}
          </div>

          {/* 왜 여기서는 못 고치는지 말해 준다. 말하지 않으면 고장으로 읽힌다. */}
          {roomId ? (
            <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#64748B]">
              <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              여기서는 보기만 합니다. 예약을 넣거나 고치려면 아래 예약 링크로 들어갑니다.
            </p>
          ) : null}
        </section>

        {/* 처음 한 번 쓰는 것 */}
        <div className="min-w-0 space-y-5">
          <section className="rounded-lg border border-[#DCE3EA] bg-white px-4 py-5 sm:px-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-[#0F172A]">
              <QrCode className="h-4 w-4 text-[#0F6CBD]" />예약 링크
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#526174]">교직원에게 링크나 QR을 보내면 가입 없이 시간표에서 바로 잡습니다.</p>

            <div className="mt-4 flex gap-2">
              <input readOnly value={publicLink} aria-label="예약 링크 주소" className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[#C8D0DA] bg-[#F6F8FB] px-3 text-xs text-[#334155]" />
              <button type="button" onClick={() => { void navigator.clipboard.writeText(publicLink); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }} aria-label="예약 링크 복사" title="링크 복사" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#C8D0DA] text-[#0F6CBD] hover:bg-[#EFF6FC]">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
              <a href={publicLink} target="_blank" rel="noreferrer" aria-label="예약 화면 열기" title="새 창에서 열기" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#C8D0DA] text-[#0F6CBD] hover:bg-[#EFF6FC]">
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div ref={qrRef} className="flex shrink-0 items-center justify-center rounded-lg bg-white p-2 ring-1 ring-[#DCE3EA]">
                <QRCodeSVG value={publicLink} size={104} level="M" includeMargin aria-label="예약 QR 코드" />
              </div>
              <div className="min-w-0">
                <button type="button" disabled={savingQr} onClick={() => void downloadQrImage()} className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD] hover:bg-[#EFF6FC] disabled:border-[#C8D0DA] disabled:text-[#94A3B8]">
                  {savingQr ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
                  {savingQr ? '저장 중' : 'QR 이미지 저장'}
                </button>
                <p className="mt-2 text-[11px] leading-4 text-[#64748B]">공문이나 안내문에 붙일 수 있습니다.</p>
                {qrError ? <p role="alert" className="mt-1 text-[11px] font-semibold text-[#B42318]">{qrError}</p> : null}
              </div>
            </div>
          </section>

          <BoardInfoCard
            board={board}
            onSave={(info) => service.updateBoardInfo(ownerId, board.id, info)}
          />

          <section className="rounded-lg border border-[#DCE3EA] bg-white px-4 py-5 sm:px-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-[#0F172A]">
              <School className="h-4 w-4 text-[#0F6CBD]" />학사일정
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">
              학교를 고르면 공휴일과 재량휴업일을 바로 받아 표에 표시합니다. 연결하지 않아도 예약은 그대로 됩니다.
            </p>

            <div className="mt-3 grid gap-2">
              <SchoolPicker
                value={board.schoolName ? { name: board.schoolName, officeCode: '', schoolCode: '' } : null}
                onChange={(school) => void runSchool('link', () => (
                  school
                    ? service.linkSchoolAndSyncDays(board.id, school, mondayKey)
                    : service.unlinkSchool(board.id)
                ))}
              />
              {board.schoolName ? (
                <button
                  type="button"
                  disabled={schoolBusy !== ''}
                  onClick={() => void runSchool('sync', () => service.syncSchoolDays(board.id, mondayKey))}
                  className="inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-md px-1.5 text-xs font-bold text-[#0F6CBD] hover:underline disabled:text-[#94A3B8]"
                >
                  {schoolBusy === 'sync' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CalendarSync className="h-3.5 w-3.5" />}
                  {schoolBusy === 'sync' ? '받는 중' : '학사일정 다시 받기'}
                </button>
              ) : null}
            </div>

            {schoolError ? (
              <p role="alert" className="mt-3 flex items-start gap-1.5 rounded-md bg-[#FEF2F2] px-2.5 py-2 text-xs font-semibold leading-5 text-[#B42318]">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{schoolError}
              </p>
            ) : null}
            {schoolNotice ? (
              <p role="status" aria-live="polite" className="mt-3 flex items-start gap-1.5 rounded-md bg-[#E7F3EA] px-2.5 py-2 text-xs font-semibold leading-5 text-[#166534]">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />{schoolNotice}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
