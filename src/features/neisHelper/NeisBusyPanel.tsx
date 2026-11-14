import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';

/**
 * 오래 걸리는 작업에서 지금 하는 일을 순서대로 보여 줄 문구.
 * 실제 처리 순서를 설명하는 안내이며, 서버의 현재 단계를 그대로 알려 주는 값은 아니다.
 */
const STEP_HINTS: { match: RegExp; hints: string[] }[] = [
  {
    match: /평어를 만들고/u,
    hints: [
      '학생별 성적과 평가기준을 맞춰 보고 있습니다.',
      '평가계획의 수업·평가 활동을 근거로 문장을 쓰고 있습니다.',
      '다른 학생과 시작이나 문장이 겹치지 않게 다듬고 있습니다.',
      '기재요령에 맞는 표현인지 검사하고 있습니다.',
      '검사에 걸린 평어는 자동으로 다시 쓰고 있습니다.',
    ],
  },
  {
    match: /평가계획|평가기준/u,
    hints: [
      '문서의 표와 글자를 읽고 있습니다.',
      '교과와 평가 영역을 나누고 있습니다.',
      '성취기준과 상·중·하 기준을 정리하고 있습니다.',
      '수업·평가 활동 설명을 함께 정리하고 있습니다.',
    ],
  },
  {
    match: /성적표/u,
    hints: ['학생 명단과 성적 열을 읽고 있습니다.', '성적 열을 평가계획의 평가와 연결하고 있습니다.'],
  },
];
const HINT_MS = 3500;

function elapsedLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}분 ${String(seconds % 60).padStart(2, '0')}초` : `${seconds}초`;
}

export function NeisBusyPanel({ label, progress, lastDone, onCancel }: {
  label: string;
  progress: { done: number; total: number } | null;
  /** 가장 최근에 평어가 도착한 학생 표시(예: 5번 홍길동). */
  lastDone: string;
  onCancel: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const hints = STEP_HINTS.find((item) => item.match.test(label))?.hints ?? [];
  useEffect(() => {
    setSeconds(0);
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [label]);
  const hint = hints.length ? hints[Math.floor((seconds * 1000) / HINT_MS) % hints.length] : '';
  const percent = progress?.total ? (progress.done / progress.total) * 100 : 0;
  const waiting = !progress || progress.done === 0;

  return (
    <div className="sticky top-2 z-20 mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p role="status" className="flex items-center gap-2 font-semibold text-blue-900">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 shrink-0 motion-safe:animate-spin" />
          <span>
            {label}
            {progress ? ` ${progress.done} / ${progress.total}명` : ''}
          </span>
        </p>
        <span className="text-sm tabular-nums text-blue-800">경과 {elapsedLabel(seconds)}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100" aria-hidden="true">
        {waiting ? (
          <div className="h-full w-1/3 rounded-full bg-blue-400 motion-safe:animate-[neis-busy_1.4s_ease-in-out_infinite]" />
        ) : (
          <div className="h-full bg-blue-600 transition-[width] duration-500" style={{ width: `${percent}%` }} />
        )}
      </div>
      {/* 바뀌는 안내 문구는 화면 낭독기가 반복해서 읽지 않도록 상태 알림과 분리한다. */}
      <p aria-hidden="true" className="mt-3 min-h-6 break-keep text-sm text-blue-900">
        {hint}
        {lastDone ? <span className="ml-1 text-blue-700">· 방금 {lastDone} 완료</span> : null}
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4">
        <p className="break-keep text-xs text-blue-800">잠시 걸릴 수 있습니다. 화면을 열어 둬 주세요.</p>
        <button type="button" className="min-h-[44px] text-sm font-semibold text-blue-800 underline" onClick={onCancel}>
          중단
        </button>
      </div>
    </div>
  );
}
