import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { GRADE_LABELS, SKIP_COLUMN } from '../../../supabase/functions/_shared/neisHelper';
import type {
  Assessment,
  AssessmentPlan,
  GradeBook,
  NeisGrade,
} from '../../../supabase/functions/_shared/neisHelper';
import { analyzeGradeDocument, analyzePlan, generateClassComments } from './subjectApi';
import { checkFile, exportComments, isPdfOrHangul, readGradeSheets } from './subjectFiles';
import { buildClassRequest } from './classWorkflow';
import {
  assessmentsFor,
  autoLinkColumns,
  focusPlanOnSubject,
  pickGradeBook,
  planSubjects,
  PlanSubjectMismatch,
  studentEvidence,
  studentProblems,
  studentRows,
  usableColumns,
} from './autoPipeline';
import type { ColumnLink } from './autoPipeline';
import { emptySubjectDraft, readSubjectDraft, saveSubjectDraft } from './subjectDraft';
import type { PlanMode, SubjectDraft, SubjectPhase } from './subjectDraft';
import { primaryClass, secondaryClass } from './SubjectSteps';
import { NeisPlanStep } from './NeisPlanStep';
import { NeisPrepareStep } from './NeisPrepareStep';
import { NeisResultsStep } from './NeisResultsStep';

const phases: Record<SubjectPhase, { index: number; title: string; description: string }> = {
  plan: {
    index: 0,
    title: '평가계획을 넣어 주세요',
    description: '교과별 평가계획이면 교과를 먼저 고르고, 학년 전체 평가계획이면 그대로 넣으세요.',
  },
  prepare: {
    index: 1,
    title: '교과를 확인하고 성적을 넣어 주세요',
    description: '정리한 평가기준을 확인하고 나이스 성적 파일을 넣으면 평어까지 한 번에 만듭니다.',
  },
  results: {
    index: 2,
    title: '평어 결과',
    description: '자동으로 정리하고 만든 결과입니다. 확인이 필요한 학생과 항목만 표시합니다.',
  },
};
const phaseLabels = ['평가계획', '교과·성적', '평어 결과'];

export function SubjectWorkspace() {
  const { user } = useTeacherAuth();
  const owner = user?.id ?? '';
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SubjectDraft>(() => readSubjectDraft(owner));
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mismatch, setMismatch] = useState<AssessmentPlan | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);

  const assessments = assessmentsFor(draft.plan, draft.subject);
  const book = draft.book;
  const students = book?.students.toSorted((a, b) => Number(a.number) - Number(b.number)) ?? [];
  const problems = book ? studentProblems(book, draft.links, assessments) : new Map<string, string[]>();
  const meta = phases[draft.phase];
  const patch = (update: Partial<SubjectDraft>) => setDraft((prev) => ({ ...prev, ...update }));

  useEffect(() => {
    saveSubjectDraft(owner, draft);
  }, [owner, draft]);
  useEffect(() => {
    mounted.current = true;
    const stopLatestRequest = () => {
      generation.current++;
      request.current?.abort();
    };
    return () => {
      mounted.current = false;
      stopLatestRequest();
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [draft.phase]);
  useEffect(() => {
    if (!draft.planFile && !draft.book) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [draft.planFile, draft.book]);

  async function run(label: string, action: (signal: AbortSignal, current: () => boolean) => Promise<void>) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const id = ++generation.current;
    const current = () => mounted.current && id === generation.current && !controller.signal.aborted;
    setBusy(label);
    setProgress(null);
    setError('');
    setNotice('');
    try {
      await action(controller.signal, current);
    } catch (e) {
      if (current()) setError(e instanceof Error ? e.message : '요청에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      if (mounted.current && id === generation.current) {
        setBusy('');
        setProgress(null);
      }
    }
  }
  function cancel() {
    generation.current++;
    request.current?.abort();
    setBusy('');
    setProgress(null);
    setNotice('중단했습니다. 이미 만든 평어와 넣은 파일은 유지됩니다.');
  }
  function pickFile(files: FileList | null, kind: 'plan' | 'grades'): File | null {
    if (busy || !files?.length) return null;
    setNotice('');
    if (files.length !== 1) {
      setError('한 번에 파일 한 개를 넣어 주세요.');
      return null;
    }
    try {
      checkFile(files[0], kind);
      setError('');
      return files[0];
    } catch (e) {
      setError(e instanceof Error ? e.message : '파일을 확인해 주세요.');
      return null;
    }
  }

  // 1. 평가계획
  function choosePlanFile(files: FileList | null) {
    const file = pickFile(files, 'plan');
    if (file) {
      setMismatch(null);
      setDraft((prev) => ({ ...emptySubjectDraft(), planMode: prev.planMode, chosenSubject: prev.chosenSubject, length: prev.length, planFile: file }));
    }
  }
  function openPlan(plan: AssessmentPlan, planPdf: File | null, mode: PlanMode, chosen: string) {
    const subjects = planSubjects(plan);
    const focused = mode === 'subject' ? focusPlanOnSubject(plan, chosen) : plan;
    patch({
      plan: focused,
      planPdf,
      planMode: mode,
      subject: mode === 'subject' ? chosen : subjects.length === 1 ? subjects[0].subject : '',
      phase: 'prepare',
      gradeFile: null, gradePdf: null,
      book: null,
      links: {},
      results: {},
      stale: false,
    });
  }
  async function analyzePlanFile() {
    const file = draft.planFile;
    if (!file) return;
    const mode = draft.planMode;
    const chosen = draft.chosenSubject.trim();
    setMismatch(null);
    await run(
      /\.hwpx?$/i.test(file.name)
        ? '한글 문서를 PDF로 바꾸고 평가기준을 읽고 있습니다.'
        : mode === 'whole'
          ? '평가계획을 읽고 교과별로 나누고 있습니다.'
          : `${chosen} 평가계획을 읽고 있습니다.`,
      async (signal, current) => {
        const { plan, planPdf } = await analyzePlan(file, signal);
        if (!current()) return;
        try {
          openPlan(plan, planPdf, mode, chosen);
        } catch (e) {
          if (!(e instanceof PlanSubjectMismatch)) throw e;
          patch({ planPdf });
          setMismatch(plan);
          throw e;
        }
      },
    );
  }

  // 2. 교과와 성적 → 자동 정리 → 평어 생성
  function editAssessment(next: Assessment) {
    setDraft((prev) => ({
      ...prev,
      plan: prev.plan
        ? { ...prev.plan, assessments: prev.plan.assessments.map((a) => (a.id === next.id ? next : a)) }
        : null,
      stale: Object.keys(prev.results).length > 0,
    }));
  }
  async function readBook(file: File, signal: AbortSignal) {
    if (isPdfOrHangul(file)) return { ...await analyzeGradeDocument(file, signal), sheet: '' };
    const sheets = await readGradeSheets(file);
    if (!sheets.length) throw new Error('성적표가 있는 시트를 찾지 못했습니다.');
    return { ...pickGradeBook(sheets), gradePdf: null };
  }
  async function generateFor(
    ids: string[],
    source: { book: GradeBook; links: Record<string, ColumnLink>; results?: SubjectDraft['results'] },
    signal: AbortSignal,
    current: () => boolean,
  ) {
    const blocked = studentProblems(source.book, source.links, assessments);
    const targets = source.book.students.filter((s) => ids.includes(s.id) && !blocked.get(s.id)?.length);
    if (!targets.length) return;
    const columns = usableColumns(source.book, source.links, assessments);
    if (!columns.length)
      throw new Error('평어에 쓸 평가가 연결되지 않았습니다. 성적 열과 평가 연결을 확인해 주세요.');
    const usableIds = new Set(columns.map(({ column }) => column.id));
    const mappings = Object.fromEntries(source.book.columns.map((column) => [
      column.id, usableIds.has(column.id) ? source.links[column.id].assessmentId : SKIP_COLUMN,
    ]));
    const { input, idMap } = buildClassRequest(draft.subject, draft.length, source.book, targets, assessments, mappings, {}, source.results ?? draft.results);
    const received = new Set<string>();
    setProgress({ done: 0, total: targets.length });
    await generateClassComments(input, signal, (row) => {
      const id = idMap.get(row.id);
      if (!id || !current()) return;
      received.add(id);
      setDraft((prev) => ({ ...prev, results: { ...prev.results, [id]: {
        generated: row.comment ?? prev.results[id]?.generated ?? null,
        text: row.comment ? row.comment.sentences.map((s) => s.text).join(' ') : prev.results[id]?.text ?? '',
        error: row.error || (row.comment ? '' : '이 학생의 평어가 응답에 없습니다.'),
      } } }));
      setProgress({ done: received.size, total: targets.length });
    });
    if (current() && targets.length === source.book.students.filter((s) => !blocked.get(s.id)?.length).length)
      patch({ stale: false });
  }
  async function makeComments() {
    const file = draft.gradeFile;
    if (!file || !assessments.length) return;
    await run('성적표를 읽고 평가와 연결하고 있습니다.', async (signal, current) => {
      const read = await readBook(file, signal);
      if (!current()) return;
      const nextBook = studentRows(read.book);
      if (!nextBook.students.length) throw new Error('성적표에서 학생을 찾지 못했습니다.');
      const links = autoLinkColumns(nextBook, assessments);
      patch({ book: nextBook, gradeSheet: read.sheet, gradePdf: read.gradePdf, links, results: {}, stale: false, phase: 'results' });
      setBusy('평어를 만들고 있습니다.');
      await generateFor(nextBook.students.map((s) => s.id), { book: nextBook, links, results: {} }, signal, current);
    });
  }

  // 3. 결과에서 예외만 고치기
  function generateIds(ids: string[]) {
    if (!book) return;
    const source = { book, links: draft.links };
    void run('평어를 만들고 있습니다.', (signal, current) => generateFor(ids, source, signal, current));
  }
  function relink(columnId: string, assessmentId: string) {
    setDraft((prev) => ({
      ...prev,
      links: { ...prev.links, [columnId]: { assessmentId, method: assessmentId ? 'manual' : 'none' } },
      stale: Object.keys(prev.results).length > 0,
    }));
  }
  function setGrade(studentId: string, columnIndex: number, grade: NeisGrade) {
    if (!book) return;
    const nextBook: GradeBook = {
      ...book,
      students: book.students.map((s) =>
        s.id === studentId
          ? { ...s, grades: s.grades.map((g, i) => (i === columnIndex ? GRADE_LABELS[grade] : g)) }
          : s,
      ),
    };
    patch({ book: nextBook });
    // 그 학생의 성적이 모두 확인되면 바로 평어를 만든다.
    if (!studentProblems(nextBook, draft.links, assessments).get(studentId)?.length)
      void run('평어를 만들고 있습니다.', (signal, current) =>
        generateFor([studentId], { book: nextBook, links: draft.links }, signal, current),
      );
  }
  function completedRows() {
    return students.filter((s) => !problems.get(s.id)?.length && draft.results[s.id]?.text.trim() && !draft.results[s.id]?.error);
  }
  function exportExcel() {
    if (!book) return;
    const rows = completedRows();
    void run('Excel 파일을 준비하고 있습니다.', async (signal, current) => {
      await exportComments(
        draft.subject,
        rows.map((s) => {
          const evidence = studentEvidence(book, s, draft.links, assessments);
          return {
            number: s.number,
            name: s.name,
            grades: evidence.map((e) => `${e.task}: ${GRADE_LABELS[e.grade]}`).join('\n'),
            text: draft.results[s.id].text,
            evidence: evidence
              .map((e) => `${e.standardCode} ${e.task} [${GRADE_LABELS[e.grade]}] ${e.criterion}`)
              .join('\n'),
          };
        }),
        signal,
      );
      if (current())
        setNotice(
          `${rows.length}명의 평어를 Excel로 저장했습니다.${students.length > rows.length ? ` 확인 필요 ${students.length - rows.length}명은 빠졌습니다.` : ''}`,
        );
    });
  }
  function copyAll() {
    const rows = completedRows();
    void run('평어를 복사하고 있습니다.', async (_signal, current) => {
      await navigator.clipboard.writeText(
        rows.map((s) => `${s.number}\t${s.name}\t${draft.results[s.id].text}`).join('\n'),
      );
      if (current()) setNotice(`${rows.length}명의 번호·이름·평어를 복사했습니다.`);
    });
  }
  function otherSubject() {
    setError('');
    setNotice('');
    patch({
      phase: 'prepare',
      subject: draft.planMode === 'whole' ? '' : draft.subject,
      gradeFile: null, gradePdf: null,
      gradeSheet: '',
      book: null,
      links: {},
      results: {},
      stale: false,
    });
    // 교과별 방식은 다른 교과의 평가계획 파일이 필요하다. 전체 방식은 같은 계획에서 교과만 바꾼다.
    if (draft.planMode === 'subject')
      setDraft((prev) => ({ ...prev, phase: 'plan', chosenSubject: '', subject: '', planFile: null, plan: null, planPdf: null }));
  }

  let blocking = '';
  if (draft.phase === 'plan') {
    if (draft.planMode === 'subject' && !draft.chosenSubject.trim()) blocking = '교과를 선택해 주세요.';
    else if (!draft.planFile) blocking = '평가계획 파일을 넣어 주세요.';
  }
  if (draft.phase === 'prepare') {
    if (!draft.subject) blocking = '평어를 쓸 교과를 선택해 주세요.';
    else if (!assessments.length) blocking = '이 교과의 평가가 없습니다.';
    else if (!draft.gradeFile) blocking = '나이스 성적 파일을 넣어 주세요.';
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <button
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-700"
          onClick={() => navigate('/tools/neis-helper')}
          disabled={!!busy}
        >
          <ArrowLeft className="h-5 w-5" />
          Neis Helper
        </button>
        <span className="text-xs text-slate-600">현재 탭에만 보관 · 새로고침 시 초기화</span>
      </div>
      <div>
        <p className="text-sm font-bold text-blue-700">
          교과학습발달상황(세특){draft.subject ? ` · ${draft.subject}` : ''}
        </p>
        <ol aria-label="작성 단계" className="mt-4 grid grid-cols-3 gap-2">
          {phaseLabels.map((label, i) => (
            <li
              key={label}
              aria-current={i === meta.index ? 'step' : undefined}
              className={`border-t-4 pt-2 text-xs font-semibold sm:text-sm ${i === meta.index ? 'border-blue-600 text-blue-800' : i < meta.index ? 'border-slate-400 text-slate-600' : 'border-slate-200 text-slate-600'}`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-7">
        <header className="mb-6">
          <h1
            ref={heading}
            tabIndex={-1}
            className="break-keep text-xl font-bold text-slate-900 outline-none sm:text-2xl"
          >
            {draft.phase === 'results' ? `${draft.subject} 평어 결과` : meta.title}
          </h1>
          <p className="mt-2 break-keep text-sm leading-6 text-slate-600">{meta.description}</p>
        </header>

        {draft.phase === 'plan' && (
          <NeisPlanStep
            mode={draft.planMode}
            chosenSubject={draft.chosenSubject}
            file={draft.planFile}
            disabled={!!busy}
            onMode={(planMode) => {
              setMismatch(null);
              patch({ planMode });
            }}
            onSubject={(chosenSubject) => {
              setMismatch(null);
              patch({ chosenSubject });
            }}
            onFiles={choosePlanFile}
          />
        )}
        {draft.phase === 'prepare' && draft.plan && (
          <NeisPrepareStep
            draft={draft}
            plan={draft.plan}
            mode={draft.planMode}
            assessments={assessments}
            disabled={!!busy}
            onSubject={(subject) => patch({ subject, gradeFile: null, gradePdf: null, book: null, links: {}, results: {} })}
            onEdit={editAssessment}
            onGradeFiles={(files) => {
              const file = pickFile(files, 'grades');
              if (file) patch({ gradeFile: file, gradePdf: null, book: null, links: {}, results: {} });
            }}
            onLength={(length) => patch({ length })}
            onRestart={() => {
              setError('');
              patch({ phase: 'plan' });
            }}
          />
        )}
        {draft.phase === 'results' && book && (
          <NeisResultsStep
            draft={draft}
            assessments={assessments}
            students={students}
            problems={problems}
            disabled={!!busy}
            onLink={relink}
            onEdit={editAssessment}
            onGrade={setGrade}
            onText={(id, text) =>
              setDraft((prev) => ({ ...prev, results: { ...prev.results, [id]: { ...prev.results[id], text, error: '' } } }))
            }
            onGenerate={generateIds}
            onExport={exportExcel}
            onCopy={copyAll}
            onOtherSubject={otherSubject}
          />
        )}

        {busy && (
          <div className="mt-6 rounded-lg bg-blue-50 p-4">
            <p role="status" className="font-semibold text-blue-900">
              {busy}
              {progress ? ` ${progress.done} / ${progress.total}명` : ''}
            </p>
            {progress && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100" aria-hidden="true">
                <div
                  className="h-full bg-blue-600 transition-[width]"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            )}
            <p className="mt-2 text-sm text-blue-900">잠시 걸릴 수 있습니다. 화면을 열어 둬 주세요.</p>
            <button
              type="button"
              className="mt-2 min-h-[44px] text-sm font-semibold text-blue-800 underline"
              onClick={cancel}
            >
              중단
            </button>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
          >
            <p>{error}</p>
            {mismatch && (
              <button
                type="button"
                className={`${secondaryClass} mt-3`}
                onClick={() => {
                  setError('');
                  const plan = mismatch;
                  setMismatch(null);
                  openPlan(plan, draft.planPdf, 'whole', '');
                }}
              >
                전체 평가계획으로 보고 교과 고르기
              </button>
            )}
          </div>
        )}
        {notice && (
          <p role="status" className="mt-4 text-sm text-emerald-800">
            {notice}
          </p>
        )}
        {draft.phase !== 'results' && (
          <footer className="mt-7 border-t border-slate-200 pt-5">
            {blocking && !busy && (
              <p id="neis-blocking" className="mb-3 text-sm leading-6 text-amber-900">
                {blocking}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <button
                className={primaryClass}
                disabled={!!busy || !!blocking}
                aria-describedby={blocking ? 'neis-blocking' : undefined}
                onClick={() => void (draft.phase === 'plan' ? analyzePlanFile() : makeComments())}
              >
                {draft.phase === 'plan' ? '평가계획 분석' : '평어 만들기'}
              </button>
            </div>
          </footer>
        )}
      </div>
    </section>
  );
}
