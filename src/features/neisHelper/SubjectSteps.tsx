import type { Assessment, NeisGrade } from '../../../supabase/functions/_shared/neisHelper';
import { GRADE_LABELS } from '../../../supabase/functions/_shared/neisHelper';
import { NeisSourcePreview } from './NeisSourcePreview';

export const inputClass =
  'w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';
export const secondaryClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50';
export const primaryClass =
  'inline-flex min-h-[48px] items-center justify-center rounded-lg bg-[#0F6CBD] px-6 py-3 text-base font-bold text-white hover:bg-[#115EA3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#AAB7C4] disabled:text-slate-800';

export function AssessmentReview({
  assessment,
  onChange,
  file,
  convertedFile,
  editOpen = false,
}: {
  assessment: Assessment;
  onChange: (item: Assessment) => void;
  file: File | null;
  convertedFile: File | null;
  editOpen?: boolean;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-5">
        <div className="space-y-4 text-sm leading-7 text-slate-800">
          <h2 className="break-keep text-lg font-bold">{assessment.task || '평가 내용 확인 필요'}</h2>
          <p className="rounded-lg bg-slate-50 p-4">
            <span className="block font-semibold">
              {assessment.standardCode || '성취기준 코드 확인 필요'}
            </span>
            {assessment.standard || '성취기준 내용 확인 필요'}
          </p>
          {(['high', 'middle', 'low'] as NeisGrade[]).map((grade) => (
            <div key={grade} className="border-l-2 border-slate-300 pl-4">
              <p className="font-semibold">{GRADE_LABELS[grade]} 평가기준</p>
              <p className="break-keep">{assessment.rubrics[grade] || '원본에서 확인해 입력해 주세요.'}</p>
            </div>
          ))}
        </div>
        <details className="rounded-lg border border-slate-200 p-4" key={assessment.id} open={editOpen}>
          <summary className="min-h-[44px] cursor-pointer content-center text-sm font-semibold text-blue-700">
            잘못 읽힌 내용 수정
          </summary>
          <div className="mt-3 space-y-4">
            <label className="block text-sm font-semibold text-slate-800">
              평가 내용
              <textarea
                aria-label="평가 내용"
                rows={2}
                maxLength={1000}
                className={`${inputClass} mt-2`}
                value={assessment.task}
                onChange={(e) => onChange({ ...assessment, task: e.target.value })}
              />
            </label>
            <div className="rounded-xl bg-slate-50 p-4">
              <label className="block text-sm font-semibold text-slate-800">
                성취기준 코드
                <input
                  className={`${inputClass} mt-2`}
                  maxLength={200}
                  value={assessment.standardCode}
                  onChange={(e) => onChange({ ...assessment, standardCode: e.target.value })}
                />
              </label>
              <label className="mt-3 block text-sm font-semibold text-slate-800">
                성취기준
                <textarea
                  rows={3}
                  className={`${inputClass} mt-2`}
                  maxLength={2000}
                  value={assessment.standard}
                  onChange={(e) => onChange({ ...assessment, standard: e.target.value })}
                />
              </label>
            </div>
            {(['high', 'middle', 'low'] as NeisGrade[]).map((grade) => (
              <label key={grade} className="block text-sm font-semibold text-slate-800">
                {GRADE_LABELS[grade]} 평가기준
                <textarea
                  aria-label={`${GRADE_LABELS[grade]} 평가기준`}
                  className={`${inputClass} mt-2`}
                  rows={3}
                  maxLength={2000}
                  value={assessment.rubrics[grade]}
                  onChange={(e) =>
                    onChange({ ...assessment, rubrics: { ...assessment.rubrics, [grade]: e.target.value } })
                  }
                />
              </label>
            ))}
          </div>
        </details>
        {!!assessment.warnings.length && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">원본과 대조해 주세요</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {assessment.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <NeisSourcePreview
        key={assessment.id}
        file={file}
        convertedFile={convertedFile}
        page={assessment.sourcePage ?? 1}
        allowPageSelection
      />
    </div>
  );
}
