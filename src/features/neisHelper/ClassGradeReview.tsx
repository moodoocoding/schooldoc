import { GRADE_LABELS, normalizeGrade, rosterProblems, SKIP_COLUMN } from '../../../supabase/functions/_shared/neisHelper';
import type { Assessment, GradeBook, GradeStudent, NeisGrade } from '../../../supabase/functions/_shared/neisHelper';
import { inputClass, secondaryClass } from './SubjectSteps';

interface Props {
  book: GradeBook;
  originalBook: GradeBook | null;
  students: GradeStudent[];
  assessments: Assessment[];
  mappings: Record<string, string>;
  issues: string[];
  excluded: GradeStudent[];
  onMap: (columnId: string, assessmentId: string) => void;
  onStudent: (id: string, update: Partial<GradeStudent>) => void;
  onExclude: (id: string) => void;
  onRestore: () => void;
}

export function ClassGradeReview({ book, originalBook, students, assessments, mappings, issues, excluded, onMap, onStudent, onExclude, onRestore }: Props) {
  const columns = book.columns.flatMap((column, index) => mappings[column.id] === SKIP_COLUMN ? [] : [{ ...column, index }]);
  const linked = new Set(Object.values(mappings));
  const rosterIssues = rosterProblems(students);
  const missing = assessments.filter((assessment) => !linked.has(assessment.id));
  const confirmedCount = assessments.length - missing.length;
  return (
    <div className="min-w-0 space-y-4">
      <details className="rounded-lg border border-slate-200 px-4 py-2" open={issues.length ? true : undefined}>
        <summary className="min-h-[44px] cursor-pointer content-center font-semibold text-slate-900">
          평가 연결 · {confirmedCount}개{issues.length ? ' · 확인 필요' : ''}
        </summary>
        <p className="mb-3 text-sm text-slate-600">제목이 고유하게 일치하는 열은 자동 연결했습니다. 다른 평가는 직접 선택할 수 있습니다.</p>
        {issues.length > 0 && (
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {book.columns.map((column) => (
            <label key={column.id} className="min-w-0 break-words text-sm font-semibold text-slate-800">
              {column.label}
              <select className={`${inputClass} mt-1`} value={mappings[column.id] ?? ''} onChange={(e) => onMap(column.id, e.target.value)}>
                <option value="">연결할 평가 선택</option>
                {assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.task}</option>)}
                <option value={SKIP_COLUMN}>이번 교과에서 사용하지 않음</option>
              </select>
            </label>
          ))}
        </div>
      </details>
      {missing.length > 0 && (
        <p className="break-words rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          성적과 연결되지 않은 평가 {missing.length}개 · {missing.map((assessment) => assessment.task).join(', ')}
        </p>
      )}
      {rosterIssues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">{rosterIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
      <div className="min-w-0 rounded-lg border border-slate-200" role="region" aria-label="학생 명단 및 성적">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="break-words bg-slate-50 p-3 text-left font-semibold text-slate-800">
            {students.length}명{book.context ? ` · ${book.context}` : ''}
          </caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <tr>
              <th scope="col" className="w-28 p-2 sm:w-52 sm:p-3">번호 · 이름</th>
              <th scope="col" className="p-2 sm:p-3">평가별 성적</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {students.map((student) => {
              const original = originalBook?.students.find((item) => item.id === student.id);
              return (
                <tr key={student.id}>
                  <th scope="row" className="break-words p-2 align-top font-normal sm:p-3">
                    <p className="font-semibold text-slate-900">{student.number ? `${student.number}번` : '번호 확인'} {student.name || '이름 확인'}</p>
                    <details>
                      <summary className="min-h-11 cursor-pointer content-center text-sm text-blue-700">명단 수정</summary>
                      <label className="block text-slate-700">번호
                        <input className={`${inputClass} px-2`} inputMode="numeric" aria-label={`${student.sourceRow}행 번호`}
                          value={student.number} onChange={(e) => onStudent(student.id, { number: e.target.value })} />
                      </label>
                      <label className="mt-2 block text-slate-700">이름
                        <input className={`${inputClass} px-2`} aria-label={`${student.sourceRow}행 이름`}
                          value={student.name} onChange={(e) => onStudent(student.id, { name: e.target.value })} />
                      </label>
                      <button type="button" className="min-h-11 text-sm text-slate-700 underline"
                        aria-label={`${student.sourceRow}행 제외`} onClick={() => onExclude(student.id)}>명단에서 제외</button>
                    </details>
                  </th>
                  <td className="p-2 align-top sm:p-3">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2">
                      {columns.map((column) => {
                        const grade = normalizeGrade(student.grades[column.index]);
                        const originalValue = original?.grades[column.index] ?? '';
                        return (
                          <label key={column.id} className={`min-w-0 break-words rounded-md p-2 text-slate-700 ${grade ? 'bg-slate-50' : 'bg-amber-50'}`}>
                            {column.label}
                            <select className={`${inputClass} mt-1`} aria-label={`${student.number}번 ${student.name} ${column.label} 성적`}
                              value={grade ?? ''} onChange={(e) => {
                                const nextGrade = e.target.value as NeisGrade | '';
                                const grades = student.grades.map((entry, index) => index === column.index ? (nextGrade ? GRADE_LABELS[nextGrade] : '') : entry);
                                onStudent(student.id, { grades });
                              }}>
                              <option value="">확인 필요</option>
                              <option value="high">◎ 상</option>
                              <option value="middle">○ 중</option>
                              <option value="low">△ 하</option>
                            </select>
                            {(!grade || normalizeGrade(originalValue) !== grade) && <span className="mt-1 block text-xs text-slate-600">불러온 값 {originalValue || '빈칸'}</span>}
                          </label>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {excluded.length > 0 && <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
        <p>제외한 행 {excluded.length}개 · {excluded.map((row) => `${row.sourceRow}행 ${row.name}`).join(', ')}</p>
        <button className={secondaryClass} type="button" onClick={onRestore}>제외한 행 복원</button>
      </div>}
    </div>
  );
}
