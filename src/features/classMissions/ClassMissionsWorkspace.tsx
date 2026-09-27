import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, ClipboardCopy, Copy, Download, FileSpreadsheet, Plus, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { ClassRosterImporter } from '../classroomRoles/ClassRosterImporter';
import { qrImageFileName, saveQrImage } from '../../utils/qrImage';
import { downloadMissionExcel } from './missionExportExcel';
import {
  checkFor, createMissionBoard, isMissionsDemo, listMissionBoards, missionCounts, missionPurgeCounts, missionPublicUrl, missionRetention,
  missionToday, mutateMissionBoard, parseMissionRoster, type CheckStatus, type IssuedCode,
  type Mission, type MissionBoard, type MissionInput, type MissionMutation,
} from './missionApi';

const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0F6CBD] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B5B9F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD] disabled:cursor-not-allowed disabled:opacity-50';
const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD] disabled:cursor-not-allowed disabled:opacity-50';
const inputStyle = 'min-h-11 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]';
const panel = 'rounded-2xl border border-[#DCE3EA] bg-white p-5 sm:p-6';
const statusLabel: Record<CheckStatus, string> = {
  unmarked: '표시 전', reported: '완료 표시', pending: '확인 대기', confirmed: '교사 확인', exempt: '해당 없음',
};
const statusTone: Record<CheckStatus, string> = {
  unmarked: 'bg-[#F1F5F9] text-[#475569]', reported: 'bg-[#E8F4FF] text-[#0B5B9F]',
  pending: 'bg-[#FFF3D6] text-[#8A5100]', confirmed: 'bg-[#E6F4EA] text-[#126B32]', exempt: 'bg-[#F5F3FF] text-[#6D42A0]',
};
const today = () => missionToday();
const weekLater = () => missionToday(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
const emptyInput = (board: MissionBoard): MissionInput => ({ title: '', description: '', startDate: today(), dueDate: weekLater(),
  requiresConfirmation: false, targetStudentIds: board.state.roster.map((student) => student.id), status: 'open' });
const inputFromMission = (mission: Mission): MissionInput => ({ title: mission.title, description: mission.description,
  startDate: mission.startDate, dueDate: mission.dueDate, requiresConfirmation: mission.requiresConfirmation,
  targetStudentIds: mission.targets.map((student) => student.id), status: mission.status });

function MissionEditor({ board, existing, template, busy, onCancel, onSave }: {
  board: MissionBoard; existing?: Mission; template?: Mission; busy: boolean; onCancel: () => void;
  onSave: (input: MissionInput) => Promise<void>;
}) {
  const [input, setInput] = useState<MissionInput>(() => {
    if (existing) {
      const from = inputFromMission(existing);
      return existing.status === 'draft'
        ? { ...from, targetStudentIds: from.targetStudentIds.filter((id) => board.state.roster.some((student) => student.id === id)) }
        : from;
    }
    if (!template) return emptyInput(board);
    const from = inputFromMission(template);
    return { ...from, title: `${from.title} 복사`, status: 'draft',
      startDate: from.dueDate < today() ? today() : from.startDate,
      dueDate: from.dueDate < today() ? weekLater() : from.dueDate,
      targetStudentIds: from.targetStudentIds.filter((id) => board.state.roster.some((student) => student.id === id)) };
  });
  const [preview, setPreview] = useState<MissionInput | null>(null);
  const [error, setError] = useState('');
  const locked = Boolean(existing && existing.status !== 'draft');
  const update = (patch: Partial<MissionInput>) => { setInput((current) => ({ ...current, ...patch })); setPreview(null); setError(''); };
  const beginSave = (status: 'draft' | 'open') => {
    const next = { ...input, status: locked ? existing!.status : status };
    try {
      if (!next.title.trim()) throw new Error('미션 제목을 입력해 주세요.');
      if (!next.targetStudentIds.length) throw new Error('대상 학생을 선택해 주세요.');
      if (!next.startDate || !next.dueDate || next.startDate > next.dueDate) throw new Error('시작일과 마감일을 확인해 주세요.');
      if (status === 'open' && !locked) setPreview(next);
      else void onSave(next).catch((cause) => setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.'));
    } catch (cause) { setError((cause as Error).message); }
  };
  return <section className={panel} aria-label={existing ? '미션 수정' : '새 미션 만들기'}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold">{existing ? '미션 수정' : '새 미션 만들기'}</h2><button type="button" className={secondary} onClick={onCancel}>닫기</button></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2 text-sm font-bold">미션 제목<input className={`${inputStyle} mt-1.5`} maxLength={100} value={input.title} onChange={(event) => update({ title: event.target.value })} placeholder="예: 수학 익힘책 32쪽 마치기" /></label>
      <label className="sm:col-span-2 text-sm font-bold">학생에게 보일 안내<textarea className={`${inputStyle} mt-1.5`} rows={3} maxLength={1000} value={input.description} onChange={(event) => update({ description: event.target.value })} placeholder="완료 기준을 짧고 구체적으로 적어 주세요." /></label>
      <label className="text-sm font-bold">시작일<input type="date" className={`${inputStyle} mt-1.5`} value={input.startDate} onChange={(event) => update({ startDate: event.target.value })} /></label>
      <label className="text-sm font-bold">마감일<input type="date" className={`${inputStyle} mt-1.5`} value={input.dueDate} onChange={(event) => update({ dueDate: event.target.value })} /></label>
    </div>
    <label className={`mt-4 flex min-h-11 items-center gap-3 rounded-xl border border-[#DCE3EA] p-3 text-sm ${locked ? 'opacity-60' : ''}`}>
      <input type="checkbox" className="h-5 w-5 accent-[#0F6CBD]" checked={input.requiresConfirmation} disabled={locked} onChange={(event) => update({ requiresConfirmation: event.target.checked })} />
      <span><strong>교사 확인 필요</strong><span className="ml-2 text-[#526174]">켜면 학생의 완료 표시가 ‘확인 대기’가 됩니다.</span></span>
    </label>
    <fieldset className="mt-5" disabled={locked}><legend className="text-sm font-bold">대상 학생 · {input.targetStudentIds.length}명</legend>
      {locked ? <p className="mt-1 text-xs text-[#64748B]">발행 후에는 대상과 확인 방식을 바꿀 수 없습니다.</p> : null}
      <div className="mt-2 flex flex-wrap gap-2"><button type="button" className="text-xs font-bold text-[#0F6CBD] underline" onClick={() => update({ targetStudentIds: board.state.roster.map((student) => student.id) })}>전체 선택</button><button type="button" className="text-xs font-bold text-[#0F6CBD] underline" onClick={() => update({ targetStudentIds: [] })}>선택 해제</button></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{board.state.roster.map((student) => <label key={student.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#0F6CBD]" checked={input.targetStudentIds.includes(student.id)} onChange={(event) => update({ targetStudentIds: event.target.checked ? [...input.targetStudentIds, student.id] : input.targetStudentIds.filter((id) => id !== student.id) })} />{student.number}번 {student.name}</label>)}</div>
    </fieldset>
    {error ? <p role="alert" className="mt-4 text-sm font-semibold text-[#B42318]">{error}</p> : null}
    {preview ? <div className="mt-5 rounded-xl border border-[#93C5FD] bg-[#EFF6FC] p-4" role="group" aria-label="발행 전 확인">
      <h3 className="font-bold">학생에게 발행할 내용을 확인해 주세요</h3>
      <p className="mt-2 text-sm">{preview.title} · 대상 {preview.targetStudentIds.length}명 · {preview.startDate} ~ {preview.dueDate}</p>
      <p className="mt-1 text-sm">{preview.requiresConfirmation ? '학생 표시 후 교사가 확인합니다.' : '학생 완료 표시만 받습니다.'}</p>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={primary} disabled={busy} onClick={() => void onSave(preview).catch((cause) => setError(cause instanceof Error ? cause.message : '발행하지 못했습니다.'))}>이 내용으로 발행</button><button type="button" className={secondary} onClick={() => setPreview(null)}>다시 수정</button></div>
    </div> : <div className="mt-5 flex flex-wrap gap-2">{!locked ? <button type="button" className={secondary} disabled={busy} onClick={() => beginSave('draft')}>초안 저장</button> : null}<button type="button" className={primary} disabled={busy} onClick={() => beginSave('open')}>{locked ? '수정 저장' : '발행 전 확인'}</button></div>}
  </section>;
}

export function ClassMissionsWorkspace() {
  const { user, loading: authLoading, configured, signIn } = useTeacherAuth();
  const [boards, setBoards] = useState<MissionBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState(() => new URLSearchParams(window.location.search).get('board') ?? '');
  const [selectedMissionId, setSelectedMissionId] = useState(() => new URLSearchParams(window.location.search).get('mission') ?? '');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [className, setClassName] = useState('');
  const [rosterText, setRosterText] = useState('');
  const [issuedCodes, setIssuedCodes] = useState<IssuedCode[]>([]);
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [cloneSource, setCloneSource] = useState<Mission | null>(null);
  const [statusFilter, setStatusFilter] = useState<CheckStatus | 'all'>('all');
  const [maskNames, setMaskNames] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [purgeText, setPurgeText] = useState('');
  const [purgeConfirmed, setPurgeConfirmed] = useState(false);
  const rosterDetailsRef = useRef<HTMLDetailsElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const board = boards.find((entry) => entry.id === selectedBoardId) ?? boards[0];
  const mission = board?.state.missions.find((entry) => entry.id === selectedMissionId) ?? board?.state.missions.at(-1);
  const rosterSignature = board?.state.roster.map((student) => `${student.number} ${student.name}`).join('\n') ?? '';

  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const next = await listMissionBoards();
      setBoards(next);
      setSelectedBoardId((current) => next.some((entry) => entry.id === current) ? current : next[0]?.id ?? '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '학급을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (user || isMissionsDemo) void refresh(); else if (!authLoading) setLoading(false); }, [user, authLoading]);
  useEffect(() => { setRosterText(rosterSignature); }, [board?.id, rosterSignature]);
  useEffect(() => { setIssuedCodes([]); setEditing(null); setCloneSource(null); setStatusFilter('all'); }, [board?.id]);
  useEffect(() => { setPurgeText(''); setPurgeConfirmed(false); }, [board?.id, board?.version, mission?.id]);
  const mutate = async (mutation: MissionMutation) => {
    if (!board || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await mutateMissionBoard(board, mutation);
      setBoards((current) => current.map((entry) => entry.id === board.id ? result.board : entry));
      if (result.issuedCodes.length) setIssuedCodes(result.issuedCodes);
      return result.board;
    } catch (cause) { const message = cause instanceof Error ? cause.message : '저장하지 못했습니다.'; setError(message); throw cause; }
    finally { setBusy(false); }
  };
  const createBoard = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { const created = await createMissionBoard(className); setBoards((current) => [...current, created]); setSelectedBoardId(created.id); setClassName(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '학급을 만들지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const saveRoster = async () => {
    try { parseMissionRoster(rosterText, board?.state.roster ?? []); await mutate({ action: 'saveRoster', rosterText }); rosterDetailsRef.current?.removeAttribute('open'); setNotice('학생 명단을 저장했습니다.'); }
    catch (cause) { if (!error) setError(cause instanceof Error ? cause.message : '명단을 저장하지 못했습니다.'); }
  };
  const saveMission = async (input: MissionInput) => {
    const saved = await mutate({ action: 'saveMission', missionId: editing === 'new' ? undefined : editing ?? undefined, mission: input });
    if (saved) { setSelectedMissionId(editing !== 'new' && editing ? editing : saved.state.missions.at(-1)?.id ?? ''); setEditing(null); setCloneSource(null); setNotice(input.status === 'open' ? '미션을 발행했습니다.' : '미션을 저장했습니다.'); }
  };
  const copyText = async (value: string, message: string) => {
    try { await navigator.clipboard.writeText(value); setNotice(message); }
    catch { setError('복사하지 못했습니다. 텍스트를 선택해 직접 복사해 주세요.'); }
  };
  const dateState = mission && mission.status === 'open' && mission.dueDate < today() ? '마감 지남' : null;
  const counts = board && mission ? missionCounts(board.state, mission) : null;
  const list = board && mission ? mission.targets.filter((student) => statusFilter === 'all' || (checkFor(board.state, mission.id, student.id)?.status ?? 'unmarked') === statusFilter) : [];
  const retention = mission ? missionRetention(mission) : null;
  const purgeCounts = board && mission?.status === 'closed' ? missionPurgeCounts(board.state, mission.id) : null;
  const purgeMission = async () => {
    if (!mission || !purgeCounts || !retention?.eligible || !purgeConfirmed || purgeText !== '영구 파기') return;
    try {
      const saved = await mutate({ action: 'purgeMission', missionId: mission.id,
        expectedTargetCount: purgeCounts.targetCount, expectedCheckCount: purgeCounts.checkCount,
        expectedEventCount: purgeCounts.eventCount, confirmText: '영구 파기' });
      if (saved) {
        setSelectedMissionId(saved.state.missions.at(-1)?.id ?? '');
        if (!saved.state.missions.length) setIssuedCodes([]);
        setPurgeText(''); setPurgeConfirmed(false);
        setNotice('미션과 관련 응답·이력을 파기했습니다.');
      }
    } catch { /* mutate already displays a recoverable error */ }
  };

  if (!user && !isMissionsDemo) return <div className="mx-auto max-w-xl py-20 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-[#94A3B8]" /><h1 className="mt-4 text-xl font-bold">학급 미션은 교사 로그인 후 사용할 수 있습니다</h1><button type="button" className={`${primary} mt-5`} disabled={!configured || authLoading} onClick={() => void signIn('/tools/class-missions')}>{configured ? 'Google 로그인' : '로그인 설정 필요'}</button></div>;
  return <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-16">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#DCE3EA] pb-5"><div><p className="text-xs font-bold text-[#0F6CBD]">우리 반의 작은 완료를 한눈에</p><h1 className="mt-1 text-3xl font-extrabold">학급 미션</h1><p className="mt-2 text-sm text-[#526174]">학생의 완료 표시와 교사 확인을 구분해 관리합니다.</p></div><button type="button" className={secondary} onClick={() => void refresh()} disabled={loading || busy}><RefreshCw className="h-4 w-4" />새로고침</button></header>
    {error ? <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm font-semibold text-[#B42318]">{error}</p> : null}
    {notice ? <p role="status" className="rounded-xl border border-[#BBE7C7] bg-[#E6F4EA] p-4 text-sm font-semibold text-[#126B32]">{notice}</p> : null}
    {loading ? <p role="status" className={panel}>학급을 불러오는 중…</p> : <>
      <section className={panel} aria-label="학급 선택"><div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm font-bold">학급 선택<select className={`${inputStyle} mt-1.5`} value={board?.id ?? ''} onChange={(event) => { setSelectedBoardId(event.target.value); setSelectedMissionId(''); }}><option value="" disabled>학급을 선택하세요</option>{boards.map((entry) => <option key={entry.id} value={entry.id}>{entry.state.className}</option>)}</select></label><label className="min-w-44 flex-1 text-sm font-bold">새 학급 이름<input className={`${inputStyle} mt-1.5`} maxLength={60} value={className} onChange={(event) => setClassName(event.target.value)} placeholder="예: 5학년 2반" /></label><button type="button" className={primary} disabled={busy || !className.trim()} onClick={() => void createBoard()}><Plus className="h-4 w-4" />학급 만들기</button></div></section>
      {!board ? <section className={`${panel} py-16 text-center`}><Users className="mx-auto h-10 w-10 text-[#94A3B8]" /><h2 className="mt-4 text-xl font-bold">학급부터 만들어 주세요</h2><p className="mt-2 text-sm text-[#526174]">학급을 만든 뒤 명단을 등록하고 첫 미션을 발행할 수 있습니다.</p></section> : <>
        <details ref={rosterDetailsRef} className={panel}><summary className="cursor-pointer text-lg font-extrabold"><h2 className="inline text-lg font-extrabold">학급 명단과 개인 접속 코드 · {board.state.roster.length}명</h2></summary>
          <p className="mt-3 text-sm text-[#526174]">번호와 이름을 한 줄씩 입력하세요. 새 학생의 코드는 저장 직후 한 번만 보여 줍니다. 개인별로 전달해 주세요.</p>
          <div className="mt-4"><ClassRosterImporter disabled={busy} onApply={setRosterText} onPendingChange={setImportPending} /></div>
          <label className="mt-4 block text-sm font-bold">편집 명단<textarea className={`${inputStyle} mt-1.5 font-mono`} rows={Math.min(12, Math.max(5, rosterText.split('\n').length + 1))} value={rosterText} onChange={(event) => setRosterText(event.target.value)} placeholder={'1 김하늘\n2 이바다'} /></label>
          <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" className={primary} disabled={busy || importPending} onClick={() => void saveRoster()}>학생 명단 저장</button><span className="text-xs text-[#64748B]">진행 중 미션의 대상 학생은 삭제할 수 없습니다.</span></div>
          {board.state.roster.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{board.state.roster.map((student) => <div key={student.id} className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"><span className="break-words">{student.number}번 {student.name}</span><button type="button" className="shrink-0 text-xs font-bold text-[#0F6CBD] underline" disabled={busy} onClick={() => { if (window.confirm(`${student.number}번 ${student.name}의 개인 코드를 다시 발급할까요? 이전 코드는 즉시 무효화됩니다.`)) void mutate({ action: 'reissueCode', studentId: student.id }); }}>코드 재발급</button></div>)}</div> : null}
        </details>
        {issuedCodes.length ? <section className="rounded-2xl border-2 border-[#E5A735] bg-[#FFF8E6] p-5" aria-label="이번에 발급한 개인 코드"><h2 className="font-extrabold">이번에 발급한 개인 코드 · {issuedCodes.length}명</h2><p className="mt-1 text-sm text-[#73510E]">이 목록은 화면을 떠나면 다시 볼 수 없습니다. 해당 학생에게 개별 전달하거나 필요할 때 재발급하세요.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{issuedCodes.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm"><span>{entry.number}번 {entry.name} <strong className="ml-1 font-mono tracking-wider">{entry.code}</strong></span><button type="button" className="min-h-11 shrink-0 text-xs font-bold text-[#0F6CBD]" onClick={() => void copyText(entry.code, `${entry.number}번 코드를 복사했습니다.`)}>복사</button></div>)}</div><button type="button" className={`${secondary} mt-3`} onClick={() => setIssuedCodes([])}>코드 목록 닫기</button></section> : null}
        <section className={panel} aria-label="학생 참여 링크"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-extrabold">학생 참여 링크</h2><p className="mt-1 text-sm text-[#526174]">공통 링크와 QR에는 개인 코드가 들어 있지 않습니다.</p><p className="mt-2 break-all text-sm text-[#0F6CBD]">{missionPublicUrl(board.publicToken)}</p></div><label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" className="h-5 w-5 accent-[#0F6CBD]" checked={board.publicEnabled} disabled={busy} onChange={(event) => void mutate({ action: 'setPublic', enabled: event.target.checked })} />공개 링크 사용</label></div>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => void copyText(missionPublicUrl(board.publicToken), '학생 링크를 복사했습니다.')}><ClipboardCopy className="h-4 w-4" />링크 복사</button><button type="button" className={secondary} onClick={() => void saveQrImage(qrRef.current, qrImageFileName(board.state.className, '학급미션_QR', '학급미션')).catch((cause) => setError(cause instanceof Error ? cause.message : 'QR을 저장하지 못했습니다.'))}><Download className="h-4 w-4" />QR PNG 저장</button><button type="button" className={secondary} disabled={busy} onClick={() => { if (window.confirm('학생 링크를 다시 발급할까요? 이전 QR과 링크는 사용할 수 없습니다.')) void mutate({ action: 'rotateToken' }); }}>링크 재발급</button></div><div ref={qrRef} className="mt-4 inline-block rounded-xl border border-[#E2E8F0] bg-white p-3"><QRCodeSVG value={missionPublicUrl(board.publicToken)} size={144} includeMargin title={`${board.state.className} 학급 미션 참여 QR 코드`} /></div>
        </section>
        <div className="space-y-5">
          <section className={panel} aria-label="미션 목록"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold">미션 · {board.state.missions.length}건</h2><button type="button" className={primary} disabled={!board.state.roster.length} onClick={() => { setCloneSource(null); setEditing('new'); }}><Plus className="h-4 w-4" />새 미션</button></div>
            {board.state.missions.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{[...board.state.missions].reverse().map((item) => { const itemCounts = missionCounts(board.state, item); return <button key={item.id} type="button" aria-current={item.id === mission?.id} onClick={() => { setSelectedMissionId(item.id); setEditing(null); setStatusFilter('all'); }} className={`min-h-24 w-full rounded-xl border p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD] ${item.id === mission?.id ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#E2E8F0] hover:border-[#93C5FD]'}`}><span className="flex flex-wrap items-center justify-between gap-2"><strong className="break-words text-sm">{item.title}</strong><span className="text-xs font-bold text-[#526174]">{item.status === 'draft' ? '초안' : item.status === 'closed' ? '종료' : item.dueDate < today() ? '마감 지남' : '진행 중'}</span></span><span className="mt-2 block text-xs text-[#526174]">{item.dueDate} 마감 · 완료 표시 {itemCounts.reported + itemCounts.pending + itemCounts.confirmed}/{item.targets.length - itemCounts.exempt}명{itemCounts.pending ? ` · 확인 대기 ${itemCounts.pending}명` : ''}</span></button>; })}</div> : <p className="mt-8 text-center text-sm text-[#526174]">아직 미션이 없습니다. 첫 미션을 만들어 주세요.</p>}
          </section>
          <div className="min-w-0 space-y-5">{editing ? <MissionEditor key={`${board.id}-${editing}-${cloneSource?.id ?? ''}`} board={board} existing={editing === 'new' ? undefined : board.state.missions.find((entry) => entry.id === editing)} template={cloneSource ?? undefined} busy={busy} onCancel={() => { setEditing(null); setCloneSource(null); }} onSave={saveMission} /> : mission ? <section className={panel} aria-label="미션 현황">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-[#0F6CBD]">{mission.status === 'draft' ? '초안' : mission.status === 'closed' ? '종료' : dateState ?? '진행 중'}</p><h2 className="mt-1 break-words text-xl font-extrabold">{mission.title}</h2><p className="mt-1 text-sm text-[#526174]">{mission.startDate} ~ {mission.dueDate} · 대상 {mission.targets.length}명 · {mission.requiresConfirmation ? '교사 확인 필요' : '완료 표시만 받기'}</p>{mission.description ? <p className="mt-3 whitespace-pre-wrap text-sm">{mission.description}</p> : null}</div><div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => setEditing(mission.id)}>수정</button>{mission.status === 'draft' ? <button type="button" className={primary} disabled={busy} onClick={() => setEditing(mission.id)}>발행 준비</button> : <button type="button" className={secondary} disabled={busy} onClick={() => { const next = mission.status === 'open' ? 'closed' : 'open'; if (window.confirm(next === 'closed' ? '이 미션을 종료할까요? 학생의 새 완료 표시는 중단됩니다.' : '이 미션을 다시 열까요?')) void mutate({ action: 'setMissionStatus', missionId: mission.id, status: next }); }}>{mission.status === 'open' ? '종료' : '다시 열기'}</button>}</div></div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className={secondary} onClick={() => { setCloneSource(mission); setEditing('new'); }}><Copy className="h-4 w-4" />복제해서 만들기</button>
              <button type="button" className={secondary} disabled={exporting} onClick={() => { setExporting(true); void downloadMissionExcel(board, mission).catch((cause) => setError(cause instanceof Error ? cause.message : 'Excel을 만들지 못했습니다.')).finally(() => setExporting(false)); }}><FileSpreadsheet className="h-4 w-4" />{exporting ? 'Excel 준비 중…' : 'Excel 내려받기'}</button>
              {counts?.pending ? <button type="button" className={primary} disabled={busy} onClick={() => {
                const pending = board.state.checks.filter((check) => check.missionId === mission.id && check.status === 'pending').map((check) => check.studentId);
                const names = mission.targets.filter((student) => pending.includes(student.id)).map((student) => maskNames ? `${student.number}번` : `${student.number}번 ${student.name}`).join(', ');
                if (window.confirm(`${mission.title}의 확인 대기 ${pending.length}명을 모두 교사 확인으로 바꿀까요?\n${names}`)) void mutate({ action: 'confirmPending', missionId: mission.id, expectedStudentIds: pending });
              }}><Check className="h-4 w-4" />확인 대기 {counts.pending}명 일괄 확인</button> : null}
            </div>
            {counts ? <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">{(['unmarked', 'reported', 'pending', 'confirmed'] as const).map((status) => <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)} className={`min-h-20 rounded-xl p-3 text-left ${statusTone[status]} ${statusFilter === status ? 'outline outline-2 outline-offset-2 outline-[#0F6CBD]' : ''}`}><span className="block text-xs font-bold">{statusLabel[status]}</span><strong className="mt-1 block text-2xl">{counts[status]}</strong></button>)}</div> : null}
            {counts?.exempt ? <p className="mt-3 text-xs text-[#526174]">해당 없음 {counts.exempt}명은 완료율 분모에서 제외합니다.</p> : null}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h3 className="font-extrabold">학생별 현황 · {list.length}명</h3><div className="flex flex-wrap items-center gap-3"><label className="flex min-h-11 items-center gap-2 text-xs font-bold"><input type="checkbox" className="h-4 w-4 accent-[#0F6CBD]" checked={maskNames} onChange={(event) => setMaskNames(event.target.checked)} />이름 가림</label><button type="button" className="min-h-11 text-xs font-bold text-[#0F6CBD] underline" onClick={() => setStatusFilter('all')}>전체 보기</button></div></div>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">{list.map((student) => { const check = checkFor(board.state, mission.id, student.id); const status = check?.status ?? 'unmarked'; return <div key={student.id} className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"><span className="w-8 font-semibold text-[#64748B]">{student.number}</span><span className="min-w-24 flex-1 break-words font-bold">{maskNames ? `${student.name.slice(0, 1)}○` : student.name}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone[status]}`}>{statusLabel[status]}</span>{status === 'pending' ? <button type="button" className={primary} disabled={busy} onClick={() => void mutate({ action: 'setCheck', missionId: mission.id, studentId: student.id, status: 'confirmed' })}><Check className="h-4 w-4" />확인</button> : null}<label className="text-xs text-[#526174]">정정<select aria-label={`${student.number}번 ${student.name} 상태 정정`} className="ml-1 min-h-11 rounded-lg border border-[#CBD5E1] bg-white px-2 text-xs" value={status} disabled={busy} onChange={(event) => void mutate({ action: 'setCheck', missionId: mission.id, studentId: student.id, status: event.target.value as CheckStatus })}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>; })}</div>
            {mission.status === 'closed' ? <div className="mt-7 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4" aria-label="미션 보관 및 파기">
              <h3 className="text-sm font-extrabold">보관 및 파기</h3>
              <p className="mt-1 text-sm text-[#526174]">종료 후 90일이 지나면 교사가 확인하고 영구 파기할 수 있습니다. 진행 중 미션은 파기할 수 없습니다.</p>
              {!retention ? <p className="mt-2 text-sm text-[#8A5100]">종료 시각이 기록되지 않아 파기 대상을 확정할 수 없습니다. 미션을 다시 열고 종료해 주세요.</p>
                : !retention.eligible ? <p className="mt-2 text-sm font-bold text-[#334155]">파기 가능 시각: {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(retention.eligibleAt))}</p>
                  : purgeCounts ? <div className="mt-4 space-y-3 rounded-xl border border-[#F5C2C2] bg-white p-4">
                    <p className="text-sm font-bold text-[#9F1D1D]">파기 대상: {mission.title} · 대상 학생 {purgeCounts.targetCount}명 · 현재 응답 {purgeCounts.checkCount}건 · 변경 이력 {purgeCounts.eventCount}건</p>
                    {purgeCounts.clearRoster ? <p className="text-sm text-[#9F1D1D]">마지막 미션이므로 학급 명단과 개인 코드도 비우고 기존 학생 링크를 중지합니다.</p> : null}
                    <p className="text-xs text-[#526174]">필요한 결과는 먼저 Excel로 내려받으세요. 파기 후에는 복구할 수 없습니다.</p>
                    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[#B42318]" checked={purgeConfirmed} onChange={(event) => setPurgeConfirmed(event.target.checked)} />위 대상과 수량을 확인하고 영구 파기에 동의합니다.</label>
                    <label className="block text-sm font-bold">확인 문구: 영구 파기<input className={`${inputStyle} mt-1.5`} autoComplete="off" value={purgeText} onChange={(event) => setPurgeText(event.target.value)} placeholder="영구 파기" /></label>
                    <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#B42318] px-4 py-2 text-sm font-bold text-white hover:bg-[#8F1B13] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B42318] disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !purgeConfirmed || purgeText !== '영구 파기'} onClick={() => void purgeMission()}><Trash2 className="h-4 w-4" />미션 영구 파기</button>
                  </div> : null}
            </div> : null}
          </section> : <section className={`${panel} py-20 text-center`}><h2 className="text-lg font-bold">미션을 선택하거나 새로 만들어 주세요</h2></section>}</div>
        </div>
      </>}
    </>}
  </div>;
}
