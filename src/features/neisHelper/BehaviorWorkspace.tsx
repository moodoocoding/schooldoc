import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Download, Sprout, X } from 'lucide-react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { ClassRosterImporter } from '../classroomRoles/ClassRosterImporter';
import { loadRoleBoard, parseRoleRoster } from '../classroomRoles/roleApi';
import { behaviorCounts, behaviorDuplicates, behaviorTextIssues } from '../../../supabase/functions/_shared/neisBehavior';
import type { BehaviorLength } from '../../../supabase/functions/_shared/neisBehavior';
import { applyBehaviorRow, BEHAVIOR_TRAITS, buildBehaviorInput, hasBehaviorInput, newBehaviorEntries, readBehaviorDraft, saveBehaviorDraft } from './behaviorState';
import type { BehaviorEntry } from './behaviorState';
import { generateBehavior } from './behaviorApi';
import { behaviorExportRows, exportBehavior } from './behaviorExport';
import { inputClass, primaryClass, secondaryClass } from './SubjectSteps';

const viewClass = (selected: boolean) => `inline-flex min-h-[44px] items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${selected ? 'border-[#0F6CBD] bg-[#EFF6FC] text-[#0F6CBD]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`;

export function BehaviorWorkspace() {
  const { user } = useTeacherAuth();
  const owner = user?.id ?? '';
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => readBehaviorDraft(owner));
  const [importing, setImporting] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [active, setActive] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [replaceRoster, setReplaceRoster] = useState(false);
  const request = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const progress = useRef({ done: 0, total: 0 });
  const [progressText, setProgressText] = useState('');
  const busy = running;
  const duplicates = behaviorDuplicates(draft.entries);
  const eligible = draft.entries.filter(hasBehaviorInput);
  const unfinished = eligible.filter((entry) => !entry.text || entry.error || entry.stale);
  const pendingTargets = unfinished.filter((entry) => !entry.edited);
  const duplicateTargets = draft.entries.filter((entry) => duplicates.has(entry.id) && !entry.edited && hasBehaviorInput(entry));
  const completed = draft.entries.filter((entry) => entry.text && !entry.error && !entry.stale).length;

  useEffect(() => { saveBehaviorDraft(owner, draft); }, [owner, draft]);
  useEffect(() => () => { epoch.current++; request.current?.abort(); }, []);
  useEffect(() => {
    if (!draft.entries.some((entry) => hasBehaviorInput(entry) || entry.text)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft.entries]);

  const editInput = (id: string, update: Partial<BehaviorEntry>) => setDraft((previous) => ({ ...previous, entries: previous.entries.map((entry) => entry.id === id ? { ...entry, ...update, stale: !!entry.text } : entry) }));
  const loadRoster = async () => {
    setLoadingRoster(true); setError('');
    try {
      const board = await loadRoleBoard();
      if (!board.state.roster.length) throw new Error('설정에 등록된 학생이 없습니다. 명단을 가져와 주세요.');
      setDraft((previous) => ({ ...previous, entries: newBehaviorEntries(board.state.roster) }));
    } catch (e) { setError((e as Error).message); }
    finally { setLoadingRoster(false); }
  };
  const run = async (ids: string[]) => {
    if (busy || !ids.length) return;
    const input = buildBehaviorInput(draft, ids);
    const current = ++epoch.current;
    const controller = new AbortController(); request.current = controller;
    setError(''); setNotice(''); setActive(ids); setSelected([]); setRunning(true);
    progress.current = { done: 0, total: ids.length }; setProgressText(`0 / ${ids.length}명 작성 중`);
    setDraft((previous) => ({ ...previous, results: true }));
    const received = new Set<string>();
    const needsReview = new Set<string>();
    try {
      await generateBehavior(input, controller.signal, (row) => {
        if (epoch.current !== current || controller.signal.aborted) return;
        received.add(row.id);
        if (row.error) needsReview.add(row.id);
        setDraft((previous) => ({ ...previous, entries: applyBehaviorRow(previous.entries, row) }));
        setActive((previous) => previous.filter((id) => id !== row.id));
        progress.current.done++;
        setProgressText(`${progress.current.done} / ${ids.length}명 도착`);
      });
      if (epoch.current === current) setNotice(needsReview.size ? `${needsReview.size}명은 분량·표현 확인이 필요합니다. 내용을 수정하거나 미완료 학생만 다시 작성하세요.` : '작성을 마쳤습니다. 표에서 내용을 바로 수정할 수 있습니다.');
    } catch (e) {
      if (epoch.current === current) setError(controller.signal.aborted ? '작성을 중단했습니다. 도착한 내용은 유지됩니다.' : (e as Error).message);
    } finally {
      if (epoch.current === current) {
        setDraft((previous) => ({ ...previous, entries: previous.entries.map((entry) => ids.includes(entry.id) && !received.has(entry.id) ? { ...entry, error: '요청이 완료되지 않았습니다. 기존 내용은 유지됩니다.' } : entry) }));
        setActive([]); setRunning(false); request.current = null; setProgressText(`${received.size} / ${ids.length}명 도착`);
      }
    }
  };
  const copy = async () => {
    try {
      const rows = behaviorExportRows(draft.entries);
      await navigator.clipboard.writeText(rows.map((row) => `${row.number}\t${row.name}\t${row.text}`).join('\n'));
      setNotice(`${rows.length}명의 내용을 복사했습니다.${rows.length < draft.entries.length ? ` 미완료 ${draft.entries.length - rows.length}명은 제외했습니다.` : ''}`);
    } catch (e) { setError((e as Error).message); }
  };
  return <section className="mx-auto max-w-7xl space-y-6 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
      <button type="button" className={secondaryClass} onClick={() => navigate('/tools/neis-helper')}><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Neis Helper</button>
      <span className="text-sm text-slate-600">현재 탭에서만 보관 · 새로고침하면 초기화</span>
    </div>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700"><Sprout className="h-4 w-4" aria-hidden="true" />학생 기록 작성</p><h1 className="text-2xl font-bold text-slate-900">행동특성 및 발달상황</h1><p className="mt-2 text-sm leading-6 text-slate-600">{draft.results ? '학생별 결과가 도착하는 대로 채워집니다. 완성된 내용은 바로 수정하세요.' : '학급 명단에서 특성을 고르고, 꼭 반영할 내용을 메모하세요.'}</p></div>
    </header>
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">{notice}</p>}
    {!draft.entries.length ? <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">학급 명단을 불러오세요</h2><p className="mt-2 text-sm leading-6 text-slate-600">설정에 등록한 명단이나 Excel·CSV·붙여넣기로 시작합니다.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" className={primaryClass} disabled={loadingRoster || importPending} onClick={() => void loadRoster()}>{loadingRoster ? '명단 불러오는 중…' : '설정의 학생 명단 불러오기'}</button><button type="button" className={secondaryClass} disabled={loadingRoster} onClick={() => setImporting(!importing)}>파일·붙여넣기로 가져오기</button></div>
      {importing && <div className="mt-6"><ClassRosterImporter applyHelp="이 명단으로 행동특성 작성을 시작합니다. 명단과 작성 내용은 현재 탭에서만 보관됩니다." disabled={loadingRoster} onPendingChange={setImportPending} onApply={(text) => { setDraft((previous) => ({ ...previous, entries: newBehaviorEntries(parseRoleRoster(text)) })); setImporting(false); setImportPending(false); }} /></div>}
    </div> : <>
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2" aria-label="보기 선택"><button type="button" aria-pressed={!draft.results} className={viewClass(!draft.results)} onClick={() => setDraft((previous) => ({ ...previous, results: false }))}>특성·메모</button><button type="button" aria-pressed={draft.results} className={viewClass(draft.results)} onClick={() => setDraft((previous) => ({ ...previous, results: true }))}>작성 결과</button><span className="ml-2 text-sm font-semibold text-slate-700">전체 {draft.entries.length}명</span></div>
        <div className="flex flex-wrap items-center gap-3"><label className="text-sm font-semibold"><span className="sr-only">작성 분량</span><select className={inputClass} aria-label="작성 분량" value={draft.length} disabled={busy} onChange={(event) => setDraft((previous) => ({ ...previous, length: Number(event.target.value) as BehaviorLength }))}>{[200, 300, 400].map((n) => <option key={n} value={n}>{n}자 내외</option>)}</select></label>
          {busy ? <button type="button" className={secondaryClass} onClick={() => request.current?.abort()}>작성 중단</button> : <button type="button" className={primaryClass} disabled={!pendingTargets.length} onClick={() => void run(pendingTargets.map((entry) => entry.id))}>{draft.results ? `미완료 ${pendingTargets.length}명 작성` : `학급 ${pendingTargets.length}명 작성`}</button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" aria-live="polite" className="text-sm font-semibold text-blue-700">{busy ? progressText : draft.results ? `${completed}명 완료 · ${draft.entries.length - completed}명 미완료` : `${eligible.length}명 입력됨 · ${draft.entries.length - eligible.length}명 입력 대기`}</p><button type="button" disabled={busy} className={secondaryClass} onClick={() => setReplaceRoster(true)}>다른 명단</button></div>
      {replaceRoster && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="mb-3 text-sm text-amber-900">다른 명단을 불러오면 현재 {draft.entries.length}명의 특성·메모·작성 내용이 초기화됩니다. 필요한 내용은 먼저 Excel로 저장하세요.</p><div className="flex flex-wrap gap-2"><button type="button" className={secondaryClass} onClick={() => setReplaceRoster(false)}>기존 명단 유지</button><button type="button" className={secondaryClass} onClick={() => { setDraft({ entries: [], length: draft.length, results: false }); setReplaceRoster(false); setSelected([]); setError(''); setNotice(''); }}>초기화하고 명단 불러오기</button></div></div>}
      {!draft.results && <p className="rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-900">작성 시 특성과 메모를 OpenAI로 전송합니다. 명단의 번호·이름은 보내지 않지만, 메모에 적은 개인정보는 전송됩니다. 입력이 없는 학생은 제외합니다.</p>}
      {draft.results && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <button type="button" className={secondaryClass} disabled={busy || !duplicateTargets.length} onClick={() => void run(duplicateTargets.map((entry) => entry.id))}>중복 {duplicateTargets.length}명만 다시 작성</button>
        <button type="button" className={secondaryClass} disabled={busy || !selected.length} onClick={() => void run(selected)}>선택 {selected.length}명 다시 작성</button>
        <div className="flex flex-wrap gap-2 sm:ml-auto"><button type="button" className={secondaryClass} disabled={busy || !completed} onClick={() => void copy()}>표 복사</button><button type="button" className={secondaryClass} disabled={busy || !completed} onClick={() => { void exportBehavior(draft.entries).then(() => setNotice(`완료 ${completed}명을 저장했습니다. 미완료 ${draft.entries.length - completed}명은 제외했습니다.`)).catch((e: Error) => setError(e.message)); }}><Download className="mr-2 h-4 w-4" aria-hidden="true" />Excel 저장</button></div>
        <p className="w-full text-sm leading-6 text-slate-600">중복 재작성은 첫 단어·첫 세 글자·같거나 비슷한 문장을 비교합니다. 직접 수정한 내용은 학생을 선택한 경우에만 다시 작성합니다.</p>
      </div>}
      <div className="overflow-x-clip rounded-xl border border-slate-200 bg-white">
        <table className="w-full table-fixed border-collapse text-left max-md:block"><caption className="sr-only">학급 전체 행동특성 {draft.results ? '작성 결과' : '특성 및 메모'} · 번호순</caption>
          <thead className="bg-slate-50 text-sm text-slate-600 max-md:hidden"><tr><th className="w-[72px] p-4" scope="col">번호</th><th className="w-[120px] p-4" scope="col">이름</th><th className={`${draft.results ? 'w-[25%]' : 'w-[38%]'} p-4`} scope="col">선택한 특성{draft.results ? '·메모' : ''}</th><th className="p-4" scope="col">{draft.results ? '행동특성 및 종합의견' : '교사 메모'}</th></tr></thead>
          <tbody className="max-md:block">{draft.entries.map((entry) => {
            const pending = active.includes(entry.id);
            const count = behaviorCounts(entry.text);
            return <tr key={entry.id} data-testid={`behavior-${entry.number}`} className="border-t border-slate-200 align-top max-md:block max-md:p-4">
              <td className="p-4 text-sm font-semibold max-md:inline-block max-md:p-0 max-md:pr-3">{draft.results ? <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" className="h-5 w-5" aria-label={`${entry.number}번 ${entry.name} 재작성 선택`} checked={selected.includes(entry.id)} disabled={busy || !hasBehaviorInput(entry)} onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, entry.id] : previous.filter((id) => id !== entry.id))} />{entry.number}</label> : <span>{entry.number}</span>}</td>
              <th scope="row" className="break-words p-4 text-base font-semibold text-slate-900 max-md:inline-block max-md:p-0">{entry.name}</th>
              <td className="p-4 max-md:block max-md:px-0"><div className="flex flex-wrap gap-2">{entry.traits.map((trait) => <span key={trait} className="inline-flex max-w-full items-center rounded-lg bg-blue-50 pl-3 text-sm leading-6 text-blue-900"><span className="py-1.5">{trait}</span>{!draft.results && <button type="button" disabled={busy} aria-label={`${entry.number}번 ${trait} 삭제`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => editInput(entry.id, { traits: entry.traits.filter((value) => value !== trait) })}><X className="h-4 w-4" aria-hidden="true" /></button>}{draft.results && <span className="pr-3" />}</span>)}</div>
                {!draft.results ? <select className={`${inputClass} mt-2`} aria-label={`${entry.number}번 ${entry.name} 특성 추가`} value="" disabled={busy || entry.traits.length >= 12} onChange={(event) => { if (event.target.value) editInput(entry.id, { traits: [...entry.traits, event.target.value] }); }}><option value="">+ 특성 선택</option>{Object.entries(BEHAVIOR_TRAITS).map(([group, options]) => <optgroup key={group} label={group}>{options.filter((option) => !entry.traits.includes(option)).map((option) => <option key={option} value={option}>{option}</option>)}</optgroup>)}</select> : <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{entry.notes || (entry.traits.length ? '메모 없음' : '특성 또는 메모를 입력하세요.')}</p>}
              </td>
              <td className="p-4 max-md:block max-md:p-0">{draft.results ? <>
                <label className="sr-only" htmlFor={`behavior-text-${entry.id}`}>{entry.number}번 {entry.name} 작성 내용</label>
                <textarea id={`behavior-text-${entry.id}`} rows={6} className={`${inputClass} resize-y leading-7`} value={entry.text} readOnly={pending} placeholder={pending ? '작성 중입니다…' : '아직 작성된 내용이 없습니다.'} maxLength={3000} onChange={(event) => setDraft((previous) => ({ ...previous, entries: previous.entries.map((row) => row.id === entry.id ? { ...row, text: event.target.value, error: behaviorTextIssues(event.target.value).join(' '), edited: true } : row) }))} />
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-slate-600"><span>{count.characters}자 · {count.bytes}바이트</span><span className="inline-flex items-center gap-1">{pending ? '작성 중' : entry.error ? '확인 필요' : entry.stale ? '입력 변경됨' : entry.edited ? '직접 수정함' : entry.text ? <><Check className="h-4 w-4 text-blue-700" aria-hidden="true" />작성 완료</> : '미작성'}</span></div>
                {(entry.error || entry.stale || duplicates.has(entry.id)) && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">{entry.error || (entry.stale ? '특성·메모를 변경했습니다. 새 입력에 맞게 내용을 확인하세요.' : '다른 학생과 문장 시작이나 내용이 겹칩니다.')}</p>}
                {entry.stale && !busy && <button type="button" className={`${secondaryClass} mt-2`} onClick={() => setDraft((previous) => ({ ...previous, entries: previous.entries.map((row) => row.id === entry.id ? { ...row, stale: false, edited: true } : row) }))}>입력 변경 반영 확인</button>}
              </> : <><label className="sr-only" htmlFor={`behavior-notes-${entry.id}`}>{entry.number}번 {entry.name} 교사 메모</label><textarea id={`behavior-notes-${entry.id}`} className={`${inputClass} min-h-[116px] resize-y leading-7`} value={entry.notes} disabled={busy} maxLength={2000} placeholder="꼭 반영할 특징이나 실제 변화가 있으면 적어 주세요." onChange={(event) => editInput(entry.id, { notes: event.target.value })} /><p className="mt-1 text-right text-xs text-slate-600">{entry.notes.length} / 2,000자</p></>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
