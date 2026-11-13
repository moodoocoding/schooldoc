import { useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { assessmentProblems, commentLengthRange, GRADE_LABELS } from '../../../supabase/functions/_shared/neisHelper';
import type { Assessment, AssessmentPlan, NeisGrade } from '../../../supabase/functions/_shared/neisHelper';
import { planSubjects, subjectKey } from './autoPipeline';
import { GRADE_ACCEPT } from './subjectFiles';
import type { PlanMode, SubjectDraft } from './subjectDraft';
import { SubjectFilePicker } from './SubjectFilePicker';
import { AssessmentReview } from './SubjectSteps';

/** 펼칠 때만 내용을 그린다. 접힌 원본 미리보기를 미리 렌더링하지 않고, 입력 중 접히지 않게 상태를 스스로 가진다. */
function LazyDetails({
  defaultOpen = false,
  summary,
  summaryClassName,
  children,
}: {
  defaultOpen?: boolean;
  summary: ReactNode;
  summaryClassName: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={summaryClassName}>{summary}</summary>
      {open && children}
    </details>
  );
}

export function AssessmentList({
  assessments,
  planFile,
  planPdf,
  onEdit,
}: {
  assessments: Assessment[];
  planFile: File | null;
  planPdf: File | null;
  onEdit: (item: Assessment) => void;
}) {
  return (
    <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200" aria-label="정리한 평가">
      {assessments.map((item) => {
        const problems = assessmentProblems(item);
        return (
          <li key={item.id} className={problems.length ? 'bg-amber-50' : undefined}>
            <LazyDetails
              defaultOpen={problems.length > 0}
              summaryClassName="flex min-h-[56px] cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden"
              summary={
                <>
                {problems.length ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                ) : (
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block break-keep font-semibold text-slate-900">
                    {item.task || '평가 내용 확인 필요'}
                  </span>
                  <span className="mt-0.5 block break-all text-sm text-slate-600">
                    {item.standardCode || '성취기준 코드 없음'}
                    {item.period?.trim() ? ` · ${item.period.trim()}` : ''}
                    {problems.length ? ` · 입력 필요: ${problems.join(', ')}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-blue-700">
                  {problems.length ? '입력' : '기준 보기'}
                </span>
                </>
              }
            >
              <div className="border-t border-slate-200 p-4">
                {problems.length ? (
                  <AssessmentReview
                    assessment={item}
                    onChange={onEdit}
                    file={planFile}
                    convertedFile={planPdf}
                    editOpen
                  />
                ) : (
                  <div className="space-y-3 text-sm leading-6 text-slate-800">
                    <dl className="space-y-3">
                      <div>
                        <dt className="font-semibold">성취기준</dt>
                        <dd className="break-keep">{item.standard}</dd>
                      </div>
                      {(['high', 'middle', 'low'] as NeisGrade[]).map((grade) => (
                        <div key={grade}>
                          <dt className="font-semibold">{GRADE_LABELS[grade]}</dt>
                          <dd className="break-keep">{item.rubrics[grade]}</dd>
                        </div>
                      ))}
                      <div>
                        <dt className="font-semibold">수업·평가 과정과 채점 요소</dt>
                        <dd className="whitespace-pre-line break-keep">
                          {item.taskDetails?.trim() || '평가계획에서 찾지 못했습니다. 평가기준만으로 작성합니다.'}
                        </dd>
                      </div>
                    </dl>
                    <LazyDetails
                      summaryClassName="min-h-[44px] cursor-pointer content-center font-semibold text-blue-700"
                      summary="원본과 대조하거나 수정"
                    >
                      <div className="pt-3">
                        <AssessmentReview
                          assessment={item}
                          onChange={onEdit}
                          file={planFile}
                          convertedFile={planPdf}
                        />
                      </div>
                    </LazyDetails>
                  </div>
                )}
              </div>
            </LazyDetails>
          </li>
        );
      })}
    </ul>
  );
}

export function NeisPrepareStep({
  draft,
  plan,
  mode,
  assessments,
  disabled,
  onSubject,
  onEdit,
  onGradeFiles,
  onLength,
  onRestart,
}: {
  draft: SubjectDraft;
  plan: AssessmentPlan;
  mode: PlanMode;
  assessments: Assessment[];
  disabled: boolean;
  onSubject: (subject: string) => void;
  onEdit: (item: Assessment) => void;
  onGradeFiles: (files: FileList | null) => void;
  onLength: (length: SubjectDraft['length']) => void;
  onRestart: () => void;
}) {
  const subjects = planSubjects(plan);
  const needsInput = assessments.filter((a) => assessmentProblems(a).length).length;
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
        <p className="min-w-0 break-keep text-sm leading-6 text-slate-700">
          <span className="font-semibold text-slate-900">{draft.planFile?.name}</span>
          <br />
          {[plan.year, plan.schoolGrade, plan.semester].filter(Boolean).join(' ')} 평가계획 · 교과{' '}
          {subjects.length}개 · 평가 {plan.assessments.length}개
        </p>
        <button
          type="button"
          className="min-h-[44px] text-sm font-semibold text-blue-700 underline"
          disabled={disabled}
          onClick={onRestart}
        >
          평가계획 다시 넣기
        </button>
      </div>
      {mode === 'whole' && (
        <fieldset>
          <legend className="text-sm font-semibold text-slate-800">평어를 쓸 교과</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {subjects.map(({ subject, count }) => {
              const active = subjectKey(subject) === subjectKey(draft.subject);
              return (
                <label
                  key={subject}
                  className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-600 ${
                    active ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="neis-subject"
                    className="sr-only"
                    checked={active}
                    disabled={disabled}
                    onChange={() => onSubject(subject)}
                  />
                  {active && <Check className="h-4 w-4" aria-hidden="true" />}
                  {subject}
                  <span className="font-normal text-slate-600">평가 {count}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      {draft.subject && (
        <section aria-labelledby="neis-assessments-heading" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="neis-assessments-heading" className="text-lg font-bold text-slate-900">
              {draft.subject} 평가 {assessments.length}개
            </h2>
            <p className={`text-sm ${needsInput ? 'font-semibold text-amber-900' : 'text-slate-600'}`}>
              {needsInput
                ? `평가기준을 읽지 못한 평가 ${needsInput}개는 입력하기 전까지 평어에서 빠집니다.`
                : '평가기준을 모두 읽었습니다.'}
            </p>
          </div>
          <AssessmentList
            assessments={assessments}
            planFile={draft.planFile}
            planPdf={draft.planPdf}
            onEdit={onEdit}
          />
        </section>
      )}
      {draft.subject && (
        <section aria-labelledby="neis-grade-heading" className="space-y-4">
          <h2 id="neis-grade-heading" className="text-lg font-bold text-slate-900">
            {draft.subject} 성적과 분량
          </h2>
          <SubjectFilePicker
            label="나이스 성적 파일"
            accept={GRADE_ACCEPT}
            file={draft.gradeFile}
            disabled={disabled}
            onSelect={onGradeFiles}
          />
          <p className="text-sm leading-6 text-slate-600">
            한 학급의 번호·이름·수행평가 성적이 있는 XLSX·CSV·PDF·HWP·HWPX · 10MB까지. XLS는 XLSX로 다시 저장해
            주세요.
          </p>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-800">평어 분량</legend>
            <div className="mt-2 inline-flex flex-wrap gap-2">
              {([200, 300, 400] as const).map((length) => (
                <label
                  key={length}
                  className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border-2 px-4 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-600 ${
                    draft.length === length ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="neis-length"
                    className="sr-only"
                    checked={draft.length === length}
                    disabled={disabled}
                    onChange={() => onLength(length)}
                  />
                  {length}자 ({commentLengthRange(length).min}~{commentLengthRange(length).max}자)
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-600">공백과 문장부호를 포함해 선택 분량의 ±10%로 작성합니다.</p>
            {assessments.length > 0 && draft.length / assessments.length > 150 && (
              <p className="mt-2 break-keep rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                {draft.subject} 평가가 {assessments.length}개라 평가 하나에 약 {Math.round(draft.length / assessments.length)}자를
                씁니다. 평가계획의 과정·채점 요소로 채우지만, 내용이 적으면 같은 말이 늘어지거나 다시 쓰기가 반복될 수
                있습니다. 평가 {assessments.length}개에는 {assessments.length * 100 <= 200 ? 200 : 300}자 안팎을 권장합니다.
              </p>
            )}
          </fieldset>
          <p className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            XLSX·CSV는 이 브라우저에서 읽습니다. PDF 성적표는 원본을, HWP·HWPX는 변환한 PDF를 OpenAI로 전송해 읽습니다. 평어를
            만들 때는 평가기준과 학생별 수준만 보내고 번호·이름은 보내지 않습니다.
          </p>
        </section>
      )}
    </div>
  );
}
