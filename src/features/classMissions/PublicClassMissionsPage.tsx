import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Clock3, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { markPublicMission, missionCanReport, missionToday, viewPublicMission, type PublicMission, type PublicMissionView } from './missionApi';

const button = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0F6CBD] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#0B5B9F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD] disabled:cursor-not-allowed disabled:opacity-50';
const softButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD] disabled:cursor-not-allowed disabled:opacity-50';

function MissionCard({ mission, busy, onMark }: { mission: PublicMission; busy: boolean; onMark: (missionId: string, status: 'reported' | 'unmarked') => void }) {
  const today = missionToday();
  const canReport = missionCanReport(mission, today);
  const isDone = mission.check === 'reported' || mission.check === 'pending' || mission.check === 'confirmed';
  const state = mission.check === 'confirmed' ? '교사 확인' : mission.check === 'pending' ? '확인 기다리는 중'
    : mission.check === 'reported' ? '완료 표시' : mission.check === 'exempt' ? '해당 없음'
      : mission.status === 'closed' ? '종료' : today > mission.dueDate ? '마감 지남' : today < mission.startDate ? '시작 전' : '해야 할 일';
  return <article className={`rounded-2xl border p-5 shadow-sm ${isDone ? 'border-[#B7D7C5] bg-[#F7FCF8]' : 'border-[#DCE3EA] bg-white'}`}>
    <div className="flex items-start gap-3"><span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDone ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EFF6FC] text-[#0F6CBD]'}`}>{isDone ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <Circle className="h-6 w-6" aria-hidden="true" />}</span><div className="min-w-0 flex-1"><p className="text-xs font-extrabold text-[#526174]">{state}</p><h2 className="mt-1 break-words text-lg font-extrabold text-[#0F172A]">{mission.title}</h2></div></div>
    {mission.description ? <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-[#334155]">{mission.description}</p> : null}
    <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#526174]"><Clock3 className="h-4 w-4" aria-hidden="true" />{mission.startDate} ~ {mission.dueDate}</p>
    {mission.checkedAt ? <p className="mt-1 text-xs text-[#526174]">마지막 변경: {new Date(mission.checkedAt).toLocaleString('ko-KR')}</p> : null}
    {canReport && mission.check === 'unmarked' ? <button type="button" className={`${button} mt-5 w-full`} disabled={busy} onClick={() => onMark(mission.id, 'reported')}><CheckCircle2 className="h-5 w-5" aria-hidden="true" />완료했어요</button> : null}
    {canReport && (mission.check === 'reported' || mission.check === 'pending') ? <button type="button" className={`${softButton} mt-5 w-full`} disabled={busy} onClick={() => onMark(mission.id, 'unmarked')}>완료 표시 취소</button> : null}
    {mission.check === 'pending' ? <p className="mt-3 text-xs leading-5 text-[#73510E]">완료 표시가 저장됐습니다. 선생님의 확인을 기다리고 있어요.</p> : null}
    {mission.check === 'confirmed' ? <p className="mt-3 text-xs leading-5 text-[#126B32]">선생님이 확인했습니다. 수정이 필요하면 선생님께 말씀해 주세요.</p> : null}
    {!canReport && mission.check === 'unmarked' ? <p className="mt-3 text-xs leading-5 text-[#526174]">이 미션은 현재 완료 표시를 받을 수 없습니다.</p> : null}
  </article>;
}

export function PublicClassMissionsPage() {
  const { token = '' } = useParams();
  return <StudentMissions key={token} token={token} />;
}

function StudentMissions({ token }: { token: string }) {
  const [codeEntry, setCodeEntry] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [studentNameInput, setStudentNameInput] = useState('');
  const [studentName, setStudentName] = useState('');
  const [view, setView] = useState<PublicMissionView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const connected = Boolean(view);
  useEffect(() => () => { generation.current += 1; }, []);
  useEffect(() => { if (connected) headingRef.current?.focus(); else inputRef.current?.focus(); }, [connected]);
  const enter = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    const trimmed = studentNameInput.trim();
    if (!trimmed) return;
    const request = ++generation.current; inFlight.current = true;
    setBusy(true); setError(''); setMessage('');
    try { const loaded = await viewPublicMission(token, trimmed);
      if (request !== generation.current) return;
      setStudentName(trimmed); setView(loaded); setStudentNameInput(''); }
    catch (cause) { if (request === generation.current) setError(cause instanceof Error ? cause.message : '접속하지 못했습니다.'); }
    finally { if (request === generation.current) { inFlight.current = false; setBusy(false); } }
  };
  const leave = () => { generation.current += 1; inFlight.current = false; setBusy(false); setCodeEntry(false); setStudentName(''); setStudentNameInput(''); setView(null); setError(''); setMessage(''); };
  const refresh = async () => {
    if (inFlight.current || !studentName) return;
    const request = ++generation.current; inFlight.current = true;
    setBusy(true); setError('');
    try { const loaded = await viewPublicMission(token, studentName); if (request === generation.current) setView(loaded); }
    catch (cause) { if (request === generation.current) setError(cause instanceof Error ? cause.message : '새로고침하지 못했습니다.'); }
    finally { if (request === generation.current) { inFlight.current = false; setBusy(false); } }
  };
  const mark = async (missionId: string, status: 'reported' | 'unmarked') => {
    if (inFlight.current || !studentName) return;
    const request = ++generation.current; inFlight.current = true;
    setBusy(true); setError(''); setMessage('');
    try { const updated = await markPublicMission(token, studentName, missionId, status); if (request !== generation.current) return; setView(updated); setMessage(status === 'unmarked' ? '완료 표시를 취소했습니다.' : '완료 표시를 저장했습니다.'); }
    catch (cause) { if (request === generation.current) setError(cause instanceof Error ? cause.message : '저장하지 못했습니다. 다시 시도해 주세요.'); }
    finally { if (request === generation.current) { inFlight.current = false; setBusy(false); } }
  };
  const relevant = view?.missions.filter((mission) => mission.check !== 'exempt') ?? [];
  const exempt = view?.missions.filter((mission) => mission.check === 'exempt') ?? [];
  const current = relevant.filter((mission) => missionCanReport(mission));
  const actionable = current.filter((mission) => mission.check === 'unmarked').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const marked = current.filter((mission) => mission.check !== 'unmarked');
  const history = relevant.filter((mission) => !missionCanReport(mission)).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const completed = relevant.filter((mission) => mission.check === 'reported' || mission.check === 'pending' || mission.check === 'confirmed').length;
  return <main className="min-h-screen bg-[#F4F8FC] px-4 py-7 text-[#0F172A] sm:py-12"><div className="mx-auto max-w-xl space-y-5">
    <header className="text-center"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F6CBD] text-white"><CheckCircle2 className="h-7 w-7" aria-hidden="true" /></span><p className="mt-3 text-xs font-extrabold tracking-wide text-[#0F6CBD]">SCHOOLDOC · 학급 미션</p><h1 ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-extrabold">{view ? `${view.studentName}의 미션` : '내 미션 확인하기'}</h1><p className="mt-2 text-sm text-[#526174]">{view ? view.className : codeEntry ? '선생님께 받은 개인 코드를 입력해 주세요.' : '등록된 학생 이름을 입력해 주세요.'}</p></header>
    {error ? <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm font-semibold text-[#B42318]">{error}</p> : null}
    {message ? <p role="status" className="rounded-xl border border-[#BBE7C7] bg-[#E6F4EA] p-4 text-sm font-semibold text-[#126B32]">{message}</p> : null}
    {!view ? <form onSubmit={(event) => void enter(event)} className="rounded-2xl border border-[#DCE3EA] bg-white p-5 shadow-sm sm:p-7"><label className="block text-sm font-bold" htmlFor="mission-student-name">{codeEntry ? '개인 접속 코드' : '학생 이름'}</label><input ref={inputRef} id="mission-student-name" className="mt-2 min-h-12 w-full rounded-xl border border-[#CBD5E1] px-4 text-lg focus:border-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]" autoComplete="off" spellCheck={false} maxLength={30} value={studentNameInput} onChange={(event) => setStudentNameInput(event.target.value)} placeholder={codeEntry ? '선생님께 받은 12자리 코드' : '이름을 입력하세요 (예: 홍길동)'} /><p className="mt-2 text-xs leading-5 text-[#526174]">{codeEntry ? '코드는 이 기기에 저장하지 않습니다.' : '선생님이 등록한 본인 이름을 입력하세요. 같은 이름이 있으면 개인 코드를 사용하세요.'}</p><button type="button" className={`${softButton} mt-3 w-full`} disabled={busy} onClick={() => { setCodeEntry(!codeEntry); setStudentNameInput(''); setError(''); inputRef.current?.focus(); }}>{codeEntry ? '이름으로 접속' : '개인 코드로 접속'}</button><button type="submit" className={`${button} mt-5 w-full`} disabled={busy || !studentNameInput.trim()}>{busy ? '확인하는 중…' : '내 미션 보기'}</button></form> : <>
      <section className="rounded-2xl border border-[#CFE1F2] bg-[#EFF6FC] p-5" aria-label="내 완료 현황"><p className="text-sm font-bold text-[#0B5B9F]">지금 할 미션</p><strong className="mt-1 block text-3xl">{actionable.length}<span className="text-base font-semibold text-[#526174]">건</span></strong><p className="mt-2 text-sm text-[#334155]">전체 기록: 완료 표시 {completed} / {relevant.length}건</p><p className="mt-2 text-xs leading-5 text-[#526174]">완료 표시는 내가 했다고 알린 기록입니다. ‘교사 확인’은 선생님이 확인한 상태입니다.</p></section>
      <div className="flex flex-wrap justify-between gap-2"><div><h2 className="self-center text-base font-extrabold">내 미션</h2><p className="mt-1 text-xs text-[#526174]">새 미션이 추가되면 새로고침으로 확인할 수 있어요.</p></div><div className="flex gap-2"><button type="button" className={softButton} disabled={busy} onClick={() => void refresh()}><RefreshCw className="h-4 w-4" aria-hidden="true" />새로고침</button><button type="button" className={softButton} onClick={leave}><LogOut className="h-4 w-4" aria-hidden="true" />나가기</button></div></div>
      {actionable.length ? <section className="space-y-3" aria-label="지금 할 미션">{actionable.map((mission) => <MissionCard key={mission.id} mission={mission} busy={busy} onMark={(id, status) => void mark(id, status)} />)}</section> : marked.length ? null : <div className="rounded-2xl border border-[#DCE3EA] bg-white px-5 py-8 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-[#526174]" aria-hidden="true" /><p className="mt-3 font-bold">{relevant.length ? '지금 완료 표시할 미션이 없습니다.' : '아직 볼 수 있는 미션이 없습니다.'}</p><p className="mt-1 text-sm text-[#526174]">{relevant.length ? '완료 기록과 시작 전·지난 미션은 아래에서 확인하세요.' : '선생님이 미션을 발행하면 여기에 표시됩니다.'}</p></div>}
      {marked.length ? <section className="space-y-3" aria-label="완료 표시한 미션"><h2 className="text-sm font-bold">완료 표시한 미션 · {marked.length}건</h2>{marked.map((mission) => <MissionCard key={mission.id} mission={mission} busy={busy} onMark={(id, status) => void mark(id, status)} />)}</section> : null}
      {history.length ? <details className="rounded-xl border border-[#DCE3EA] bg-white p-4"><summary className="min-h-11 cursor-pointer text-sm font-bold">시작 전·지난 미션 {history.length}건</summary><div className="mt-3 space-y-3">{history.map((mission) => <MissionCard key={mission.id} mission={mission} busy={busy} onMark={(id, status) => void mark(id, status)} />)}</div></details> : null}
      {exempt.length ? <details className="rounded-xl border border-[#DCE3EA] bg-white p-4"><summary className="min-h-11 cursor-pointer text-sm font-bold">해당 없는 미션 {exempt.length}건</summary><div className="mt-3 space-y-3">{exempt.map((mission) => <MissionCard key={mission.id} mission={mission} busy={busy} onMark={(missionId, status) => void mark(missionId, status)} />)}</div></details> : null}
      <p className="text-center text-xs text-[#526174]">공용 기기라면 이용 후 ‘나가기’를 눌러 주세요.</p>
    </>}
  </div></main>;
}
