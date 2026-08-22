import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface ToolListHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action: ReactNode;
  toolbar: ReactNode;
  descriptionExtra?: ReactNode;
}

/** 모든 교사용 도구 목록이 같은 두 줄짜리 상단 구조를 쓰게 한다. */
export function ToolListHeader({
  eyebrow,
  title,
  description,
  action,
  toolbar,
  descriptionExtra,
}: ToolListHeaderProps) {
  const navigate = useNavigate();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EA] pb-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"
        >
          <ArrowLeft className="h-5 w-5" />
          업무 도구로
        </button>
        {toolbar}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold text-[#0F6CBD]">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#0F172A] sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-[#526174]">{description}</p>
          {descriptionExtra}
        </div>
        {action}
      </div>
    </>
  );
}

export function ToolHeaderBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-[#DCE3EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#526174]">
      {children}
    </span>
  );
}
