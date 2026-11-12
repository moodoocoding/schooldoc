import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import {
  assessmentProblems,
  buildEvidence,
  GRADE_LABELS,
  mappingProblems,
  missingGrades,
  normalizeGrade,
  repeatedCommentIds,
  rosterProblems,
  SKIP_COLUMN,
  suggestAssessment,
} from '../../../supabase/functions/_shared/neisHelper';
import type { Assessment, GradeBook } from '../../../supabase/functions/_shared/neisHelper';
import { analyzeGradePdf, analyzePlan, generateComment } from './subjectApi';
import {
  checkFile,
  exportComments,
  findHeaderRows,
  GRADE_ACCEPT,
  isHangulPlan,
  parseGradeSheet,
  PLAN_ACCEPT,
  readGradeSheets,
} from './subjectFiles';
import { emptySubjectDraft, readSubjectDraft, saveSubjectDraft } from './subjectDraft';
import type { SubjectDraft, SubjectStep } from './subjectDraft';
import {
  AssessmentReview,
  GradeReview,
  inputClass,
  primaryClass,
  ResultReview,
  RosterReview,
  secondaryClass,
} from './SubjectSteps';
import { NeisSourcePreview } from './NeisSourcePreview';
import { SubjectFilePicker } from './SubjectFilePicker';

const steps: Record<SubjectStep, { group: number; title: string; description: string }> = {
  'plan-upload': {
    group: 0,
    title: '평가계획을 올려 주세요',
    description: '성취기준과 ◎·○·△ 평가기준이 있는 파일 한 개를 선택하세요.',
  },
  subject: {
    group: 0,
    title: '작성할 교과를 선택하세요',
    description: '이번에는 한 교과의 평어를 작성합니다.',
  },
  'plan-review': {
    group: 0,
    title: '평가기준을 확인하세요',
    description: '원본과 같은지 확인하세요. 잘못 읽힌 부분만 수정하면 됩니다.',
  },
  'grade-upload': {
    group: 1,
    title: '나이스 성적 파일을 올려 주세요',
    description: '한 학급의 번호·이름·수행평가 성적이 있는 파일을 선택하세요.',
  },
  sheet: {
    group: 1,
    title: '성적표가 있는 시트를 선택하세요',
    description: '한 학급의 성적이 들어 있는 시트 한 개를 선택하세요.',
  },
  header: {
    group: 1,
    title: '표의 제목 행을 선택하세요',
    description: '번호·이름·평가 항목의 제목이 적힌 행을 선택하세요.',
  },
  mapping: {
    group: 1,
    title: '같은 평가인지 확인하세요',
    description: '나이스의 이 열이 평가계획의 어떤 평가인지 선택하세요.',
  },
  coverage: {
    group: 1,
    title: '이번 평어의 작성 범위를 확인하세요',
    description: '연결된 평가만 평어에 반영됩니다. 빠진 평가가 있다면 연결을 다시 확인하세요.',
  },
  roster: {
    group: 2,
    title: '학생 명단을 확인하세요',
    description: '원본의 번호·이름·인원과 대조하세요. 동명이인은 번호로 구분합니다.',
  },
  grades: {
    group: 2,
    title: '학생별 성적을 확인하세요',
    description: '이 평가의 성적만 확인합니다. 빈칸이나 잘못 읽힌 성적을 원본에 맞게 고쳐 주세요.',
  },
  length: {
    group: 3,
    title: '평어 분량을 선택하세요',
    description: '확인한 평가기준과 성적을 근거로 초안을 만듭니다.',
  },
  results: {
    group: 3,
    title: '근거와 평어를 함께 검토하세요',
    description: '학생별로 내용을 수정하고 검토를 완료하세요. 수정하면 다시 검토 전 상태가 됩니다.',
  },
};
const groups = ['평가계획', '평가 연결', '성적 확인', '평어 작성'];

export function SubjectWorkspace() {
  const { user } = useTeacherAuth();
  const owner = user?.id ?? '';
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SubjectDraft>(() => readSubjectDraft(owner));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [generationProgress, setGenerationProgress] = useState({ done: 0, total: 0 });
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const assessments = draft.plan?.assessments.filter((a) => a.subject === draft.subject) ?? [];
  const assessment = assessments[draft.planIndex];
  const book = draft.book;
  const column = book?.columns[draft.columnIndex];
  const usedColumns =
    book?.columns.flatMap((c, i) =>
      draft.mappings[c.id] && draft.mappings[c.id] !== SKIP_COLUMN ? [i] : [],
    ) ?? [];
  const gradeColumn = usedColumns[draft.gradeIndex];
  const unused = assessments.filter((a) => !Object.values(draft.mappings).includes(a.id));
  const students = book?.students.toSorted((a, b) => Number(a.number) - Number(b.number)) ?? [];
  const student = students[draft.studentIndex];
  const result = student ? draft.results[student.id] : undefined;
  const repeats = repeatedCommentIds(
    Object.entries(draft.results).map(([id, row]) => ({ id, text: row.text })),
  );
  const allReviewed =
    students.length > 0 &&
    students.every((s) => draft.results[s.id]?.reviewed && draft.results[s.id]?.text.trim());
  const meta = steps[draft.step];
  const patch = (update: Partial<SubjectDraft>) => setDraft((prev) => ({ ...prev, ...update }));
  const move = (step: SubjectStep, update: Partial<SubjectDraft> = {}) => {
    setError('');
    setNotice('');
    patch({ step, ...update });
  };
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
  }, [draft.step, draft.planIndex, draft.columnIndex, draft.gradeIndex, draft.studentIndex]);
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
    setError('');
    setNotice('');
    try {
      await action(controller.signal, current);
    } catch (e) {
      if (current()) setError(e instanceof Error ? e.message : '요청에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      if (mounted.current && id === generation.current) setBusy('');
    }
  }
  function cancel() {
    generation.current++;
    request.current?.abort();
    setBusy('');
    setNotice('중단했습니다. 이미 확인한 자료와 생성이 끝난 평어는 유지됩니다.');
  }
  function setBook(next: GradeBook) {
    patch({
      book: next,
      originalBook: structuredClone(next),
      mappings: {},
      columnIndex: 0,
      gradeIndex: 0,
      excludedRows: [],
      results: {},
      step: 'mapping',
    });
  }
  function editAssessment(next: Assessment) {
    setDraft((prev) => ({
      ...prev,
      plan: prev.plan
        ? { ...prev.plan, assessments: prev.plan.assessments.map((a) => (a.id === next.id ? next : a)) }
        : null,
      results: {},
    }));
  }
  function selectFiles(files: FileList | null, kind: 'plan' | 'grades') {
    if (busy || !files?.length) return;
    setNotice('');
    if (files.length !== 1) {
      setError('한 번에 파일 한 개를 넣어 주세요.');
      return;
    }
    setError('');
    try {
      const file = files[0];
      checkFile(file, kind);
      if (kind === 'plan') setDraft({ ...emptySubjectDraft(), planFile: file });
      else
        patch({
          gradeFile: file,
          book: null,
          originalBook: null,
          sheets: [],
          mappings: {},
          results: {},
          excludedRows: [],
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : '파일을 확인해 주세요.');
    }
  }
  async function startGeneration(ids?: string[]) {
    if (
      !book ||
      mappingProblems(book, assessments, draft.mappings).length ||
      missingGrades(book, draft.mappings).length ||
      rosterProblems(book.students).length
    ) {
      setError('명단·평가 연결·성적 확인을 마친 뒤 생성해 주세요.');
      return;
    }
    const targets = students.filter((s) => !ids || ids.includes(s.id));
    if (!ids) patch({ results: {}, step: 'results', studentIndex: 0 });
    setGenerationProgress({ done: 0, total: targets.length });
    await run('평어를 생성하고 있습니다.', async (signal, current) => {
      for (const [index, target] of targets.entries()) {
        if (!current()) return;
        try {
          const evidence = buildEvidence(book, target.id, assessments, draft.mappings);
          const generated = await generateComment(
            { subject: draft.subject, length: draft.length, evidence },
            signal,
          );
          if (!current()) return;
          setDraft((prev) => ({
            ...prev,
            results: {
              ...prev.results,
              [target.id]: {
                generated,
                text: generated.sentences.map((s) => s.text).join(' '),
                reviewed: false,
                error: '',
              },
            },
          }));
        } catch (e) {
          if (!current()) return;
          const message = e instanceof Error ? e.message : '평어를 생성하지 못했습니다.';
          setDraft((prev) => ({
            ...prev,
            results: {
              ...prev.results,
              [target.id]: {
                text: prev.results[target.id]?.text ?? '',
                generated: prev.results[target.id]?.generated ?? null,
                reviewed: false,
                error: message,
              },
            },
          }));
          if (/한도|로그인|서버/.test(message)) {
            setError(
              `${target.number}번에서 중단했습니다. 완료된 평어는 유지되며 미생성 항목을 다시 시도할 수 있습니다. ${message}`,
            );
            return;
          }
        }
        setGenerationProgress({ done: index + 1, total: targets.length });
      }
    });
  }
  async function next() {
    setError('');
    setNotice('');
    if (draft.step === 'plan-upload' && draft.planFile) {
      if (draft.plan) {
        move('subject');
        return;
      }
      const file = draft.planFile;
      const label = isHangulPlan(file)
        ? '한글 문서를 PDF로 변환하고 평가기준을 읽고 있습니다.'
        : '평가계획의 기준 표를 읽고 있습니다.';
      await run(label, async (signal, current) => {
        const { plan, planPdf } = await analyzePlan(file, signal);
        if (!current()) return;
        patch({ plan, planPdf, subject: plan.assessments[0].subject, step: 'subject' });
      });
    } else if (draft.step === 'subject') move('plan-review', { planIndex: 0 });
    else if (draft.step === 'plan-review') {
      if (assessmentProblems(assessment).length) return;
      if (draft.planIndex + 1 < assessments.length) patch({ planIndex: draft.planIndex + 1 });
      else move('grade-upload');
    } else if (draft.step === 'grade-upload' && draft.gradeFile) {
      if (book) {
        move('mapping', { columnIndex: 0 });
        return;
      }
      await run('성적표를 읽고 있습니다.', async (signal, current) => {
        if (/\.pdf$/i.test(draft.gradeFile!.name)) {
          const parsed = await analyzeGradePdf(draft.gradeFile!, signal);
          if (current()) setBook(parsed);
        } else {
          const sheets = await readGradeSheets(draft.gradeFile!);
          if (!current()) return;
          if (!sheets.length) throw new Error('성적표가 있는 시트를 찾지 못했습니다.');
          patch({ sheets, sheetIndex: 0, step: 'sheet' });
        }
      });
    } else if (draft.step === 'sheet') {
      const headers = findHeaderRows(draft.sheets[draft.sheetIndex].data);
      move('header', { headerIndex: book ? draft.headerIndex : headers.length === 1 ? headers[0] : -1 });
    } else if (draft.step === 'header') {
      if (book) {
        move('mapping', { columnIndex: 0 });
        return;
      }
      try {
        setBook(parseGradeSheet(draft.sheets[draft.sheetIndex], draft.headerIndex));
      } catch (e) {
        setError(e instanceof Error ? e.message : '제목 행을 확인해 주세요.');
      }
    } else if (draft.step === 'mapping' && book) {
      if (draft.columnIndex + 1 < book.columns.length) patch({ columnIndex: draft.columnIndex + 1 });
      else if (mappingProblems(book, assessments, draft.mappings).length)
        setError(mappingProblems(book, assessments, draft.mappings).join(' '));
      else move('coverage');
    } else if (draft.step === 'coverage') move('roster');
    else if (draft.step === 'roster') move('grades', { gradeIndex: 0 });
    else if (draft.step === 'grades') {
      if (draft.gradeIndex + 1 < usedColumns.length) patch({ gradeIndex: draft.gradeIndex + 1 });
      else move('length');
    } else if (draft.step === 'length') await startGeneration();
    else if (draft.step === 'results' && student && result?.text.trim() && !result.error) {
      setDraft((prev) => ({
        ...prev,
        results: { ...prev.results, [student.id]: { ...prev.results[student.id], reviewed: true } },
        studentIndex: Math.min(prev.studentIndex + 1, students.length - 1),
      }));
      setNotice(`${student.number}번 ${student.name}의 검토를 완료했습니다.`);
    }
  }
  function back() {
    if (draft.step === 'plan-review' && draft.planIndex > 0) {
      patch({ planIndex: draft.planIndex - 1 });
      return;
    }
    if (draft.step === 'mapping' && draft.columnIndex > 0) {
      patch({ columnIndex: draft.columnIndex - 1 });
      return;
    }
    if (draft.step === 'grades' && draft.gradeIndex > 0) {
      patch({ gradeIndex: draft.gradeIndex - 1 });
      return;
    }
    const prior: Partial<Record<SubjectStep, SubjectStep>> = {
      subject: 'plan-upload',
      'plan-review': 'subject',
      'grade-upload': 'plan-review',
      sheet: 'grade-upload',
      header: 'sheet',
      mapping: draft.sheets.length ? 'header' : 'grade-upload',
      coverage: 'mapping',
      roster: 'coverage',
      grades: 'roster',
      length: 'grades',
      results: 'length',
    };
    move(prior[draft.step] ?? 'plan-upload');
  }
  const currentMapping = column ? (draft.mappings[column.id] ?? '') : '';
  const duplicateMapping =
    currentMapping &&
    currentMapping !== SKIP_COLUMN &&
    Object.entries(draft.mappings).some(([id, value]) => id !== column?.id && value === currentMapping);
  let blocking = '';
  if (draft.step === 'plan-upload' && !draft.planFile) blocking = '평가계획 파일을 선택해 주세요.';
  if (draft.step === 'subject' && (!draft.subject || !assessments.length)) blocking = '교과를 선택해 주세요.';
  if (draft.step === 'plan-review') {
    const missing = assessment ? assessmentProblems(assessment) : ['평가 항목'];
    if (missing.length) blocking = `${missing.join(', ')}을 원본에서 확인해 입력해 주세요.`;
  }
  if (draft.step === 'grade-upload' && !draft.gradeFile) blocking = '나이스 성적 파일을 선택해 주세요.';
  if (draft.step === 'header' && draft.headerIndex < 0) blocking = '제목 행을 선택해 주세요.';
  if (draft.step === 'mapping' && (!currentMapping || duplicateMapping))
    blocking = duplicateMapping
      ? '이 평가에는 이미 다른 열이 연결되었습니다. 다시 선택해 주세요.'
      : '같은 평가 또는 이번 교과에서 사용하지 않음을 선택해 주세요.';
  if (draft.step === 'roster' && (!book?.students.length || rosterProblems(book.students).length))
    blocking = '번호 중복·빈 이름을 확인해야 다음으로 진행할 수 있습니다.';
  if (draft.step === 'grades' && book) {
    const count = book.students.filter((s) => !normalizeGrade(s.grades[gradeColumn])).length;
    if (count)
      blocking = `확인할 성적이 ${count}개 남았습니다. 빈칸은 임의로 채우지 않고 원본과 대조해 주세요.`;
  }
  if (draft.step === 'results' && (!result?.text.trim() || result?.error))
    blocking = '평어 생성이 끝난 뒤 내용을 검토할 수 있습니다.';
  const actionText: Record<SubjectStep, string> = {
    'plan-upload': draft.plan ? '이 평가계획 사용' : '평가계획 분석',
    subject: '이 교과로 계속',
    'plan-review': '이 평가 확인',
    'grade-upload': book ? '이 성적표 사용' : '성적표 불러오기',
    sheet: '이 시트 사용',
    header: '이 제목 행 사용',
    mapping: '이 연결 확인',
    coverage: '연결된 평가로 진행',
    roster: '명단 확인 완료',
    grades: '이 평가의 성적 확인 완료',
    length: Object.keys(draft.results).length ? '평어 새로 생성' : '평어 생성',
    results: '검토 완료하고 다음 학생',
  };
  const progressDetail =
    draft.step === 'plan-review'
      ? `${draft.planIndex + 1} / ${assessments.length}개 평가`
      : draft.step === 'mapping'
        ? `${draft.columnIndex + 1} / ${book?.columns.length}개 열`
        : draft.step === 'grades'
          ? `${draft.gradeIndex + 1} / ${usedColumns.length}개 평가`
          : '';

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
        <ol aria-label="작성 단계" className="mt-4 grid grid-cols-4 gap-2">
          {groups.map((label, i) => (
            <li
              key={label}
              aria-current={i === meta.group ? 'step' : undefined}
              className={`border-t-4 pt-2 text-xs font-semibold sm:text-sm ${i === meta.group ? 'border-blue-600 text-blue-800' : i < meta.group ? 'border-slate-400 text-slate-600' : 'border-slate-200 text-slate-600'}`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-7">
        <header className="mb-6">
          <p className="mb-1 text-sm font-semibold text-blue-700">{progressDetail}</p>
          <h1
            ref={heading}
            tabIndex={-1}
            className="break-keep text-xl font-bold text-slate-900 outline-none sm:text-2xl"
          >
            {meta.title}
          </h1>
          <p className="mt-2 break-keep text-sm leading-6 text-slate-600">{meta.description}</p>
        </header>
        <fieldset disabled={!!busy} className="min-w-0 space-y-5">
          {(draft.step === 'roster' || draft.step === 'grades') &&
            draft.gradeFile &&
            /\.pdf$/i.test(draft.gradeFile.name) && (
              <details className="rounded-lg border border-slate-200 p-4">
                <summary className="min-h-[44px] cursor-pointer content-center text-sm font-semibold text-blue-700">
                  성적표 원본 보기
                </summary>
                <NeisSourcePreview key={draft.gradeFile.name} file={draft.gradeFile} allowPageSelection />
              </details>
            )}
          {(draft.step === 'plan-upload' || draft.step === 'grade-upload') && (
            <div className="space-y-5">
              <SubjectFilePicker
                label={draft.step === 'plan-upload' ? '평가계획 파일' : '나이스 성적 파일'}
                accept={draft.step === 'plan-upload' ? PLAN_ACCEPT : GRADE_ACCEPT}
                file={draft.step === 'plan-upload' ? draft.planFile : draft.gradeFile}
                disabled={!!busy}
                onSelect={(files) => selectFiles(files, draft.step === 'plan-upload' ? 'plan' : 'grades')}
              />
              <p className="text-sm leading-6 text-slate-600">
                {draft.step === 'plan-upload'
                  ? 'PDF·HWP 5.0·HWPX · 최대 10MB, 80쪽'
                  : 'XLSX·CSV·PDF · 10MB까지. XLS는 XLSX로 다시 저장해 주세요.'}
              </p>
              <p className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                {draft.step === 'plan-upload'
                  ? '평가계획 분석을 누르면 PDF를 OpenAI로 전송합니다. HWP·HWPX는 이 브라우저에서 PDF로 변환한 뒤 전송합니다.'
                  : 'XLSX·CSV는 이 브라우저에서 읽습니다. PDF를 선택하면 번호·이름·성적을 포함한 원본을 OpenAI로 전송해 분석합니다.'}
              </p>
            </div>
          )}
          {draft.step === 'subject' && (
            <label className="block max-w-xl text-sm font-semibold text-slate-800">
              교과
              <select
                className={`${inputClass} mt-2`}
                value={draft.subject}
                onChange={(e) => patch({ subject: e.target.value, planIndex: 0, mappings: {}, results: {} })}
              >
                {[...new Set(draft.plan?.assessments.map((a) => a.subject))].map((s) => (
                  <option key={s} value={s}>
                    {s || '교과 미확인'}
                  </option>
                ))}
              </select>
              <span className="mt-3 block font-normal text-slate-600">
                {draft.plan?.year} {draft.plan?.schoolGrade} {draft.plan?.semester} · 평가{' '}
                {assessments.length}개
              </span>
            </label>
          )}
          {draft.step === 'plan-review' && assessment && (
            <AssessmentReview
              assessment={assessment}
              onChange={editAssessment}
              file={draft.planFile}
              convertedFile={draft.planPdf}
            />
          )}
          {draft.step === 'sheet' && (
            <label className="block max-w-xl text-sm font-semibold text-slate-800">
              시트
              <select
                className={`${inputClass} mt-2`}
                value={draft.sheetIndex}
                onChange={(e) =>
                  patch({
                    sheetIndex: Number(e.target.value),
                    book: null,
                    originalBook: null,
                    results: {},
                    mappings: {},
                  })
                }
              >
                {draft.sheets.map((s, i) => (
                  <option key={i} value={i}>
                    {s.sheet}
                  </option>
                ))}
              </select>
            </label>
          )}
          {draft.step === 'header' && (
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-800">
                제목 행
                <select
                  className={`${inputClass} mt-2`}
                  value={draft.headerIndex}
                  onChange={(e) =>
                    patch({
                      headerIndex: Number(e.target.value),
                      book: null,
                      originalBook: null,
                      mappings: {},
                      results: {},
                      excludedRows: [],
                    })
                  }
                >
                  <option value={-1}>선택하세요</option>
                  {draft.sheets[draft.sheetIndex]?.data.slice(0, 100).map((row, i) => (
                    <option key={i} value={i}>
                      {i + 1}행 · {row.map(String).join(' / ').slice(0, 120)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-slate-600">
                번호·성명(이름)이 있는 제목 행을 찾습니다. 행을 선택한 뒤 평가 열과 학생을 별도로 확인합니다.
              </p>
            </div>
          )}
          {draft.step === 'mapping' && column && (
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <div className="space-y-5">
                <div className="rounded-xl bg-slate-50 p-5">
                  <p className="text-xs font-semibold text-slate-600">
                    나이스 성적표의 {draft.columnIndex + 1}번째 평가 열
                  </p>
                  <p className="mt-2 break-keep text-lg font-bold text-slate-900">{column.label}</p>
                  <p className="mt-3 text-sm text-slate-600">
                    원본 예:{' '}
                    {book?.students
                      .slice(0, 3)
                      .map((s) => `${s.number}번 ${s.grades[draft.columnIndex] || '빈칸'}`)
                      .join(' · ')}
                  </p>
                </div>
                <label className="block text-sm font-semibold text-slate-800">
                  평가계획의 같은 평가
                  <select
                    className={`${inputClass} mt-2`}
                    value={currentMapping}
                    onChange={(e) =>
                      patch({ mappings: { ...draft.mappings, [column.id]: e.target.value }, results: {} })
                    }
                  >
                    <option value="">선택하세요</option>
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.task}
                      </option>
                    ))}
                    <option value={SKIP_COLUMN}>이번 교과에서 사용하지 않음</option>
                  </select>
                </label>
                {!currentMapping && suggestAssessment(column.label, assessments) && (
                  <p className="text-sm text-blue-800">
                    제목이 같은 평가가 있습니다. 목록에서 선택하고 내용을 대조해 주세요.
                  </p>
                )}
                {currentMapping === SKIP_COLUMN && (
                  <p className="text-sm text-amber-900">이 열의 성적은 이번 평어의 근거에서 제외됩니다.</p>
                )}
                {assessments.find((a) => a.id === currentMapping) && (
                  <div className="rounded-lg border border-slate-200 p-4 text-sm leading-6">
                    <p className="font-semibold">
                      {assessments.find((a) => a.id === currentMapping)?.standardCode}
                    </p>
                    <p>{assessments.find((a) => a.id === currentMapping)?.standard}</p>
                  </div>
                )}
              </div>
              <NeisSourcePreview
                key={`${draft.columnIndex}-${currentMapping}`}
                file={draft.planFile}
                convertedFile={draft.planPdf}
                page={assessments.find((a) => a.id === currentMapping)?.sourcePage ?? 1}
                allowPageSelection
              />
            </div>
          )}
          {draft.step === 'coverage' && (
            <div className="space-y-5">
              <p className="text-lg font-semibold">평가 {usedColumns.length}개를 사용합니다.</p>
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                {usedColumns.map((i) => (
                  <li key={i}>
                    {book?.columns[i].label} →{' '}
                    {assessments.find((a) => a.id === draft.mappings[book!.columns[i].id])?.task}
                  </li>
                ))}
              </ul>
              {!!unused.length && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-bold">성적과 연결되지 않아 제외되는 평가 {unused.length}개</p>
                  <ul className="mt-2 list-disc pl-5">
                    {unused.map((a) => (
                      <li key={a.id}>{a.task}</li>
                    ))}
                  </ul>
                  <p className="mt-3">
                    진행하면 위 평가를 제외하고 작성합니다. 필요한 평가가 빠졌다면 이전 단계로 돌아가 연결을
                    고쳐 주세요.
                  </p>
                </div>
              )}
              {book?.columns.some((c) => draft.mappings[c.id] === SKIP_COLUMN) && (
                <p className="text-sm text-slate-600">
                  사용하지 않는 성적 열:{' '}
                  {book.columns
                    .filter((c) => draft.mappings[c.id] === SKIP_COLUMN)
                    .map((c) => c.label)
                    .join(', ')}
                </p>
              )}
            </div>
          )}
          {draft.step === 'roster' && book && (
            <>
              <RosterReview
                book={book}
                onChange={(row) =>
                  patch({
                    book: { ...book, students: book.students.map((s) => (s.id === row.id ? row : s)) },
                    results: {},
                  })
                }
                onExclude={(id) => {
                  const row = book.students.find((s) => s.id === id)!;
                  patch({
                    book: { ...book, students: book.students.filter((s) => s.id !== id) },
                    excludedRows: [...draft.excludedRows, row],
                    results: {},
                  });
                }}
              />
              {!!draft.excludedRows.length && (
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-sm text-slate-700">
                    제외한 행 {draft.excludedRows.length}개:{' '}
                    {draft.excludedRows.map((s) => `${s.sourceRow}행 ${s.name || '(이름 없음)'}`).join(', ')}
                  </p>
                  <button
                    type="button"
                    className="mt-2 min-h-[44px] text-sm text-blue-700 underline"
                    onClick={() =>
                      patch({
                        book: {
                          ...book,
                          students: [...book.students, ...draft.excludedRows].toSorted(
                            (a, b) => a.sourceRow - b.sourceRow,
                          ),
                        },
                        excludedRows: [],
                        results: {},
                      })
                    }
                  >
                    제외한 행 모두 복원
                  </button>
                </div>
              )}
            </>
          )}
          {draft.step === 'grades' && book && (
            <>
              <div className="rounded-lg bg-slate-50 p-4">
                <h2 className="break-keep font-bold text-slate-900">{book.columns[gradeColumn]?.label}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  평가계획:{' '}
                  {assessments.find((a) => a.id === draft.mappings[book.columns[gradeColumn]?.id])?.task}
                </p>
              </div>
              <GradeReview
                book={book}
                original={draft.originalBook}
                columnIndex={gradeColumn}
                onGrade={(id, value) =>
                  patch({
                    book: {
                      ...book,
                      students: book.students.map((s) =>
                        s.id === id
                          ? { ...s, grades: s.grades.map((g, i) => (i === gradeColumn ? value : g)) }
                          : s,
                      ),
                    },
                    results: {},
                  })
                }
              />
            </>
          )}
          {draft.step === 'length' && (
            <div className="space-y-5">
              <label className="block max-w-md text-sm font-semibold text-slate-800">
                목표 분량
                <select
                  className={`${inputClass} mt-2`}
                  value={draft.length}
                  onChange={(e) => patch({ length: Number(e.target.value) as SubjectDraft['length'] })}
                >
                  <option value={200}>200자 내외</option>
                  <option value={300}>300자 내외</option>
                  <option value={400}>400자 내외</option>
                </select>
              </label>
              <p className="text-sm text-slate-600">
                {draft.subject} · {students.length}명 · 평가 {usedColumns.length}개
              </p>
              <p className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                생성 버튼을 누르면 확인한 평가기준과 성적을 OpenAI로 전송합니다. 학생 번호·이름은 보내지
                않습니다. 근거가 적으면 목표보다 짧게 작성합니다.
              </p>
            </div>
          )}
          {draft.step === 'results' && (
            <div className="space-y-5">
              <label className="block max-w-xl text-sm font-semibold text-slate-800">
                검토할 학생
                <select
                  className={`${inputClass} mt-2`}
                  value={draft.studentIndex}
                  onChange={(e) => {
                    patch({ studentIndex: Number(e.target.value) });
                    setNotice('');
                  }}
                >
                  {students.map((s, i) => (
                    <option key={s.id} value={i}>
                      {s.number}번 {s.name} ·{' '}
                      {draft.results[s.id]?.reviewed
                        ? '검토 완료'
                        : draft.results[s.id]?.error
                          ? '생성 실패'
                          : draft.results[s.id]?.text
                            ? '검토 전'
                            : '미생성'}
                    </option>
                  ))}
                </select>
              </label>
              {student && (
                <div className="grid items-start gap-6 lg:grid-cols-2">
                  <div>
                    {result ? (
                      <ResultReview
                        result={result}
                        length={draft.length}
                        duplicate={repeats.has(student.id)}
                        onText={(text) =>
                          patch({
                            results: { ...draft.results, [student.id]: { ...result, text, reviewed: false } },
                          })
                        }
                      />
                    ) : (
                      <p className="rounded-lg bg-slate-50 p-5 text-slate-600">
                        아직 평어가 없습니다. 생성이 끝나지 않았거나 중단된 항목을 다시 시도할 수 있습니다.
                      </p>
                    )}
                    <button
                      type="button"
                      className="mt-4 min-h-[44px] text-sm text-blue-700 underline"
                      onClick={() => void startGeneration([student.id])}
                    >
                      {result?.text ? '이 학생 평어 다시 생성' : '이 학생 평어 생성'}
                    </button>
                  </div>
                  <aside
                    className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5"
                    aria-label="평어 작성 근거"
                  >
                    <h2 className="font-bold text-slate-900">평어에 사용한 근거</h2>
                    {book &&
                      buildEvidence(book, student.id, assessments, draft.mappings).map((e) => (
                        <div
                          key={e.assessmentId}
                          className="border-t border-slate-200 pt-3 text-sm leading-6"
                        >
                          <p className="font-semibold text-slate-900">
                            {e.task} · {GRADE_LABELS[e.grade]}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {e.standardCode} {e.standard}
                          </p>
                          <p className="mt-2 text-slate-800">{e.criterion}</p>
                          {result?.generated?.sentences
                            .filter((s) => s.assessmentId === e.assessmentId)
                            .map((s, i) => (
                              <p key={i} className="mt-2 border-l-2 border-blue-500 pl-3 text-blue-900">
                                <span className="block text-xs font-semibold">생성 당시 연결 문장</span>
                                {s.text}
                              </p>
                            ))}
                        </div>
                      ))}
                    <p className="text-xs leading-5 text-slate-600">
                      근거 연결은 사실 정확성을 보증하지 않습니다. 수정한 평어도 위 기준의 범위를 벗어나지
                      않는지 확인하세요.
                    </p>
                  </aside>
                </div>
              )}
              {students.some((s) => !draft.results[s.id]?.text || draft.results[s.id]?.error) && (
                <button
                  type="button"
                  className={secondaryClass}
                  onClick={() =>
                    void startGeneration(
                      students
                        .filter((s) => !draft.results[s.id]?.text || draft.results[s.id]?.error)
                        .map((s) => s.id),
                    )
                  }
                >
                  미생성·실패 항목 다시 시도
                </button>
              )}
            </div>
          )}
        </fieldset>
        {busy && (
          <div className="mt-6 rounded-lg bg-blue-50 p-4">
            <p role="status" className="font-semibold text-blue-900">
              {busy}
              {draft.step === 'results' ? ` ${generationProgress.done} / ${generationProgress.total}명` : ''}
            </p>
            <p className="mt-1 text-sm text-blue-900">잠시 걸릴 수 있습니다. 화면을 열어 둬 주세요.</p>
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
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
          >
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-4 text-sm text-emerald-800">
            {notice}
          </p>
        )}
        <footer className="mt-7 border-t border-slate-200 pt-5">
          {blocking && !busy && (
            <p id="neis-blocking" className="mb-3 text-sm leading-6 text-amber-900">
              {blocking}
            </p>
          )}
          {draft.step === 'results' && allReviewed ? (
            <div className="space-y-4">
              <p className="flex items-center gap-2 font-semibold text-emerald-800">
                <Check className="h-5 w-5" />
                {students.length}명 모두 검토했습니다.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  className={primaryClass}
                  disabled={!!busy}
                  onClick={() =>
                    void run('Excel 파일을 준비하고 있습니다.', async (_signal, current) => {
                      if (!book) return;
                      await exportComments(
                        draft.subject,
                        students.map((s) => ({
                          number: s.number,
                          name: s.name,
                          grades: usedColumns
                            .map((i) => `${book.columns[i].label}: ${s.grades[i]}`)
                            .join('\n'),
                          text: draft.results[s.id].text,
                          evidence: buildEvidence(book, s.id, assessments, draft.mappings)
                            .map(
                              (e) => `${e.standardCode} ${e.task} [${GRADE_LABELS[e.grade]}] ${e.criterion}`,
                            )
                            .join('\n'),
                        })),
                        _signal,
                      );
                      if (current()) setNotice('검토 완료한 평어를 Excel로 저장했습니다.');
                    })
                  }
                >
                  검토 완료 평어 Excel 저장
                </button>
                <button
                  className={secondaryClass}
                  disabled={!!busy}
                  onClick={() =>
                    void run('평어를 복사하고 있습니다.', async (_signal, current) => {
                      await navigator.clipboard.writeText(
                        students.map((s) => `${s.number}\t${s.name}\t${draft.results[s.id].text}`).join('\n'),
                      );
                      if (current()) setNotice('번호·이름·평어를 복사했습니다.');
                    })
                  }
                >
                  전체 복사
                </button>
                <button className={secondaryClass} disabled={!!busy} onClick={() => move('subject')}>
                  교과·입력 자료 다시 확인
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-between gap-3">
              {draft.step !== 'plan-upload' ? (
                <button className={secondaryClass} disabled={!!busy} onClick={back}>
                  이전
                </button>
              ) : (
                <span />
              )}
              <button
                className={primaryClass}
                disabled={!!busy || !!blocking}
                aria-describedby={blocking ? 'neis-blocking' : undefined}
                onClick={() => void next()}
              >
                {draft.step === 'results' && draft.studentIndex === students.length - 1
                  ? '이 학생 검토 완료'
                  : actionText[draft.step]}
              </button>
            </div>
          )}
        </footer>
      </div>
    </section>
  );
}
