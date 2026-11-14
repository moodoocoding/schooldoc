import { Check } from 'lucide-react';

export type StepStatus = 'complete' | 'current' | 'upcoming';

export interface StepItem {
  label: string;
  status: StepStatus;
}

interface StepperProps {
  /** 단계 묶음의 접근 가능한 이름. 예: "운영계획서 작성 단계" */
  label: string;
  steps: readonly StepItem[];
  /** 지정하면 완료한 단계와 현재 단계를 눌러 이동할 수 있다. */
  onSelect?: (index: number) => void;
}

const STATUS_TEXT: Record<StepStatus, string> = {
  complete: '완료',
  current: '현재 단계',
  upcoming: '대기',
};

/**
 * 여러 단계로 나뉜 작성 흐름의 진행 표시. 모든 기능이 이 모양만 쓴다.
 * 상태는 색뿐 아니라 번호·체크 표시·화면 낭독 문구로도 구분한다.
 */
export function Stepper({ label, steps, onSelect }: StepperProps) {
  return (
    <nav aria-label={label}>
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(steps.length, 1)}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const selectable = onSelect !== undefined && step.status !== 'upcoming';
          const bar = step.status === 'upcoming' ? 'border-[#DCE3EA]' : 'border-[#0F6CBD]';
          const text = step.status === 'current'
            ? 'text-[#0F6CBD]'
            : step.status === 'complete' ? 'text-[#0F172A]' : 'text-[#64748B]';
          const content = (
            <>
              <span className="flex items-start gap-1.5">
                {step.status === 'complete'
                  ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0F6CBD]" aria-hidden="true" />
                  : <span className="shrink-0" aria-hidden="true">{index + 1}.</span>}
                <span className="min-w-0 break-keep">{step.label}</span>
              </span>
              <span className="sr-only">, {STATUS_TEXT[step.status]}</span>
            </>
          );
          const shared = `flex min-h-[44px] w-full items-start border-t-4 pt-2 text-left text-sm font-bold ${bar} ${text}`;
          return (
            <li key={`${index}-${step.label}`} className="min-w-0">
              {selectable ? (
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-current={step.status === 'current' ? 'step' : undefined}
                  className={`${shared} hover:text-[#0F6CBD]`}
                >
                  {content}
                </button>
              ) : (
                <div aria-current={step.status === 'current' ? 'step' : undefined} className={shared}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
