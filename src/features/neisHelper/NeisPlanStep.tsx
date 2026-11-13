import { ELEMENTARY_SUBJECTS } from './autoPipeline';
import { PLAN_ACCEPT } from './subjectFiles';
import type { PlanMode } from './subjectDraft';
import { SubjectFilePicker } from './SubjectFilePicker';
import { inputClass } from './SubjectSteps';

const modes: { value: PlanMode; title: string; description: string }[] = [
  {
    value: 'subject',
    title: '교과별 평가계획',
    description: '교과를 먼저 고르고 그 교과의 평가계획 파일을 넣습니다.',
  },
  {
    value: 'whole',
    title: '전체 평가계획',
    description: '학년 전체 평가계획을 넣으면 교과별로 나누어 정리합니다.',
  },
];

export function NeisPlanStep({
  mode,
  chosenSubject,
  file,
  disabled,
  onMode,
  onSubject,
  onFiles,
}: {
  mode: PlanMode;
  chosenSubject: string;
  file: File | null;
  disabled: boolean;
  onMode: (mode: PlanMode) => void;
  onSubject: (subject: string) => void;
  onFiles: (files: FileList | null) => void;
}) {
  const custom = !!chosenSubject && !ELEMENTARY_SUBJECTS.includes(chosenSubject);
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">평가계획 넣는 방법</legend>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-3">
          {modes.map((item) => (
            <label
              key={item.value}
              className={`flex min-h-[96px] cursor-pointer items-start gap-3 rounded-xl border-2 p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-600 ${
                mode === item.value ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-400'
              }`}
            >
              <input
                type="radio"
                name="neis-plan-mode"
                className="mt-1 h-5 w-5 shrink-0 accent-blue-700"
                checked={mode === item.value}
                disabled={disabled}
                onChange={() => onMode(item.value)}
              />
              <span>
                <span className="block font-bold text-slate-900">{item.title}</span>
                <span className="mt-1 block break-keep text-sm leading-6 text-slate-600">{item.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {mode === 'subject' && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
          <label className="block text-sm font-semibold text-slate-800">
            교과
            <select
              aria-label="교과"
              className={`${inputClass} mt-2`}
              value={custom ? '__custom__' : chosenSubject}
              disabled={disabled}
              onChange={(e) => onSubject(e.target.value === '__custom__' ? ' ' : e.target.value)}
            >
              <option value="">선택하세요</option>
              {ELEMENTARY_SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
              <option value="__custom__">직접 입력</option>
            </select>
          </label>
          {custom && (
            <label className="block text-sm font-semibold text-slate-800">
              과목명 직접 입력
              <input
                aria-label="과목명 직접 입력"
                className={`${inputClass} mt-2`}
                maxLength={40}
                value={chosenSubject.trim()}
                disabled={disabled}
                onChange={(e) => onSubject(e.target.value || ' ')}
              />
            </label>
          )}
        </div>
      )}
      <SubjectFilePicker
        label="평가계획 파일"
        accept={PLAN_ACCEPT}
        file={file}
        disabled={disabled}
        onSelect={onFiles}
      />
      <p className="text-sm leading-6 text-slate-600">PDF·HWP 5.0·HWPX · 최대 10MB, 80쪽</p>
      <p className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        평가계획 분석을 누르면 PDF를 OpenAI로 전송합니다. HWP·HWPX는 이 브라우저에서 PDF로 변환한 뒤
        전송합니다.
      </p>
    </div>
  );
}
