import type {
  Assessment,
  GradeBook,
  GradeStudent,
  NeisGrade,
} from '../../../supabase/functions/_shared/neisHelper';
import { GRADE_LABELS, normalizeGrade, rosterProblems } from '../../../supabase/functions/_shared/neisHelper';
import type { CommentDraft } from './subjectDraft';
import { countComment } from '../../../supabase/functions/_shared/neisHelper';
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
}: {
  assessment: Assessment;
  onChange: (item: Assessment) => void;
  file: File | null;
  convertedFile: File | null;
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
        <details className="rounded-lg border border-slate-200 p-4" key={assessment.id}>
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

export function RosterReview({
  book,
  onChange,
  onExclude,
}: {
  book: GradeBook;
  onChange: (row: GradeStudent) => void;
  onExclude: (id: string) => void;
}) {
  const problems = rosterProblems(book.students);
  return (
    <div className="max-w-3xl space-y-4">
      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
        {book.context || '불러온 성적표'} · {book.students.length}명 · 같은 이름도 번호가 다르면 별도
        학생입니다.
      </p>
      {!!problems.length && (
        <div
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {problems.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
      <table className="w-full table-fixed text-left">
        <caption className="sr-only">번호와 이름 대조</caption>
        <thead className="border-b border-slate-200 text-sm text-slate-600">
          <tr>
            <th className="w-20 py-3">번호</th>
            <th>이름</th>
            <th className="w-20">
              <span className="sr-only">행 제외</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {book.students.map((student) => (
            <tr key={student.id} className="border-b border-slate-100">
              <td className="py-2 pr-2">
                <input
                  aria-label={`${student.sourceRow}행 번호`}
                  className={inputClass}
                  inputMode="numeric"
                  maxLength={3}
                  value={student.number}
                  onChange={(e) => onChange({ ...student, number: e.target.value })}
                />
              </td>
              <td className="py-2">
                <input
                  aria-label={`${student.sourceRow}행 이름`}
                  className={inputClass}
                  maxLength={100}
                  value={student.name}
                  onChange={(e) => onChange({ ...student, name: e.target.value })}
                />
              </td>
              <td className="pl-2 text-right">
                <button
                  type="button"
                  className="min-h-[44px] px-2 text-sm text-slate-600 underline"
                  aria-label={`${student.sourceRow}행 제외`}
                  onClick={() => onExclude(student.id)}
                >
                  제외
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GradeReview({
  book,
  original,
  columnIndex,
  onGrade,
}: {
  book: GradeBook;
  original: GradeBook | null;
  columnIndex: number;
  onGrade: (id: string, value: string) => void;
}) {
  const column = book.columns[columnIndex];
  return (
    <ul
      aria-label={`${column.label} 학생별 성적 확인`}
      className="w-full max-w-3xl divide-y divide-slate-200"
    >
      {book.students.map((student) => {
        const value = student.grades[columnIndex];
        const grade = normalizeGrade(value);
        const source = original?.students.find((s) => s.id === student.id)?.grades[columnIndex] ?? '';
        return (
          <li
            key={student.id}
            className={`flex flex-wrap items-center gap-3 px-3 py-4 ${grade ? '' : 'bg-amber-50'}`}
          >
            <div className="min-w-0 flex-[1_1_180px]">
              <p className="break-words font-semibold text-slate-900">
                {student.number}번 · {student.name}
              </p>
              <p className="mt-1 break-all text-sm text-slate-600">불러온 값: {source || '빈칸'}</p>
            </div>
            <select
              className={`${inputClass} max-w-full flex-[0_1_140px]`}
              aria-label={`${student.number}번 ${student.name} 성적`}
              value={grade ?? ''}
              onChange={(e) =>
                onGrade(student.id, e.target.value ? GRADE_LABELS[e.target.value as NeisGrade] : '')
              }
            >
              <option value="">확인 필요</option>
              <option value="high">◎ 상</option>
              <option value="middle">○ 중</option>
              <option value="low">△ 하</option>
            </select>
          </li>
        );
      })}
    </ul>
  );
}

export function ResultReview({
  result,
  onText,
  duplicate,
  length,
}: {
  result: CommentDraft;
  onText: (text: string) => void;
  duplicate: boolean;
  length: number;
}) {
  const counts = countComment(result.text);
  return (
    <div className="space-y-4">
      {result.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {result.error}
        </p>
      )}
      {duplicate && (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          다른 학생과 같은 문장이 있습니다. 평가 근거가 같다면 표현이 겹칠 수 있습니다. 사실을 바꾸지 않는
          범위에서 검토해 주세요.
        </p>
      )}
      <label className="block text-sm font-semibold text-slate-800">
        평어
        <textarea
          aria-label="평어"
          className={`${inputClass} mt-2 leading-8`}
          rows={Math.max(4, Math.min(12, Math.ceil(result.text.length / 35) + 1))}
          maxLength={3000}
          value={result.text}
          onChange={(e) => onText(e.target.value)}
        />
      </label>
      <p className="text-sm text-slate-600">
        {counts.characters}자 · {counts.bytes}바이트{' '}
        <span className="text-xs">(공백 포함 · 줄바꿈 2바이트)</span>
      </p>
      {result.text && counts.characters < length * 0.75 && (
        <p className="text-sm text-slate-600">
          목표 {length}자보다 짧습니다. 분량을 채우기 위해 확인되지 않은 내용을 추가하지 마세요.
        </p>
      )}
      <div
        className={`rounded-lg p-3 text-sm font-semibold ${result.reviewed ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
      >
        {result.reviewed ? '교사 검토 완료' : '교사 검토 전'}
      </div>
    </div>
  );
}
