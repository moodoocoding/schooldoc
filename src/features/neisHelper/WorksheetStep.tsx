import { useState } from 'react';
import { NEIS_MAX_TASK_CONTEXT } from '../../../supabase/functions/_shared/neisHelper';
import type { Assessment } from '../../../supabase/functions/_shared/neisHelper';
import type { AssessmentWorksheet } from './subjectDraft';
import { PLAN_ACCEPT } from './subjectFiles';
import { inputClass, secondaryClass } from './SubjectSteps';
import { SubjectFilePicker } from './SubjectFilePicker';
import { NeisSourcePreview } from './NeisSourcePreview';

interface WorksheetStepProps {
  assessments: Assessment[];
  assessmentId: string;
  worksheets: Record<string, AssessmentWorksheet>;
  disabled: boolean;
  onAssessment: (id: string) => void;
  onFiles: (files: FileList | null) => void;
  onContext: (value: string) => void;
  onRemove: () => void;
}

export function WorksheetStep({
  assessments, assessmentId, worksheets, disabled, onAssessment, onFiles, onContext, onRemove,
}: WorksheetStepProps) {
  const worksheet = worksheets[assessmentId];

  return (
    <div className="space-y-5">
      <label className="block max-w-xl text-sm font-semibold text-slate-800">
        평가지를 연결할 평가
        <select className={`${inputClass} mt-2`} value={assessmentId} onChange={(e) => onAssessment(e.target.value)}>
          {assessments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.task}{worksheets[item.id]?.warning ? ' · 대조 필요' : worksheets[item.id] ? ' · 평가지 추가됨' : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="min-w-0 space-y-4">
          <SubjectFilePicker
            label="평가지 파일"
            accept={PLAN_ACCEPT}
            file={worksheet?.file ?? null}
            disabled={disabled}
            onSelect={onFiles}
          />
          <p className="text-sm leading-6 text-slate-600">PDF·HWP 5.0·HWPX · 최대 10MB, 80쪽</p>
          {worksheet && <WorksheetDetails key={`${assessmentId}-${worksheet.file.name}-${worksheet.file.lastModified}`} worksheet={worksheet} onContext={onContext} onRemove={onRemove} />}
      </div>
    </div>
  );
}

function WorksheetDetails({ worksheet, onContext, onRemove }: Pick<WorksheetStepProps, 'onContext' | 'onRemove'> & { worksheet: AssessmentWorksheet }) {
  const [open, setOpen] = useState(!!worksheet.warning);
  return (
    <details className="rounded-lg border border-slate-200 p-3" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-slate-900">
        {worksheet.warning ? '대조 필요 · ' : ''}평가지 문항·원본 보기
      </summary>
      {worksheet.warning && <p className="mb-3 text-sm text-amber-900">{worksheet.warning}</p>}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
              <label className="block text-sm font-semibold text-slate-800">
                평어에 참고할 문항·과제 조건
                <textarea
                  value={worksheet.taskContext}
                  onChange={(e) => onContext(e.target.value)}
                  rows={4}
                  maxLength={NEIS_MAX_TASK_CONTEXT}
                  aria-describedby="worksheet-context-help"
                  className={`${inputClass} mt-2`}
                />
              </label>
              <p id="worksheet-context-help" className="text-sm leading-6 text-slate-600">
                여기에 입력한 내용만 평어 생성 시 OpenAI로 전송합니다. 학생 이름과 답안은 제외해 주세요.
                최대 {NEIS_MAX_TASK_CONTEXT.toLocaleString('ko-KR')}자입니다.
              </p>
              {worksheet.text ? (
                <details className="rounded-lg border border-slate-200 p-3">
                  <summary className="min-h-[44px] cursor-pointer content-center text-sm font-semibold text-blue-700">
                    평가지에서 읽은 텍스트 보기
                  </summary>
                  <p className="whitespace-pre-wrap break-words py-3 text-sm leading-6 text-slate-700">{worksheet.text}</p>
                  {!worksheet.taskContext && worksheet.text.length <= NEIS_MAX_TASK_CONTEXT && (
                    <button type="button" className={secondaryClass} onClick={() => onContext(worksheet.text)}>
                      읽은 텍스트 입력칸에 넣기
                    </button>
                  )}
                </details>
              ) : (
                <p className="text-sm leading-6 text-slate-600">텍스트를 읽지 못했습니다. 지면에서 문항을 확인해 입력할 수 있습니다.</p>
              )}
              <button type="button" className={secondaryClass} onClick={onRemove}>평가지 제거</button>
        </div>
        {open && (
          <NeisSourcePreview
            file={worksheet.file}
            convertedFile={worksheet.convertedFile}
            allowPageSelection
          />
        )}
      </div>
    </details>
  );
}
