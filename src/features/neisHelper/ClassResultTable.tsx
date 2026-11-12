import { useEffect, useRef, useState } from 'react';
import { countComment, GRADE_LABELS, normalizeGrade } from '../../../supabase/functions/_shared/neisHelper';
import type { GradeStudent } from '../../../supabase/functions/_shared/neisHelper';
import type { CommentDraft } from './subjectDraft';
import { inputClass, secondaryClass } from './SubjectSteps';

interface Props {
  students: GradeStudent[];
  usedColumns: number[];
  results: Record<string, CommentDraft>;
  repeats: Set<string>;
  onEdit: (id: string, text: string) => void;
  onRepeat: () => void;
  onMissing: () => void;
}

export function ClassResultTable({ students, usedColumns, results, repeats, onEdit, onRepeat, onMissing }: Props) {
  const missing = students.filter((student) => !results[student.id]?.text.trim() || results[student.id]?.error).length;
  return (
    <div className="min-w-0 space-y-4">
      {(repeats.size > 0 || missing > 0) && (
        <div className="flex flex-wrap gap-3">
          {repeats.size > 0 && <button type="button" className={secondaryClass} onClick={onRepeat}>겹치는 학생 {repeats.size}명 다시 생성</button>}
          {missing > 0 && <button type="button" className={secondaryClass} onClick={onMissing}>미생성·실패 {missing}명 다시 시도</button>}
        </div>
      )}
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <caption className="sr-only">번호순 학급 교과평어</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-700"><tr>
          <th scope="col" className="w-24 p-2 sm:w-44 sm:p-3">학생 · 성적</th>
          <th scope="col" className="p-2 sm:p-3">교과평어</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-200">
          {students.map((student) => {
            const result = results[student.id];
            const repeat = repeats.has(student.id);
            const status = result?.error ? '생성 실패' : !result?.text.trim() ? '미생성' : repeat ? '겹치는 표현 확인' : result.reviewed ? '검토 완료' : '검토 전';
            return <tr key={student.id} className={repeat || result?.error ? 'bg-amber-50' : undefined}>
              <th scope="row" className="break-words p-2 align-top font-normal sm:p-3">
                <p className="font-semibold text-slate-900">{student.number}번 {student.name}</p>
                <p className="mt-1 text-slate-600">{usedColumns.map((index) => GRADE_LABELS[normalizeGrade(student.grades[index])!]).join(' · ')}</p>
                <p className="mt-1 text-xs font-semibold text-slate-700">{status}</p>
              </th>
              <td className="p-2 align-top sm:p-3">
                {result?.error && <p className="mb-2 break-words text-sm text-red-800">{result.error}</p>}
                {result && (result.text || result.generated)
                  ? <EditableComment name={`${student.number}번 ${student.name}`} text={result.text} onEdit={(text) => onEdit(student.id, text)} />
                  : <p className="text-slate-600">평어를 받는 즉시 표시됩니다.</p>}
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function EditableComment({ name, text, onEdit }: { name: string; text: string; onEdit: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (editing) field.current?.focus(); }, [editing]);
  return (
    <>
      {editing ? (
        <textarea ref={field} rows={5} className={inputClass} aria-label={`${name} 평어`} value={text}
          onChange={(e) => onEdit(e.target.value)} />
      ) : (
        <p className="whitespace-pre-wrap break-words text-base leading-7 text-slate-900">{text || '평어를 입력해 주세요.'}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 text-sm text-slate-600">
        <span>{countComment(text).characters}자</span>
        <button ref={editButton} type="button" className="min-h-11 font-semibold text-blue-700 underline"
          aria-label={`${name} 평어 ${editing ? '수정 닫기' : '수정'}`}
          onClick={() => { setEditing(!editing); if (editing) editButton.current?.focus(); }}>
          {editing ? '수정 닫기' : '평어 수정'}
        </button>
      </div>
    </>
  );
}
