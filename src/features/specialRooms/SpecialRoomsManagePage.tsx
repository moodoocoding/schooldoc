import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CalendarSync, Check, Copy, ExternalLink, ImageDown, LoaderCircle, QrCode, School } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { qrImageFileName, saveQrImage } from '../../utils/qrImage';
import { SpecialRoomWeekGrid } from './SpecialRoomWeekGrid';
import { getSpecialRoomsPublicOrigin, isSpecialRoomsDemoMode } from './specialRoomsConfig';
import * as service from './specialRoomsService';
import { SchoolPicker } from './SchoolPicker';
import { addDays, formatWeekRange, mondayOf, shiftWeek, toDateKey } from './specialRoomWeek';
import type { SpecialRoomBoard } from './types';

export function SpecialRoomsManagePage() {
  const navigate = useNavigate();
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
  const [schoolError, setSchoolError] = useState('');
  const [schoolNotice, setSchoolNotice] = useState('');

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
   */
  const runSchool = async (key: string, work: () => Promise<string>) => {
    if (schoolBusy) return;
    setSchoolBusy(key);
    setSchoolError('');
    setSchoolNotice('');
    try {
      setSchoolNotice(await work());
    } catch (error) {
      setSchoolError(error instanceof Error ? error.message : '학사일정을 가져오지 못했습니다.');
    } finally {
      setSchoolBusy('');
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <header className="border-b border-[#DCE3EA] pb-5">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => navigate('/tools/special-rooms')} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:text-[#0F6CBD]">
            <ArrowLeft className="h-5 w-5" />목록으로
          </button>
          <button type="button" onClick={() => { if (ownerId) void service.setBoardStatus(ownerId, board.id, board.status === 'open' ? 'closed' : 'open'); }} className="min-h-[40px] shrink-0 rounded-lg border border-[#C8D0DA] bg-white px-4 text-xs font-bold">
            {board.status === 'open' ? '예약 종료' : '예약 다시 열기'}
          </button>
        </div>
        <h1 className="mt-4 text-xl font-extrabold text-[#0F172A] sm:text-2xl">{board.title}</h1>
      </header>

      <section className="grid gap-6 border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-6 md:grid-cols-[230px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <div ref={qrRef} className="flex items-center justify-center rounded-lg bg-white p-3 ring-1 ring-[#DCE3EA]">
            <QRCodeSVG value={publicLink} size={190} level="M" includeMargin aria-label="예약 QR 코드" />
          </div>
          <button type="button" disabled={savingQr} onClick={() => void downloadQrImage()} className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD] hover:bg-[#EFF6FC] disabled:border-[#C8D0DA] disabled:text-[#94A3B8]">
            {savingQr ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
            {savingQr ? '저장 중' : 'QR 이미지 저장'}
          </button>
          {qrError ? <p role="alert" className="text-[11px] font-semibold text-[#B42318]">{qrError}</p> : null}
        </div>
        <div className="min-w-0 self-center">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#0F172A]"><QrCode className="h-5 w-5 text-[#0F6CBD]" />예약 링크</h2>
          <p className="mt-1 text-sm text-[#526174]">교직원에게 링크나 QR을 보내면 가입 없이 시간표에서 바로 잡습니다.</p>
          <div className="mt-4 flex gap-2">
            <input readOnly value={publicLink} aria-label="예약 링크 주소" className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[#C8D0DA] bg-[#F6F8FB] px-3 text-xs text-[#334155]" />
            <button type="button" onClick={() => { void navigator.clipboard.writeText(publicLink); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }} aria-label="예약 링크 복사" title="링크 복사" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#C8D0DA] text-[#0F6CBD]">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
            <a href={publicLink} target="_blank" rel="noreferrer" aria-label="예약 화면 열기" title="새 창에서 열기" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#C8D0DA] text-[#0F6CBD]">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2">
          <School className="h-5 w-5 text-[#0F6CBD]" />
          <h2 className="font-bold">학사일정</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-[#64748B]">
          학교를 연결하면 공휴일과 재량휴업일이 표에 표시됩니다. 연결하지 않아도 예약은 그대로 됩니다.
        </p>
        {board.schoolName ? (
          <p className="mt-3 text-sm font-bold text-[#0F172A]">연결된 학교: {board.schoolName}</p>
        ) : null}

        <div className="mt-3 grid gap-2 sm:max-w-md">
          <SchoolPicker
            value={board.schoolName ? { name: board.schoolName, officeCode: '', schoolCode: '' } : null}
            onChange={(school) => void runSchool('link', async () => {
              if (!school) {
                await service.linkSchool(board.id, { name: '', officeCode: '', schoolCode: '', kind: '', address: '' });
                return '학교 연결을 지웠습니다.';
              }
              await service.linkSchool(board.id, { ...school, kind: '', address: '' });
              return `${school.name}을(를) 연결했습니다. 이제 학사일정을 받아 주세요.`;
            })}
          />
          <button
            type="button"
            disabled={schoolBusy !== '' || !board.schoolName}
            onClick={() => void runSchool('sync', async () => {
              // 이번 주부터 한 학기 남짓을 받아 둔다. 화면을 열 때마다 부르지 않기 위해서다.
              const count = await service.syncSchoolDays(board.id, mondayKey, addDays(mondayKey, 180));
              return `학사일정 ${count}건을 받았습니다.`;
            })}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-4 text-xs font-bold text-white disabled:bg-[#AAB7C4]"
          >
            {schoolBusy === 'sync' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CalendarSync className="h-4 w-4" />}
            {schoolBusy === 'sync' ? '받는 중' : '학사일정 받기'}
          </button>
        </div>

        {schoolError ? <p role="alert" className="mt-3 text-xs font-semibold text-[#B42318]"><AlertCircle className="mr-1 inline h-3.5 w-3.5" />{schoolError}</p> : null}
        {schoolNotice ? <p role="status" aria-live="polite" className="mt-3 text-xs font-semibold text-[#0F6CBD]">{schoolNotice}</p> : null}
      </section>

      <section className="border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">예약 현황 · {formatWeekRange(mondayKey)}</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMondayKey(shiftWeek(mondayKey, -1))} className="min-h-[40px] rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold">지난 주</button>
            <button type="button" onClick={() => setMondayKey(mondayOf(toDateKey(new Date())))} className="min-h-[40px] rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold">이번 주</button>
            <button type="button" onClick={() => setMondayKey(shiftWeek(mondayKey, 1))} className="min-h-[40px] rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold">다음 주</button>
          </div>
        </div>
        {board.rooms.length > 1 ? (
          <div role="tablist" aria-label="특별실 선택" className="mt-4 flex flex-wrap gap-2">
            {board.rooms.map((room) => (
              <button key={room.id} type="button" role="tab" aria-selected={roomId === room.id} onClick={() => setRoomId(room.id)} className={`min-h-[40px] rounded-lg border px-4 text-sm font-bold ${roomId === room.id ? 'border-[#0F6CBD] bg-[#0F6CBD] text-white' : 'border-[#C8D0DA] bg-white text-[#334155]'}`}>
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
      </section>
    </div>
  );
}
