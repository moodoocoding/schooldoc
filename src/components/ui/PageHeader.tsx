import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export interface PageBackLink {
  /** 돌아갈 곳의 이름. 예: "업무 도구로", "등록부 목록" */
  label: string;
  /** 이동할 경로. onClick이 있으면 onClick이 우선한다. */
  to?: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  /** 생략하면 뒤로가기 줄을 그리지 않는다(최상위 화면 전용). */
  back?: PageBackLink;
  /** 뒤로가기 줄 오른쪽의 상태 표시·보조 버튼. */
  toolbar?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  descriptionExtra?: ReactNode;
  /** 제목 오른쪽 주 동작(새로 만들기 등). */
  action?: ReactNode;
}

/**
 * 교사용 화면의 공통 상단. 뒤로가기 줄과 제목 블록 두 줄로 구성한다.
 * 목록·관리·만들기 화면이 모두 같은 위치에 같은 모양의 뒤로가기와 제목을 둔다.
 */
export function PageHeader({ back, toolbar, eyebrow, title, description, descriptionExtra, action }: PageHeaderProps) {
  const navigate = useNavigate();
  const hasTopRow = back !== undefined || toolbar !== undefined;

  return (
    <>
      {hasTopRow ? (
        <div className={`flex flex-wrap items-center gap-3 border-b border-[#DCE3EA] pb-4 ${back ? 'justify-between' : 'justify-end'}`}>
          {back ? (
            <button
              type="button"
              onClick={back.onClick ?? (() => navigate(back.to ?? '/'))}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              {back.label}
            </button>
          ) : null}
          {toolbar}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-bold text-[#0F6CBD]">{eyebrow}</p> : null}
          <h1 className={`${eyebrow ? 'mt-1 ' : ''}text-2xl font-extrabold text-[#0F172A] sm:text-3xl`}>{title}</h1>
          {description ? <p className="mt-2 text-sm text-[#526174]">{description}</p> : null}
          {descriptionExtra}
        </div>
        {action}
      </div>
    </>
  );
}

/** 뒤로가기 줄 오른쪽에 두는 작은 상태 표시. */
export function PageHeaderBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-[#DCE3EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#526174]">
      {children}
    </span>
  );
}
