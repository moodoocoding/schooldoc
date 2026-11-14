import { useState } from 'react';
import { AlertTriangle, Check, RotateCw } from 'lucide-react';
import {
  assessmentProblems,
  countComment,
  commentLengthRange,
  GRADE_LABELS,
  normalizeGrade,
  recordTextProblems,
  repeatedCommentIds,
} from '../../../supabase/functions/_shared/neisHelper';
import type {
  Assessment,
  GradeStudent,
  NeisGrade,
} from '../../../supabase/functions/_shared/neisHelper';
import { studentEvidence, usableColumns } from './autoPipeline';
import type { LinkMethod } from './autoPipeline';
import type { SubjectDraft } from './subjectDraft';
import { AssessmentList } from './NeisPrepareStep';
import { NeisSourcePreview } from './NeisSourcePreview';
import { inputClass, primaryClass, secondaryClass } from './SubjectSteps';
import { isPdfOrHangul } from './subjectFiles';

const SKIP = '';
const methodText: Record<LinkMethod, string> = {
  exact: '제목 일치',
  domain: '평가계획의 영역 일치',
  similar: '비슷한 제목',
  order: '순서로 연결 · 확인 필요',
  manual: '직접 선택',
  none: '연결 못 함 · 평어에서 제외',
};

type StudentState = 'done' | 'failed' | 'blocked' | 'pending';
function studentState(
  draft: SubjectDraft,
  student: GradeStudent,
  problems: Map<string, string[]>,
): StudentState {
  if (problems.get(student.id)?.length) return 'blocked';
  const result = draft.results[student.id];
  if (result?.error) return 'failed';
  return result?.text.trim() ? 'done' : 'pending';
}

export function NeisResultsStep({
  draft,
  assessments,
  students,
  problems,
  disabled,
  onLink,
  onEdit,
  onGrade,
  onText,
  onGenerate,
  onExport,
  onCopy,
  onOtherSubject,
}: {
  draft: SubjectDraft;
  assessments: Assessment[];
  students: GradeStudent[];
  problems: Map<string, string[]>;
  disabled: boolean;
  onLink: (columnId: string, assessmentId: string) => void;
  onEdit: (item: Assessment) => void;
  onGrade: (studentId: string, columnIndex: number, grade: NeisGrade) => void;
  onText: (studentId: string, text: string) => void;
  onGenerate: (ids: string[]) => void;
  onExport: () => void;
  onCopy: () => void;
  onOtherSubject: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  // 확인 필요 보기는 누른 시점의 학생을 유지한다. 고친 학생이 목록에서 바로 사라지지 않게 한다.
  const [attentionIds, setAttentionIds] = useState<string[]>([]);
  const [openEvidence, setOpenEvidence] = useState<string[]>([]);
  const book = draft.book!;
  const states = new Map(students.map((s) => [s.id, studentState(draft, s, problems)]));
  const count = (state: StudentState) => [...states.values()].filter((s) => s === state).length;
  const done = count('done');
  const attention = students.length - done;
  const repeats = repeatedCommentIds(
    students.map((s) => ({ id: s.id, text: draft.results[s.id]?.text ?? '' })),
  );
  const linkedIds = new Set(Object.values(draft.links).map((l) => l.assessmentId));
  const unlinked = assessments.filter((a) => !linkedIds.has(a.id));
  const broken = assessments.filter((a) => linkedIds.has(a.id) && assessmentProblems(a).length);
  const columnWarnings = book.columns.filter((c) => ['order', 'none'].includes(draft.links[c.id]?.method)).length;
  const used = usableColumns(book, draft.links, assessments);
  const retryIds = students.filter((s) => ['failed', 'pending'].includes(states.get(s.id)!)).map((s) => s.id);
  const visible = filter === 'all' ? students : students.filter((s) => attentionIds.includes(s.id));

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-2 sm:gap-3" role="group" aria-label="평어 현황">
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
          <span className="block text-sm font-semibold text-emerald-800">완성</span>
          <span className="text-xl font-bold text-emerald-900 sm:text-2xl">{done}명</span>
        </p>
        <p className={`rounded-xl border p-3 sm:p-4 ${attention ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <span className={`block text-sm font-semibold ${attention ? 'text-amber-900' : 'text-slate-600'}`}>확인 필요</span>
          <span className={`text-xl font-bold sm:text-2xl ${attention ? 'text-amber-900' : 'text-slate-900'}`}>{attention}명</span>
        </p>
        <p className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <span className="block break-keep text-sm font-semibold text-slate-600">평어에 쓴 평가</span>
          <span className="text-xl font-bold text-slate-900 sm:text-2xl">{used.length}개</span>
          <span className="text-sm text-slate-600"> / {assessments.length}개</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className={primaryClass} disabled={disabled || !done} onClick={onExport}>
          Excel 저장
        </button>
        <button type="button" className={secondaryClass} disabled={disabled || !done} onClick={onCopy}>
          완성된 평어 복사
        </button>
        {!!retryIds.length && (
          <button type="button" className={secondaryClass} disabled={disabled} onClick={() => onGenerate(retryIds)}>
            <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
            미생성·실패 {retryIds.length}명 다시 시도
          </button>
        )}
        <button type="button" className={secondaryClass} disabled={disabled} onClick={onOtherSubject}>
          다른 교과 작성
        </button>
      </div>

      {draft.stale && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-300 bg-blue-50 p-4">
          <p className="break-keep text-sm leading-6 text-blue-900">
            평가 연결이나 기준을 바꿨습니다. 바뀐 내용으로 평어를 다시 만들어야 반영됩니다.
          </p>
          <button
            type="button"
            className={secondaryClass}
            disabled={disabled}
            onClick={() => onGenerate(students.filter((s) => states.get(s.id) !== 'blocked').map((s) => s.id))}
          >
            바뀐 내용으로 다시 생성
          </button>
        </div>
      )}

      <details
        className="rounded-xl border border-slate-200"
        open={columnWarnings > 0 || broken.length > 0}
      >
        <summary className="flex min-h-[56px] cursor-pointer items-center gap-2 p-4 font-semibold text-slate-900">
          {columnWarnings || broken.length ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          ) : (
            <Check className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
          )}
          <span className="min-w-0 break-keep">
            자동으로 정리한 내용
            <span className="ml-2 font-normal text-slate-600">
              {draft.gradeFile?.name}
              {draft.gradeSheet ? ` · ${draft.gradeSheet} 시트` : ''} · {book.students.length}명 · 성적 열{' '}
              {book.columns.length}개
              {columnWarnings ? ` · 연결 확인 ${columnWarnings}개` : ''}
            </span>
          </span>
        </summary>
        <div className="space-y-5 border-t border-slate-200 p-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">성적 열과 평가 연결</h2>
            <ul className="mt-3 space-y-3">
              {book.columns.map((column) => {
                const link = draft.links[column.id];
                const warn = ['order', 'none'].includes(link?.method);
                return (
                  <li
                    key={column.id}
                    className={`flex flex-wrap items-center gap-2 rounded-lg p-3 ${warn ? 'bg-amber-50' : 'bg-slate-50'}`}
                  >
                    <div className="min-w-0 flex-[1_1_12rem]">
                      <p className="break-keep font-semibold text-slate-900">{column.label}</p>
                      <p className={`text-xs ${warn ? 'font-semibold text-amber-900' : 'text-slate-600'}`}>
                        {methodText[link?.method ?? 'none']}
                      </p>
                    </div>
                    <select
                      aria-label={`${column.label} 열에 연결할 평가`}
                      className={`${inputClass} min-w-0 flex-[1.4_1_14rem]`}
                      value={link?.assessmentId ?? SKIP}
                      disabled={disabled}
                      onChange={(e) => onLink(column.id, e.target.value)}
                    >
                      <option value={SKIP}>평어에 쓰지 않음</option>
                      {assessments.map((a) => {
                        const taken = Object.entries(draft.links).some(
                          ([id, l]) => id !== column.id && l.assessmentId === a.id,
                        );
                        return (
                          <option key={a.id} value={a.id} disabled={taken}>
                            {a.task}
                            {taken ? ' (다른 열에 연결됨)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </li>
                );
              })}
            </ul>
          </div>
          {draft.gradeFile && isPdfOrHangul(draft.gradeFile) && (
            <details className="rounded-lg border border-slate-200 p-3">
              <summary className="min-h-[44px] cursor-pointer content-center text-sm font-semibold text-blue-700">
                성적표 원본 보기
              </summary>
              <NeisSourcePreview key={draft.gradeFile.name} file={draft.gradeFile} convertedFile={draft.gradePdf} allowPageSelection />
            </details>
          )}
          {!!unlinked.length && (
            <p className="break-keep text-sm leading-6 text-slate-700">
              성적 열이 없어 평어에서 빠진 평가: {unlinked.map((a) => a.task || '(평가 내용 없음)').join(', ')}
            </p>
          )}
          {!!broken.length && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-amber-900">
                평가기준을 읽지 못해 평어에서 빠진 평가 {broken.length}개
              </h2>
              <AssessmentList
                assessments={broken}
                planFile={draft.planFile}
                planPdf={draft.planPdf}
                onEdit={onEdit}
              />
            </div>
          )}
        </div>
      </details>

      <section aria-labelledby="neis-students-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="neis-students-heading" className="text-lg font-bold text-slate-900">
            학생별 평어
          </h2>
          <div role="radiogroup" aria-label="보기" className="inline-flex rounded-lg border border-slate-300 p-1">
            {(
              [
                ['all', `전체 ${students.length}`],
                ['attention', `확인 필요 ${attention}`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filter === value}
                className={`min-h-[40px] rounded-md px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${filter === value ? 'bg-slate-900 text-white' : 'text-slate-700'}`}
                onClick={() => {
                  setFilter(value);
                  if (value === 'attention')
                    setAttentionIds(students.filter((s) => states.get(s.id) !== 'done').map((s) => s.id));
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {filter === 'attention' && !attention && (
          <p className="rounded-xl bg-emerald-50 p-5 text-emerald-900">확인이 필요한 학생이 없습니다.</p>
        )}
        <ul aria-label="학생별 평어 목록" className="divide-y divide-slate-200 rounded-xl border border-slate-200">
          {visible.map((student) => {
            const state = states.get(student.id)!;
            const result = draft.results[student.id];
            const who = `${student.number}번 ${student.name}`;
            const counts = countComment(result?.text ?? '');
            const evidence = state === 'blocked' ? [] : studentEvidence(book, student, draft.links, assessments);
            return (
              <li
                key={student.id}
                className={`flex flex-wrap gap-x-4 gap-y-3 p-4 ${state === 'done' ? '' : 'bg-amber-50/60'}`}
              >
                <div className="min-w-0 flex-[0_1_10rem]">
                  <p className="break-keep font-bold text-slate-900 [overflow-wrap:anywhere]">
                    {student.number}번 {student.name || '(이름 없음)'}
                  </p>
                  <p
                    className={`mt-1 inline-flex items-center gap-1 text-sm font-semibold ${
                      state === 'done' ? 'text-emerald-800' : 'text-amber-900'
                    }`}
                  >
                    {state === 'done' ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    )}
                    {state === 'done'
                      ? '완성'
                      : state === 'blocked'
                        ? '성적 확인 필요'
                        : state === 'failed'
                          ? '생성 실패'
                          : '미생성'}
                  </p>
                </div>
                <div className="min-w-0 flex-[1_1_18rem] space-y-3">
                  {state === 'blocked' && (
                    <div className="space-y-3">
                      <p className="break-keep text-sm text-amber-900">
                        {problems.get(student.id)!.join(' · ')}. 성적을 추측해 채우지 않았습니다. 원본을
                        확인해 입력하면 평어를 만듭니다.
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        {used
                          .filter(({ index }) => !normalizeGrade(student.grades[index]))
                          .map(({ column, index }) => (
                            <label key={column.id} className="block text-sm font-semibold text-slate-800">
                              {column.label}
                              <select
                                aria-label={`${who} ${column.label} 성적`}
                                className={`${inputClass} mt-1 w-36`}
                                value=""
                                disabled={disabled}
                                onChange={(e) => e.target.value && onGrade(student.id, index, e.target.value as NeisGrade)}
                              >
                                <option value="">선택</option>
                                <option value="high">◎ 상</option>
                                <option value="middle">○ 중</option>
                                <option value="low">△ 하</option>
                              </select>
                            </label>
                          ))}
                      </div>
                      {!problems.get(student.id)!.some((p) => p.startsWith('번호') || p === '이름 없음') ? null : (
                        <p className="text-sm text-slate-700">
                          번호·이름 문제는 성적 파일을 고쳐 다시 넣어 주세요. 다른 학생의 평어는 그대로 사용할 수 있습니다.
                        </p>
                      )}
                    </div>
                  )}
                  {state !== 'blocked' && (
                    <>
                      {result?.error && (
                        <p role="alert" className="text-sm text-red-800">
                          {result.error}
                        </p>
                      )}
                      {(result?.text || state === 'done') && (
                        <textarea
                          aria-label={`${who} 평어`}
                          className={`${inputClass} break-keep leading-7 [field-sizing:content]`}
                          rows={Math.max(2, Math.min(10, Math.ceil((result?.text.length ?? 0) / 55) + 1))}
                          maxLength={3000}
                          value={result?.text ?? ''}
                          disabled={disabled}
                          onChange={(e) => onText(student.id, e.target.value)}
                        />
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                        {result?.text ? (
                          <span>
                            {counts.characters}자 · {counts.bytes}바이트
                          </span>
                        ) : null}
                        {result?.text && (counts.characters < commentLengthRange(draft.length).min || counts.characters > commentLengthRange(draft.length).max) && (
                          <span>선택한 분량의 범위({commentLengthRange(draft.length).min}~{commentLengthRange(draft.length).max}자)를 벗어났습니다.</span>
                        )}
                        {repeats.has(student.id) && (
                          <span className="font-semibold text-amber-900">다른 학생과 시작이나 문장이 겹칩니다.</span>
                        )}
                        {!!result?.text && recordTextProblems(result.text).length > 0 && (
                          <span className="font-semibold text-amber-900">
                            기재요령 확인: {recordTextProblems(result.text).join(', ')}
                          </span>
                        )}
                        <button
                          type="button"
                          className="min-h-[44px] font-semibold text-blue-700 underline"
                          aria-label={`${who} ${result?.text ? '다시 생성' : '생성'}`}
                          disabled={disabled}
                          onClick={() => onGenerate([student.id])}
                        >
                          {result?.text ? '다시 생성' : '생성'}
                        </button>
                        {!!evidence.length && (
                          <button
                            type="button"
                            className="min-h-[44px] font-semibold text-slate-700 underline"
                            aria-expanded={openEvidence.includes(student.id)}
                            aria-controls={`neis-evidence-${student.id}`}
                            onClick={() =>
                              setOpenEvidence((ids) =>
                                ids.includes(student.id) ? ids.filter((id) => id !== student.id) : [...ids, student.id],
                              )
                            }
                          >
                            근거 {evidence.map((e) => `${e.task} ${GRADE_LABELS[e.grade]}`).join(', ')}
                          </button>
                        )}
                      </div>
                      {openEvidence.includes(student.id) && (
                          <ul id={`neis-evidence-${student.id}`} className="space-y-2 border-l-2 border-slate-300 pl-4 text-sm leading-6 text-slate-700">
                            {evidence.map((e) => (
                              <li key={e.assessmentId}>
                                <span className="font-semibold text-slate-900">
                                  {e.standardCode} {e.task} · {GRADE_LABELS[e.grade]}
                                </span>
                                <br />
                                {e.criterion}
                              </li>
                            ))}
                          </ul>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs leading-5 text-slate-600">
          평어는 학생별 평가기준과 평가계획의 수업·평가 과정을 근거로 작성했습니다. 글자 수는 공백 포함, 바이트는
          나이스 기준(한글 3, 영문·숫자 1, 줄바꿈 1바이트)으로 셉니다.
        </p>
      </section>
    </div>
  );
}
