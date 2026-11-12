import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, FileText, LoaderCircle } from 'lucide-react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { useNavigate } from 'react-router-dom';
import { isVerifiedPreviewAdmin } from '../../../supabase/functions/_shared/previewAccess';
import { planContextKey, validatePlanAnalysis, validatePlanContext, validatePlanDraft, validatePlanSources, type PlanContext, type PlanRequest, type PlanSource } from '../../../supabase/functions/_shared/schoolPlan';
import { importPlanSource, PLAN_SOURCE_ACCEPT, splitPlanSourceText } from './planSourceImport';
import { loadPlanState, savePlanState, type PlanState } from './planStore';
import { runPlanAi } from './planApi';
import { PlanPreview } from './PlanPreview';
import { PlanOutput } from './PlanOutput';
import { formatPlanTiming, parsePlanTiming } from './planTiming';
import { PLAN_REFERENCE_PROFILES, PLAN_REFERENCE_VERSION, validatePlanReferenceChoice } from '../../../supabase/functions/_shared/schoolPlanReferences';
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-5 py-3 text-sm font-bold text-white hover:bg-[#0B5A9E] disabled:cursor-not-allowed disabled:bg-slate-400';
const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const input = 'mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]';
const steps = ['기본 설정', '공문 추가', '공문 확인', '운영 정보', '검토·저장'];
const kindLabels = { required: '필수', recommended: '권장', example: '예시' };
function Field({ label, children }: {
    label: string;
    children: ReactNode;
}) {
    const id = useId();
    return <div data-decision><label htmlFor={id} className="block text-sm font-bold text-slate-800">{label}</label>{Children.map(children, child => isValidElement(child) && ['input', 'textarea', 'select'].includes(String(child.type)) ? cloneElement(child as ReactElement<{
        id: string;
    }>, { id }) : child)}</div>;
}
export function SchoolDocumentsWorkspace() {
    const { user, loading, signIn, error } = useTeacherAuth();
    const navigate = useNavigate();
    if (loading || !user?.id || user.is_anonymous)
        return <section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white px-6 py-12 text-center"><FileText className="mx-auto mb-4 h-8 w-8 text-[#0F6CBD]"/><h1 className="text-xl font-bold">학교 문서 작성</h1><p className="mt-3 leading-7 text-slate-600">{loading ? '로그인 상태를 확인하고 있습니다.' : '관리자 계정으로 로그인하면 공문을 바탕으로 계획서 초안을 작성할 수 있습니다.'}</p>{error && <p role="alert" className="mt-3 text-red-800">{error}</p>}{!loading && <button type="button" className={`${primary} mt-6`} onClick={() => void signIn()}>Google로 로그인</button>}</section>;
    if (!isVerifiedPreviewAdmin(user)) return <section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
      <FileText className="mx-auto mb-4 h-8 w-8 text-[#0F6CBD]" aria-hidden="true" />
      <h1 className="text-xl font-bold">학교 문서 작성</h1>
      <p role="alert" className="mt-3 leading-7 text-slate-600">현재 관리자 계정에서만 사용할 수 있습니다.</p>
      <button type="button" className={`${secondary} mt-6`} onClick={() => navigate('/')}>홈으로 돌아가기</button>
    </section>;
    return <PlanWizard key={user.id} ownerId={user.id}/>;
}
function PlanWizard({ ownerId }: {
    ownerId: string;
}) {
    const [initial] = useState(() => loadPlanState(ownerId));
    const [state, setState] = useState(initial.state);
    const [storageWarning, setStorageWarning] = useState(initial.warning);
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const [edit, setEdit] = useState<'body' | 'schedule' | 'budget' | null>(null);
    const [sectionId, setSectionId] = useState('');
    const [bodyText, setBodyText] = useState('');
    const [instruction, setInstruction] = useState('');
    const [candidate, setCandidate] = useState<PlanState['draft']>(null);
    const comparing = Boolean(candidate);
    const controller = useRef<AbortController | null>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    const questionHeading = useRef<HTMLHeadingElement>(null);
    const context: PlanContext = { sources: state.sources, analysis: state.analysis, answers: state.answers, conditions: state.conditions, referenceType: state.referenceType, referenceVersion: PLAN_REFERENCE_VERSION };
    const current = !!state.draft && state.draftContext === planContextKey(context);
    const patch = (value: Partial<PlanState>) => { setState(s => ({ ...s, ...value })); };
    const go = (step: number) => { setError(''); setEdit(null); setCandidate(null); patch({ step }); };
    useEffect(() => { if (!savePlanState(ownerId, state))
        setStorageWarning('이 브라우저에 자동 저장하지 못했습니다. 화면의 입력은 유지됩니다. 저장 공간을 확인해 주세요.'); }, [ownerId, state]);
    useEffect(() => () => controller.current?.abort(), []);
    useEffect(() => {
        if (state.step === 2 && state.questionPage > 0) questionHeading.current?.focus();
        else heading.current?.focus();
    }, [state.step, state.questionPage, edit, comparing]);
    const task = async (label: string, fn: (signal: AbortSignal) => Promise<void>) => {
        if (controller.current)
            return;
        const c = new AbortController();
        controller.current = c;
        setBusy(label);
        setError('');
        try {
            await fn(c.signal);
        }
        catch (cause) {
            if (!c.signal.aborted)
                setError(cause instanceof Error ? cause.message : '처리하지 못했습니다. 입력을 확인하고 다시 시도해 주세요.');
        }
        finally {
            if (controller.current === c) {
                controller.current = null;
                setBusy('');
            }
        }
    };
    const ai = async (request: PlanRequest, signal: AbortSignal) => {
        if (!state.consent) throw new Error('공문 추가 단계에서 AI 전송 안내를 확인해 주세요.');
        const result = await runPlanAi(request, signal, state.consent);
        signal.throwIfAborted();
        return result;
    };
    const analyze = () => task('공문의 요구사항을 분석하고 있습니다.', async (signal) => {
        let sources: PlanSource[] = [];
        if (state.sourceMode === 'paste')
            sources = validatePlanSources([{ id: 'source1', name: '붙여 넣은 공문', parts: splitPlanSourceText(state.pasted, 'text', '본문') }]);
        if (state.sourceMode === 'files') {
            if (files.length > 3)
                throw new Error('공문과 붙임은 한 번에 파일 3개까지 추가해 주세요.');
            sources = files.length ? await Promise.all(files.map((file, i) => importPlanSource(file, `source${i + 1}`, signal))) : state.sources;
            validatePlanSources(sources);
            if (!sources.length)
                throw new Error('공문과 붙임 파일을 추가해 주세요.');
        }
        signal.throwIfAborted();
        if (!sources.length) {
            patch({ sources: [], analysis: null, answers: {}, questionPage: 0, step: 3 });
            return;
        }
        if (JSON.stringify(sources) === JSON.stringify(state.sources) && state.analysis) {
            patch({ step: 2 });
            return;
        }
        // Preserve extracted text for retry even when the AI service is unavailable.
        patch({ sources, analysis: null, answers: {} });
        const result = await ai({ action: 'analyze', sources }, signal);
        const analysis = validatePlanAnalysis(result.analysis, sources);
        patch({ sources, analysis, answers: {}, questionPage: 0, step: 2, conditions: { ...state.conditions, topic: state.conditions.topic || analysis.title } });
    });
    const generate = () => task('공문과 운영 정보로 초안을 작성하고 있습니다.', async (signal) => {
        const checked = validatePlanContext(context);
        const result = await ai({ action: 'draft', ...checked }, signal);
        const draft = validatePlanDraft(result.draft, checked);
        patch({ draft, draftContext: planContextKey(checked), title: draft.title, step: 4 });
    });
    const revise = () => task('선택한 영역의 수정안을 작성하고 있습니다.', async (signal) => {
        if (!state.draft || !edit || !current)
            throw new Error('운영 정보를 반영한 초안을 먼저 작성해 주세요.');
        const result = await ai({ action: 'revise', ...validatePlanContext(context), draft: state.draft, revision: { area: edit, instruction } }, signal);
        setCandidate(validatePlanDraft(result.draft, context));
    });
    const startEdit = (area: 'body' | 'schedule' | 'budget') => {
        setEdit(area);
        setInstruction('');
        setCandidate(null);
        setError('');
        const section = state.draft?.sections[0];
        setSectionId(section?.id ?? '');
        setBodyText(section?.paragraphs.join('\n\n') ?? '');
    };
    const applyBody = () => {
        if (!state.draft)
            return;
        try {
            const draft = validatePlanDraft({ ...state.draft, sections: state.draft.sections.map(s => s.id === sectionId ? { ...s, paragraphs: bodyText.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean) } : s) }, context);
            patch({ draft });
            setEdit(null);
            setError('');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : '본문을 확인해 주세요.');
        }
    };
    const nextQuestions = () => state.analysis && (state.questionPage + 1) * 3 < state.analysis.questions.length ? patch({ questionPage: state.questionPage + 1 }) : go(3);
    const pageQuestions = state.analysis?.questions.slice(state.questionPage * 3, state.questionPage * 3 + 3) ?? [];
    const moreQuestions = (state.questionPage + 1) * 3 < (state.analysis?.questions.length ?? 0);
    const title = edit ? candidate ? '수정안 비교' : `${{ body: '본문', schedule: '일정', budget: '예산' }[edit]} 수정` : steps[state.step];
    const footer = (next: string, action: () => void, disabled = false, back?: () => void) => <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">{back ? <button type="button" className={secondary} onClick={back}><ArrowLeft className="h-4 w-4" aria-hidden="true"/>이전</button> : <span />}<button type="button" className={primary} onClick={action} disabled={disabled}>{next}<ArrowRight className="h-4 w-4" aria-hidden="true"/></button></div>;
    return <div className="mx-auto max-w-5xl pb-8">
    <header className="mb-6"><p className="mb-2 text-sm font-bold text-[#0F6CBD]">학교 문서 작성</p><h1 className="text-2xl font-extrabold text-slate-900">운영계획서</h1><p className="mt-2 text-base leading-7 text-slate-600">공문을 바탕으로 초안을 만들고, 한글에서 편집할 수 있게 저장합니다.</p></header>
    <ol aria-label="작성 진행" className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-5">{steps.map((step, index) => <li key={step} aria-current={index === state.step ? 'step' : undefined} className={`rounded-lg px-3 py-3 text-sm font-bold ${index === state.step ? 'bg-[#0F6CBD] text-white' : index < state.step ? 'bg-blue-50 text-blue-900' : 'bg-slate-100 text-slate-600'}`}><span aria-hidden="true">{index + 1}. </span>{step}</li>)}</ol>
    <p className="mb-5 text-sm leading-6 text-slate-600">추출 본문·조건·초안은 로그인 계정별로 이 브라우저에 자동 저장됩니다. 원본 파일은 저장하지 않으며 다른 기기와 동기화되지 않습니다.</p>
    {storageWarning && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-950">{storageWarning}</p>}
    <section aria-labelledby="plan-step-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <h2 ref={heading} tabIndex={-1} id="plan-step-heading" className="mb-2 text-xl font-bold outline-none">{title}</h2>
      {error && <p role="alert" className="my-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">{error}</p>}
      {busy ? <div role="status" className="py-10 text-center"><LoaderCircle aria-hidden="true" className="mx-auto mb-4 h-8 w-8 animate-spin text-[#0F6CBD]"/><p className="font-bold">{busy}</p><p className="mt-2 text-sm text-slate-600">단계를 나가도 기존 입력과 초안은 유지됩니다.</p><button type="button" className={`${secondary} mt-6`} onClick={() => { controller.current?.abort(); controller.current = null; setBusy(''); }}>작업 취소</button></div> : <>
      {!edit && state.step === 0 && <><p className="mb-6 leading-7 text-slate-600">운영계획서의 분량을 먼저 정합니다. AI가 이 분량에 맞춰 초안을 씁니다.</p><div className="space-y-6"><Field label="출력 분량"><select className={input} value={state.pages} onChange={e => patch({ pages: Number(e.target.value) as 1 | 2 })}><option value={1}>1쪽</option><option value={2}>2쪽 (본문 1쪽, 일정·예산 1쪽)</option></select></Field><Field label="운영계획 유형"><select className={input} value={state.referenceType} onChange={e => patch({ referenceType: validatePlanReferenceChoice(e.target.value) })}><option value="auto">공문·주제에 맞게 자동</option>{PLAN_REFERENCE_PROFILES.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></Field></div>{footer('다음', () => go(1))}</>}
      {!edit && state.step === 1 && <><p className="mb-6 leading-7 text-slate-600">관련 공문과 붙임을 함께 추가해 주세요. 이름·연락처 등 불필요한 개인정보는 먼저 지워 주세요.</p><div className="space-y-6"><Field label="공문 입력 방식"><select className={input} value={state.sourceMode} onChange={e => { patch({ sourceMode: e.target.value as PlanState['sourceMode'], consent: false }); setFiles([]); }}><option value="files">파일 추가</option><option value="paste">본문 붙여 넣기</option><option value="none">자료 없이 자체 계획 작성</option></select></Field>{state.sourceMode === 'files' && <Field label="공문·붙임 파일"><input className={input} type="file" multiple accept={PLAN_SOURCE_ACCEPT} onChange={e => { setFiles([...e.target.files ?? []]); patch({ consent: false }); }}/><span className="mt-2 block text-sm font-normal leading-6 text-slate-600">PDF·HWP·HWPX·UTF-8 TXT · 최대 3개, 파일당 10MB · PDF 10쪽, 한글 20쪽 이내. 스캔 PDF는 OCR이 필요합니다.</span></Field>}{state.sourceMode === 'paste' && <Field label="공문과 붙임 본문"><textarea className={input} rows={9} maxLength={40000} value={state.pasted} onChange={e => patch({ pasted: e.target.value, consent: false })}/></Field>}{state.sourceMode === 'files' && !files.length && state.sources.length > 0 && <p className="rounded-lg bg-slate-50 p-3 text-sm leading-6">보존된 추출 본문: {state.sources.map(s => s.name).join(', ')}. 새 파일을 고르면 교체됩니다.</p>}<label className="flex items-start gap-3 text-sm leading-6 text-slate-700" data-decision><input className="mt-1 h-5 w-5 shrink-0" type="checkbox" checked={state.consent} onChange={e => patch({ consent: e.target.checked })}/><span>공문에서 추출한 본문·입력 조건·초안을 OpenAI에 전송하여 분석·작성하는 데 동의합니다. 원본 파일은 전송하지 않습니다.</span></label></div>{footer(state.sourceMode === 'none' ? '운영 정보 입력' : '공문 분석', () => void analyze(), !state.consent, () => go(0))}</>}
      {!edit && state.step === 2 && <>
        <p className="mb-5 leading-7 text-slate-600">{state.analysis?.summary}</p>
        <div className="mb-6 space-y-3">{state.analysis?.requirements.map(r => {
          const source = state.sources.find(s => s.id === r.sourceId), part = source?.parts.find(p => p.id === r.partId);
          return <div key={r.id} className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm leading-6"><strong className="mr-2 text-[#0F6CBD]">{kindLabels[r.kind]}</strong>{r.text}</p>
            <details className="mt-2 text-sm leading-6 text-slate-600">
              <summary className="min-h-11 cursor-pointer py-2 font-medium">원문 확인 · {source?.name} · {part?.label}</summary>
              <blockquote className="mb-3 border-l-2 border-blue-300 pl-3">{r.quote}</blockquote>
              <p className="whitespace-pre-wrap">{part?.text}</p>
            </details>
          </div>;
        })}</div>
        {pageQuestions.length > 0 ? <div className="space-y-5 border-t border-slate-200 pt-5">
          <h3 ref={questionHeading} tabIndex={-1} className="font-bold outline-none">확인이 필요한 조건 · {state.questionPage + 1}/{Math.ceil((state.analysis?.questions.length ?? 0) / 3)}</h3>
          {pageQuestions.map(q => <Field key={q.id} label={q.label}>
            <textarea className={input} rows={2} maxLength={500} value={state.answers[q.id] ?? ''} onChange={e => patch({ answers: { ...state.answers, [q.id]: e.target.value } })}/>
            <span className="mt-1 block font-normal leading-6 text-slate-600">{q.hint} 미정이면 비워 두어도 됩니다.</span>
          </Field>)}
        </div> : <p className="text-sm leading-6 text-slate-600">추가 확인 질문이 없습니다. 다음 단계에서 운영 정보를 입력합니다.</p>}
        {footer(moreQuestions ? '다음 확인 사항' : '운영 정보 입력', nextQuestions, false, () => state.questionPage ? patch({ questionPage: state.questionPage - 1 }) : go(1))}
      </>}
      {!edit && state.step === 3 && <><p className="mb-6 leading-7 text-slate-600">사업명·기간·예산이면 충분합니다. 목적과 세부 활동은 AI가 초안으로 작성합니다.</p><div className="space-y-6"><Field label="주제·사업명"><input className={input} maxLength={100} value={state.conditions.topic} onChange={e => patch({ conditions: { ...state.conditions, topic: e.target.value } })} placeholder="예: 우리 학교 독서 주간"/></Field><TimingField value={state.conditions.timing} onChange={timing => patch({ conditions: { ...state.conditions, timing } })}/><Field label="예산(원)"><input className={input} inputMode="numeric" type="number" min={0} max={100000000} step={1} value={state.conditions.budget ?? ''} onChange={e => patch({ conditions: { ...state.conditions, budget: e.target.value === '' ? null : Number(e.target.value) } })} placeholder="미정이면 비워 두세요. 예산이 없으면 0"/>{state.analysis?.budgetLimit && <span className="mt-2 block font-normal text-slate-600">공문에서 확인한 상한: {state.analysis.budgetLimit.amount.toLocaleString('ko-KR')}원</span>}</Field></div>{footer('AI 초안 작성', () => void generate(), !state.conditions.topic.trim(), () => go(state.analysis ? 2 : 1))}</>}
      {!edit && state.step === 4 && state.draft && <PlanOutput draft={state.draft} title={state.title} pages={state.pages} current={current} conditions={state.conditions} related={state.sourceMode !== 'none' && state.sources.length > 0} onTitle={title => patch({ title })} onBack={() => go(3)} actions={<div data-decision role="group" aria-label="초안 수정" className="mt-5 grid gap-3 sm:grid-cols-3">{(['body', 'schedule', 'budget'] as const).map(area => <button type="button" key={area} className={secondary} disabled={!current} onClick={() => startEdit(area)}>{{ body: '본문 수정', schedule: '일정 수정', budget: '예산 수정' }[area]}</button>)}</div>}/>}
      {edit && !candidate && <><p className="mb-5 leading-7 text-slate-600">현재 초안은 수정안을 적용하기 전까지 유지됩니다.</p>{edit === 'body' ? <div className="space-y-5"><Field label="수정할 본문"><select className={input} value={sectionId} onChange={e => { setSectionId(e.target.value); setBodyText(state.draft?.sections.find(s => s.id === e.target.value)?.paragraphs.join('\n\n') ?? ''); }}>{state.draft?.sections.map(s => <option key={s.id} value={s.id}>{s.heading}</option>)}</select></Field><Field label="본문 내용"><textarea className={input} rows={12} value={bodyText} onChange={e => setBodyText(e.target.value)}/><span className="mt-1 block font-normal leading-6 text-slate-600">문단 사이를 한 줄 비웁니다. 공문 요구사항의 의미를 유지해 주세요.</span></Field></div> : <><Field label="AI 수정 요청"><textarea className={input} rows={5} maxLength={1000} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder={edit === 'schedule' ? '예: 준비 기간을 일주일 앞당겨 주세요.' : '예: 인쇄비를 줄이고 활동 재료에 더 배분해 주세요.'}/></Field><p className="mt-3 text-sm leading-6 text-slate-600">수정 요청과 현재 초안을 OpenAI에 전송합니다. 공문 조건과 예산 상한을 유지합니다.</p></>}{footer(edit === 'body' ? '본문 반영' : 'AI 수정안 보기', edit === 'body' ? applyBody : () => void revise(), edit !== 'body' && !instruction.trim(), () => { setEdit(null); setError(''); })}</>}
      {edit && candidate && <><div className="grid gap-5 lg:grid-cols-2"><div><h3 className="mb-3 font-bold">기존 초안</h3>{state.draft && <PlanPreview draft={state.draft} analysis={state.analysis}/>}</div><div><h3 className="mb-3 font-bold">AI 수정안</h3><PlanPreview draft={candidate} analysis={state.analysis}/></div></div><div className="mt-6 flex flex-wrap justify-end gap-3" data-decision><button type="button" className={secondary} onClick={() => { setCandidate(null); setEdit(null); }}>기존 초안 유지</button><button type="button" className={primary} onClick={() => { patch({ draft: candidate }); setCandidate(null); setEdit(null); }}>수정안 적용</button></div></>}
      </>}
    </section>
  </div>;
}

/** 운영 기간: 달력에서 시작일·종료일을 고른다. 예전 자유 입력은 그대로 두고 날짜를 고르면 바뀐다. */
function TimingField({ value, onChange }: { value: string; onChange: (timing: string) => void }) {
    const parsed = parsePlanTiming(value), range = parsed ?? { start: '', end: '' };
    const startId = useId(), endId = useId();
    const set = (next: { start: string; end: string }) => onChange(formatPlanTiming(next));
    return <fieldset data-decision>
      <legend className="text-sm font-bold text-slate-800">운영 기간</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div><label htmlFor={startId} className="text-sm text-slate-700">시작일</label><input id={startId} className={input} type="date" value={range.start} onChange={e => set({ start: e.target.value, end: range.end && range.end > e.target.value ? range.end : '' })}/></div>
        <div><label htmlFor={endId} className="text-sm text-slate-700">종료일</label><input id={endId} className={input} type="date" min={range.start || undefined} disabled={!range.start} value={range.end} onChange={e => set({ start: range.start, end: e.target.value })}/></div>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{parsed ? value ? `문서 표기: ${value}` : '하루 행사는 시작일만 고르고, 미정이면 비워 두세요.' : `이전 입력: ${value} · 날짜를 고르면 바뀝니다.`}</p>
    </fieldset>;
}
