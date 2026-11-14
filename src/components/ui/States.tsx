import { AlertCircle, AlertTriangle, CheckCircle2, Info, LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { panelClass } from './Panel';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** 다음에 할 일을 바로 시작하는 버튼. */
  action?: ReactNode;
}

/** 목록·검색 결과가 비었을 때. 무엇이 없는지와 다음 행동을 함께 보여 준다. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={`${panelClass} flex flex-col items-center px-6 py-16 text-center`}>
      {Icon ? <Icon className="h-8 w-8 text-[#64748B]" aria-hidden="true" /> : null}
      <h2 className={`${Icon ? 'mt-4 ' : ''}text-lg font-bold text-[#0F172A]`}>{title}</h2>
      {description ? <p className="mt-2 max-w-md text-sm text-[#526174]">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export const DEFAULT_LOADING_MESSAGE = '불러오는 중입니다.';

interface LoadingStateProps {
  message?: string;
  /** 패널 안에 끼워 넣을 때는 false로 테두리 없이 표시한다. */
  framed?: boolean;
}

/** 데이터를 불러오는 동안. 문구는 기본값을 쓰고 필요할 때만 바꾼다. */
export function LoadingState({ message = DEFAULT_LOADING_MESSAGE, framed = true }: LoadingStateProps) {
  return (
    <div role="status" className={`${framed ? `${panelClass} ` : ''}flex items-center justify-center gap-2 px-6 py-16 text-sm font-semibold text-[#526174]`}>
      <LoaderCircle className="h-5 w-5 animate-spin text-[#0F6CBD]" aria-hidden="true" />
      {message}
    </div>
  );
}

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

const NOTICE_STYLES: Record<NoticeTone, { box: string; icon: LucideIcon; iconColor: string }> = {
  info: { box: 'border-[#BFDBFE] bg-[#EFF6FC] text-[#0F172A]', icon: Info, iconColor: 'text-[#0F6CBD]' },
  success: { box: 'border-[#B7DFC3] bg-[#E6F4EA] text-[#0F172A]', icon: CheckCircle2, iconColor: 'text-[#126B32]' },
  warning: { box: 'border-[#F5D58A] bg-[#FFF8E6] text-[#0F172A]', icon: AlertTriangle, iconColor: 'text-[#9A5B00]' },
  danger: { box: 'border-[#F4C7C3] bg-[#FEF2F2] text-[#0F172A]', icon: AlertCircle, iconColor: 'text-[#B42318]' },
};

interface NoticeProps {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  /** 다시 시도 등 회복 동작. */
  action?: ReactNode;
}

/**
 * 안내·성공·주의·오류 문구. 오류와 주의는 화면 낭독기가 바로 읽도록 alert로 알린다.
 * 상태는 색뿐 아니라 아이콘과 문구로 함께 전달한다.
 */
export function Notice({ tone = 'info', title, children, action }: NoticeProps) {
  const style = NOTICE_STYLES[tone];
  const Icon = style.icon;
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'} className={`flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3 text-sm ${style.box}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div className={title ? 'mt-1 text-[#334155]' : 'text-[#334155]'}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
