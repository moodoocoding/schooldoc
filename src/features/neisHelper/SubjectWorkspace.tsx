import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import {
  assessmentProblems, buildEvidence, GRADE_LABELS, mappingProblems, missingGrades, normalizeGrade,
  repeatedCommentIds, rosterProblems, SKIP_COLUMN,
} from '../../../supabase/functions/_shared/neisHelper';
import type { Assessment, GradeBook, GradeStudent } from '../../../supabase/functions/_shared/neisHelper';
import { analyzeGradeDocument, analyzePlan, generateClassComments, readWorksheet } from './subjectApi';
import { checkFile, exportComments, findHeaderRows, GRADE_ACCEPT, isHangulFile, isPdfOrHangul, parseGradeSheet, PLAN_ACCEPT, readGradeSheets } from './subjectFiles';
import { emptySubjectDraft, readSubjectDraft, saveSubjectDraft } from './subjectDraft';
import type { SubjectDraft, SubjectStep } from './subjectDraft';
import { AssessmentReview, inputClass, primaryClass, secondaryClass } from './SubjectSteps';
import { NeisSourcePreview } from './NeisSourcePreview';
import { SubjectFilePicker } from './SubjectFilePicker';
import { WorksheetStep } from './WorksheetStep';
import { ClassGradeReview } from './ClassGradeReview';
import { ClassResultTable } from './ClassResultTable';
import { automaticMappings, buildClassRequest } from './classWorkflow';
import { matchWorksheet } from './sourcePages';

const steps: Record<SubjectStep, { group: number; title: string; description: string; action: string }> = {
  'plan-upload': { group: 0, title: '평가계획을 올려 주세요', description: '성취기준과 ◎·○·△ 평가기준이 있는 파일을 선택하세요.', action: '평가계획 분석' },
  subject: { group: 0, title: '작성할 교과를 선택하세요', description: '이번 학급의 평어를 작성할 교과를 선택하세요.', action: '이 교과로 계속' },
  'plan-review': { group: 0, title: '평가 자료를 확인하세요', description: '원문과 대조가 필요한 평가를 확인하고, 실제 평가에 사용한 빈 평가지 양식을 추가하세요.', action: '확인하고 성적표로' },
  'grade-upload': { group: 1, title: '나이스 성적 파일을 올려 주세요', description: '한 학급의 번호·이름·수행평가 성적이 있는 파일을 선택하세요.', action: '성적표 불러오기' },
  sheet: { group: 1, title: '성적표가 있는 시트를 선택하세요', description: '한 학급의 성적이 들어 있는 시트를 고르세요.', action: '이 시트 사용' },
  header: { group: 1, title: '표의 제목 행을 선택하세요', description: '번호·이름·평가 항목의 제목이 적힌 행을 선택하세요.', action: '이 제목 행 사용' },
  grades: { group: 1, title: '명단과 성적을 확인하세요', description: '번호순으로 학생 전체를 확인하세요. 확인이 필요한 연결과 성적은 이 화면에서 수정할 수 있습니다.', action: '명단·성적 확인 완료' },
  length: { group: 2, title: '평어 분량을 선택하세요', description: '확인한 자료로 학급 전체의 평어 초안을 한 번에 작성합니다.', action: '학급 평어 생성' },
  results: { group: 3, title: '학급 평어를 확인하세요', description: '번호순으로 평어를 검토하세요. 시작이나 문장이 겹치는 행은 따로 표시됩니다.', action: '전체 평어 검토 완료' },
};
const groups = ['평가 자료', '명단·성적', '작성 옵션', '결과'];

const clearGrade = (file: File | null = null) => ({
  gradeFile: file, gradePdf: null, sheets: [], sheetIndex: 0, headerIndex: -1, bookOrigin: null,
  book: null, originalBook: null, excludedRows: [], mappings: {}, results: {},
});

export function SubjectWorkspace() {
  const { user } = useTeacherAuth();
  const owner = user?.id ?? '';
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SubjectDraft>(() => readSubjectDraft(owner));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const reviewTrigger = useRef<HTMLButtonElement | null>(null);
  const { book, results, step } = draft;
  const subjects = [...new Set(draft.plan?.assessments.map((item) => item.subject))];
  const assessments = draft.plan?.assessments.filter((item) => item.subject === draft.subject) ?? [];
  const worksheetAssessment = assessments.find((item) => item.id === draft.worksheetAssessmentId) ?? assessments[0];
  const reviewAssessment = assessments.find((item) => item.id === draft.reviewAssessmentId);
  const planIssues = assessments.filter((item) => !item.sourcePage || item.warnings.length > 0 || assessmentProblems(item).length > 0);
  const worksheetIssues = assessments.filter((item) => draft.worksheets[item.id]?.warning);
  const students = book?.students.toSorted((a, b) => Number(a.number) - Number(b.number)) ?? [];
  const usedColumns = book?.columns.flatMap((column, index) => draft.mappings[column.id] && draft.mappings[column.id] !== SKIP_COLUMN ? [index] : []) ?? [];
  const mapIssues = book ? mappingProblems(book, assessments, draft.mappings) : [];
  const repeats = useMemo(() => repeatedCommentIds(Object.entries(results).map(([id, row]) => ({ id, text: row.text }))), [results]);
  const missingResults = students.filter((student) => !results[student.id]?.text.trim() || results[student.id]?.error);
  const allReviewed = students.length > 0 && !missingResults.length && !repeats.size && students.every((student) => results[student.id]?.reviewed);
  const meta = steps[step];
  const headerRows = draft.sheets[draft.sheetIndex]?.data;
  const headerChoices = step === 'header' && headerRows
    ? [...new Set([...headerRows.slice(0, 100).keys(), ...findHeaderRows(headerRows)])].toSorted((a, b) => a - b)
    : [];
  const patch = (update: Partial<SubjectDraft>) => setDraft((current) => ({ ...current, ...update }));
  const move = (next: SubjectStep, update: Partial<SubjectDraft> = {}) => {
    setError('');
    setNotice('');
    patch({ ...update, step: next });
  };

  useEffect(() => { saveSubjectDraft(owner, draft); }, [owner, draft]);
  useEffect(() => () => { request.current?.abort(); }, []);
  useEffect(() => { heading.current?.focus(); window.scrollTo({ top: 0 }); }, [step]);
  useEffect(() => { if (step === 'plan-review' && draft.reviewAssessmentId) reviewHeading.current?.focus(); }, [step, draft.reviewAssessmentId]);
  useEffect(() => {
    if (!draft.planFile && !book) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [draft.planFile, book]);

  async function run(label: string, operation: (signal: AbortSignal) => Promise<void>) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError(''); setNotice(''); setBusy(label);
    try { await operation(controller.signal); }
    catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '요청에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      if (request.current === controller && !controller.signal.aborted) { request.current = null; setBusy(''); }
    }
  }

  function selectedFile(files: FileList | null) {
    if (busy || !files?.length) return;
    setNotice('');
    if (files.length !== 1) { setError('한 번에 파일 한 개를 넣어 주세요.'); return; }
    setError('');
    return files[0];
  }
  function selectFile(files: FileList | null, kind: 'plan' | 'grades') {
    const file = selectedFile(files);
    if (!file) return;
    try {
      checkFile(file, kind);
      if (kind === 'plan') setDraft({ ...emptySubjectDraft(), planFile: file });
      else patch(clearGrade(file));
    } catch (cause) { setError(cause instanceof Error ? cause.message : '파일을 확인해 주세요.'); }
  }
  async function selectWorksheet(files: FileList | null) {
    const file = selectedFile(files);
    if (!file || !worksheetAssessment) return;
    const { id } = worksheetAssessment;
    await run('평가지를 브라우저에서 읽고 있습니다.', async (signal) => {
      const source = await readWorksheet(file, signal);
      signal.throwIfAborted();
      const comparison = matchWorksheet(source.text, id, assessments);
      setDraft((current) => ({ ...current, worksheets: { ...current.worksheets, [id]: { file, ...source, ...comparison } }, results: {} }));
    });
  }
  function editWorksheet(text: string) {
    const id = worksheetAssessment?.id;
    if (!id || !draft.worksheets[id]) return;
    patch({ worksheets: { ...draft.worksheets, [id]: { ...draft.worksheets[id], taskContext: text, warning: text.trim() ? '' : matchWorksheet(draft.worksheets[id].text, id, assessments).warning } }, results: {} });
  }
  function removeWorksheet() {
    const id = worksheetAssessment?.id;
    if (!id) return;
    const worksheets = { ...draft.worksheets };
    delete worksheets[id];
    patch({ worksheets, results: {} });
    setError('');
  }
  function editAssessment(item: Assessment) {
    if (!draft.plan) return;
    patch({ plan: { ...draft.plan, assessments: draft.plan.assessments.map((previous) => previous.id === item.id ? item : previous) }, results: {} });
  }
  function openReview(id: string, trigger: HTMLButtonElement) {
    reviewTrigger.current = trigger;
    if (id === draft.reviewAssessmentId) reviewHeading.current?.focus();
    else patch({ reviewAssessmentId: id });
  }

  function setBook(next: GradeBook, extra: Partial<SubjectDraft> = {}) {
    move('grades', { book: next, originalBook: structuredClone(next), mappings: automaticMappings(next, assessments), results: {}, excludedRows: [], ...extra });
  }
  function updateStudent(id: string, update: Partial<GradeStudent>) {
    if (!book) return;
    patch({ book: { ...book, students: book.students.map((student) => student.id === id ? { ...student, ...update } : student) }, results: {} });
  }
  function excludeStudent(id: string) {
    const row = book?.students.find((student) => student.id === id);
    if (!book || !row) return;
    patch({ book: { ...book, students: book.students.filter((student) => student.id !== id) }, excludedRows: [...draft.excludedRows, row], results: {} });
  }

  async function startGeneration(ids?: Set<string>) {
    if (!book || mapIssues.length || missingGrades(book, draft.mappings).length || rosterProblems(students).length) return;
    const targets = students.filter((student) => !ids || ids.has(student.id));
    if (!targets.length) return;
    patch({ step: 'results' });
    await run(`학생 ${targets.length}명의 평어를 생성하고 있습니다.`, async (signal) => {
      const { input, idMap } = buildClassRequest(draft.subject, draft.length, book, targets, assessments, draft.mappings, draft.worksheets, results);
      await generateClassComments(input, signal, (row) => {
        const id = idMap.get(row.id);
        if (!id || signal.aborted) return;
        setDraft((current) => {
          const previous = current.results[id];
          return { ...current, results: { ...current.results, [id]: {
            generated: row.comment ?? previous?.generated ?? null,
            text: row.comment ? row.comment.sentences.map((sentence) => sentence.text).join(' ') : previous?.text ?? '',
            error: row.error || (row.comment ? '' : '이 학생의 평어가 응답에 없습니다.'),
            reviewed: false,
          } } };
        });
      });
    });
  }

  async function next() {
    setError(''); setNotice('');
    if (step === 'plan-upload' && draft.planFile) {
      if (draft.plan) { move(subjects.length > 1 ? 'subject' : 'plan-review'); return; }
      const file = draft.planFile;
      await run(isHangulFile(file) ? '한글 문서를 PDF로 변환하고 평가기준을 읽고 있습니다.' : '평가계획의 기준 표를 읽고 있습니다.', async (signal) => {
        const { plan, planPdf } = await analyzePlan(file, signal);
        signal.throwIfAborted();
        const distinct = new Set(plan.assessments.map((item) => item.subject));
        move(distinct.size > 1 ? 'subject' : 'plan-review', { plan, planPdf, subject: plan.assessments[0].subject });
      });
    } else if (step === 'subject') move('plan-review');
    else if (step === 'plan-review') move('grade-upload');
    else if (step === 'grade-upload' && draft.gradeFile) {
      if (book) { move('grades'); return; }
      const file = draft.gradeFile;
      await run(isHangulFile(file) ? '한글 성적표를 PDF로 변환해 읽고 있습니다.' : '성적표를 읽고 있습니다.', async (signal) => {
        if (isPdfOrHangul(file)) {
          const { book: nextBook, gradePdf } = await analyzeGradeDocument(file, signal);
          signal.throwIfAborted();
          setBook(nextBook, { gradePdf });
          return;
        }
        const sheets = await readGradeSheets(file);
        signal.throwIfAborted();
        if (!sheets.length) throw new Error('성적표가 있는 시트를 찾지 못했습니다.');
        const candidates = sheets.flatMap((sheet, sheetIndex) => findHeaderRows(sheet.data).map((headerIndex) => ({ sheetIndex, headerIndex })));
        if (candidates.length === 1) {
          const origin = candidates[0];
          const update = { sheets, ...origin, bookOrigin: origin };
          try { setBook(parseGradeSheet(sheets[origin.sheetIndex], origin.headerIndex), update); }
          catch (cause) { move('header', { sheets, ...origin }); throw cause; }
        } else move(sheets.length > 1 ? 'sheet' : 'header', { sheets, sheetIndex: 0, headerIndex: -1 });
      });
    } else if (step === 'sheet') {
      const headers = findHeaderRows(draft.sheets[draft.sheetIndex].data);
      const remembered = draft.bookOrigin?.sheetIndex === draft.sheetIndex ? draft.bookOrigin.headerIndex : -1;
      move('header', { headerIndex: remembered >= 0 ? remembered : headers.length === 1 ? headers[0] : -1 });
    } else if (step === 'header') {
      const { sheetIndex, headerIndex, bookOrigin } = draft;
      if (book && bookOrigin?.sheetIndex === sheetIndex && bookOrigin.headerIndex === headerIndex) { move('grades'); return; }
      try { setBook(parseGradeSheet(draft.sheets[sheetIndex], headerIndex), { bookOrigin: { sheetIndex, headerIndex } }); }
      catch (cause) { setError(cause instanceof Error ? cause.message : '제목 행을 확인해 주세요.'); }
    } else if (step === 'grades') move('length');
    else if (step === 'length') await startGeneration();
    else if (step === 'results' && !repeats.size && !missingResults.length && students.length) {
      patch({ results: Object.fromEntries(students.map((student) => [student.id, { ...results[student.id], reviewed: true }])) });
      setNotice(`${students.length}명의 평어 검토를 완료했습니다.`);
    }
  }

  const back: Partial<Record<SubjectStep, SubjectStep>> = {
    subject: 'plan-upload', 'plan-review': subjects.length > 1 ? 'subject' : 'plan-upload', 'grade-upload': 'plan-review',
    sheet: book ? 'grades' : 'grade-upload', header: draft.sheets.length > 1 ? 'sheet' : book ? 'grades' : 'grade-upload',
    grades: 'grade-upload', length: 'grades', results: 'length',
  };
  let blocking = '';
  if (step === 'plan-upload' && !draft.planFile) blocking = '평가계획 파일을 선택해 주세요.';
  if (step === 'subject' && !assessments.length) blocking = '교과를 선택해 주세요.';
  if (step === 'plan-review' && (!assessments.length || assessments.some((item) => assessmentProblems(item).length))) blocking = '대조 목록에서 비어 있는 평가기준을 입력해 주세요.';
  if (step === 'grade-upload' && !draft.gradeFile) blocking = '나이스 성적 파일을 선택해 주세요.';
  if (step === 'header' && draft.headerIndex < 0) blocking = '제목 행을 선택해 주세요.';
  if (step === 'grades' && book) {
    const missing = missingGrades(book, draft.mappings).length;
    if (mapIssues.length) blocking = '평가 연결을 확인해 주세요.';
    else if (!students.length || rosterProblems(students).length) blocking = '학생 번호와 이름을 확인해 주세요.';
    else if (missing) blocking = `확인할 성적이 ${missing}개 있습니다.`;
  }
  if (step === 'results') {
    if (repeats.size) blocking = `겹치는 표현이 있는 학생 ${repeats.size}명의 평어를 확인해 주세요.`;
    else if (missingResults.length) blocking = `아직 완료되지 않은 평어 ${missingResults.length}개를 확인해 주세요.`;
  }

  function saveExcel() {
    if (!book || !allReviewed) return;
    void run('Excel 파일을 준비하고 있습니다.', async (signal) => {
      await exportComments(draft.subject, students.map((student) => ({
        number: student.number, name: student.name, text: results[student.id].text,
        grades: usedColumns.map((index) => `${book.columns[index].label}: ${GRADE_LABELS[normalizeGrade(student.grades[index])!]}`).join(' · '),
        evidence: buildEvidence(book, student.id, assessments, draft.mappings).map((e) => `${e.task} · ${e.criterion}`).join('\n'),
      })), signal);
      if (!signal.aborted) setNotice('검토한 학급 평어를 Excel로 저장했습니다.');
    });
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-700" onClick={() => navigate('/tools/neis-helper')} disabled={!!busy}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Neis Helper
        </button>
        <span className="text-xs text-slate-600">현재 탭에만 보관 · 새로고침 시 초기화</span>
      </div>
      <div>
        <p className="text-sm font-bold text-blue-700">교과학습발달상황(세특){draft.subject ? ` · ${draft.subject}` : ''}</p>
        <ol aria-label="작성 단계" className="mt-4 grid grid-cols-4 gap-2">
          {groups.map((label, index) => <li key={label} aria-current={index === meta.group ? 'step' : undefined}
            className={`border-t-4 pt-2 text-xs font-semibold sm:text-sm ${index === meta.group ? 'border-blue-600 text-blue-800' : index < meta.group ? 'border-slate-400 text-slate-600' : 'border-slate-200 text-slate-600'}`}>
            <span className="inline-flex flex-wrap items-center gap-x-1">
              {index + 1}. {label}
              {index < meta.group && <>
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                <span className="sr-only">완료</span>
              </>}
            </span>
          </li>)}
        </ol>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-7">
        <header className="mb-6">
          <h1 ref={heading} tabIndex={-1} className="break-keep text-xl font-bold text-slate-900 outline-none sm:text-2xl">{meta.title}</h1>
          <p className="mt-2 break-keep text-sm leading-6 text-slate-600">{meta.description}</p>
        </header>
        {busy && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 p-4">
          <p role="status" className="font-semibold text-blue-900">{busy}</p>
          <button type="button" className={secondaryClass} onClick={() => { request.current?.abort(); request.current = null; setBusy(''); setNotice('중단했습니다. 앞서 확인한 자료와 평어는 유지됩니다.'); }}>중단</button>
        </div>}
        {error && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">{error}</p>}
        <fieldset disabled={!!busy} className="min-w-0 space-y-5">
          {(step === 'plan-upload' || step === 'grade-upload') && <>
            <SubjectFilePicker label={step === 'plan-upload' ? '평가계획 파일' : '나이스 성적 파일'} accept={step === 'plan-upload' ? PLAN_ACCEPT : GRADE_ACCEPT}
              file={step === 'plan-upload' ? draft.planFile : draft.gradeFile} disabled={!!busy} onSelect={(files) => selectFile(files, step === 'plan-upload' ? 'plan' : 'grades')} />
            <p className="text-sm text-slate-600">{step === 'plan-upload' ? 'PDF·HWP 5.0·HWPX · 최대 10MB, 80쪽' : 'XLSX·CSV·PDF·HWP 5.0·HWPX · 최대 10MB. 문서 파일은 최대 80쪽입니다.'}</p>
            <p className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-900">{step === 'plan-upload'
              ? '평가계획 분석을 누르면 PDF를 OpenAI로 전송합니다. HWP·HWPX는 이 브라우저에서 PDF로 변환한 뒤 전송합니다.'
              : 'XLSX·CSV는 브라우저에서 읽습니다. PDF·HWP·HWPX는 성적표 불러오기를 누르면 번호·이름·성적이 담긴 PDF를 OpenAI로 전송해 분석합니다. 한글 파일은 브라우저에서 PDF로 변환합니다.'}</p>
          </>}
          {step === 'subject' && <label className="block max-w-xl text-sm font-semibold text-slate-800">교과
            <select className={`${inputClass} mt-2`} value={draft.subject} onChange={(e) => patch({ ...clearGrade(), subject: e.target.value, reviewAssessmentId: '' })}>
              {subjects.map((subject) => <option key={subject}>{subject}</option>)}
            </select>
          </label>}
          {step === 'plan-review' && <>
            <div className="rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-800">
              <p className="font-semibold">평가계획 {assessments.length}개 · 원문 문구 일치 {assessments.length - planIssues.length}개 · 대조 필요 {planIssues.length}개</p>
              {planIssues.length > 0 && <ul aria-label="대조가 필요한 평가계획 항목" className="mt-3 divide-y divide-slate-200">
                {planIssues.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-3 py-2">
                  <div className="min-w-0 flex-1 break-words"><p className="font-semibold">{item.task || '평가 내용 확인 필요'}</p><p className="text-amber-900">{[...assessmentProblems(item), ...item.warnings].join(' · ') || '원본 쪽 확인 필요'}</p></div>
                  <button type="button" className={secondaryClass} aria-label={`${item.task || item.standardCode} 원본 대조`} onClick={(e) => openReview(item.id, e.currentTarget)}>원본 대조</button>
                </li>)}
              </ul>}
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer content-center font-semibold text-blue-700">전체 성취기준과 평가 보기</summary>
                <ul className="space-y-2 pb-2">{assessments.map((item) => <li key={item.id} className="break-words"><strong>{item.standardCode}</strong> {item.standard} · {item.task}
                  <button type="button" className="ml-2 min-h-11 text-blue-700 underline" aria-label={`${item.task} 상세 보기`} onClick={(e) => openReview(item.id, e.currentTarget)}>상세</button>
                </li>)}</ul>
              </details>
            </div>
            {reviewAssessment && <div className="space-y-3 rounded-lg border border-blue-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 ref={reviewHeading} tabIndex={-1} className="font-bold text-slate-900">평가계획 원본 대조</h2>
                <button className={secondaryClass} type="button" onClick={() => { patch({ reviewAssessmentId: '' }); (reviewTrigger.current?.isConnected ? reviewTrigger.current : heading.current)?.focus(); }}>원본 대조 닫기</button>
              </div>
              <AssessmentReview key={reviewAssessment.id} assessment={reviewAssessment} onChange={editAssessment} file={draft.planFile} convertedFile={draft.planPdf} />
            </div>}
            {worksheetAssessment && <details className="rounded-lg border border-slate-200 px-4 py-2">
              <summary className="min-h-11 cursor-pointer content-center font-semibold text-slate-900">수행평가 평가지 양식{worksheetIssues.length ? ` · 대조 필요 ${worksheetIssues.length}개` : ''}</summary>
              <div className="space-y-3 pb-3">
                <p className="text-sm leading-6 text-slate-600">빈 평가지의 문항과 과제 조건을 참고합니다. 파일이 없으면 성적표로 계속할 수 있습니다.</p>
                <WorksheetStep assessments={assessments} assessmentId={worksheetAssessment.id} worksheets={draft.worksheets} disabled={!!busy}
                  onAssessment={(id) => { setError(''); patch({ worksheetAssessmentId: id }); }} onFiles={(files) => void selectWorksheet(files)}
                  onContext={editWorksheet} onRemove={removeWorksheet} />
              </div>
            </details>}
          </>}
          {step === 'sheet' && <label className="block max-w-xl text-sm font-semibold text-slate-800">시트
            <select className={`${inputClass} mt-2`} value={draft.sheetIndex} onChange={(e) => patch({ sheetIndex: Number(e.target.value) })}>
              {draft.sheets.map((sheet, index) => <option key={index} value={index}>{sheet.sheet}</option>)}
            </select>
          </label>}
          {step === 'header' && <label className="block text-sm font-semibold text-slate-800">제목 행
            <select className={`${inputClass} mt-2`} value={draft.headerIndex} onChange={(e) => patch({ headerIndex: Number(e.target.value) })}>
              <option value={-1}>선택하세요</option>
              {headerChoices.map((index) => <option key={index} value={index}>{index + 1}행 · {headerRows?.[index].map(String).join(' / ').slice(0, 120)}</option>)}
            </select>
          </label>}
          {step === 'grades' && book && <>
            {draft.gradeFile && isPdfOrHangul(draft.gradeFile) && <details className="rounded-lg border border-slate-200 p-3">
              <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-blue-700">성적표 원본 보기</summary>
              <NeisSourcePreview file={draft.gradeFile} convertedFile={draft.gradePdf} allowPageSelection />
            </details>}
            {draft.bookOrigin && <button type="button" className={secondaryClass} onClick={() => move(draft.sheets.length > 1 ? 'sheet' : 'header', draft.bookOrigin!)}>시트·제목 행 다시 선택</button>}
            <ClassGradeReview book={book} originalBook={draft.originalBook} students={students} assessments={assessments} mappings={draft.mappings} issues={mapIssues}
              excluded={draft.excludedRows} onMap={(columnId, assessmentId) => patch({ mappings: { ...draft.mappings, [columnId]: assessmentId }, results: {} })}
              onStudent={updateStudent} onExclude={excludeStudent} onRestore={() => patch({ book: { ...book, students: [...book.students, ...draft.excludedRows] }, excludedRows: [], results: {} })} />
          </>}
          {step === 'length' && <>
            <label className="block max-w-md text-sm font-semibold text-slate-800">목표 분량
              <select className={`${inputClass} mt-2`} value={draft.length} onChange={(e) => patch({ length: Number(e.target.value) as SubjectDraft['length'] })}>
                <option value={200}>200자 내외</option><option value={300}>300자 내외</option><option value={400}>400자 내외</option>
              </select>
            </label>
            <p className="text-sm text-slate-600">{draft.subject} · {students.length}명 · 평가 {usedColumns.length}개</p>
            <p className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-900">공통 평가기준과 평가지에서 참고할 문항, 임시 식별자별 성적을 한 요청으로 OpenAI에 전송합니다. 이름과 출석번호는 결과 표에서 합칩니다. 근거가 적으면 목표보다 짧게 작성합니다.</p>
          </>}
          {step === 'results' && book && (
            <ClassResultTable students={students} usedColumns={usedColumns} results={results} repeats={repeats}
              onEdit={(id, text) => patch({ results: { ...results, [id]: { ...results[id], text, error: '', reviewed: false } } })}
              onRepeat={() => void startGeneration(repeats)} onMissing={() => void startGeneration(new Set(missingResults.map((student) => student.id)))} />
          )}
        </fieldset>
        {notice && <p role="status" className="mt-4 text-sm text-emerald-800">{notice}</p>}
        <footer className="mt-7 border-t border-slate-200 pt-5">
          {blocking && !busy && <p id="neis-blocking" className="mb-3 text-sm leading-6 text-amber-900">{blocking}</p>}
          {step === 'results' && allReviewed ? <div className="space-y-4">
            <p className="flex items-center gap-2 font-semibold text-emerald-800"><Check className="h-5 w-5" aria-hidden="true" />{students.length}명 모두 검토했습니다.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={primaryClass} disabled={!!busy} onClick={saveExcel}>검토 완료 평어 Excel 저장</button>
              <button type="button" className={secondaryClass} disabled={!!busy} onClick={() => void run('평어를 복사하고 있습니다.', async (signal) => {
                await navigator.clipboard.writeText(students.map((student) => `${student.number}\t${student.name}\t${results[student.id].text}`).join('\n'));
                if (!signal.aborted) setNotice('번호·이름·평어를 복사했습니다.');
              })}>전체 복사</button>
              <button type="button" className={secondaryClass} disabled={!!busy} onClick={() => move('grade-upload', clearGrade())}>다른 학급 성적표</button>
              <button type="button" className={secondaryClass} disabled={!!busy} onClick={() => move(subjects.length > 1 ? 'subject' : 'plan-review')}>교과·입력 자료 다시 확인</button>
            </div>
          </div> : <div className="flex flex-wrap justify-between gap-3">
            {back[step] ? <button type="button" className={secondaryClass} disabled={!!busy} onClick={() => move(back[step]!)}>이전</button> : <span />}
            <button type="button" className={primaryClass} disabled={!!busy || !!blocking} aria-describedby={blocking ? 'neis-blocking' : undefined} onClick={() => void next()}>
              {step === 'plan-upload' && draft.plan ? '이 평가계획 사용' : step === 'grade-upload' && book ? '이 성적표 사용' : meta.action}
            </button>
          </div>}
        </footer>
      </div>
    </section>
  );
}
