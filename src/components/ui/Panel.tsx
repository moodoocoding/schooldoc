import type { HTMLAttributes, ReactNode } from 'react';

export const panelClass = 'rounded-lg border border-[#DCE3EA] bg-white';

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** 패널 제목. 있으면 h2로 표시한다. */
  title?: ReactNode;
  description?: ReactNode;
  /** 제목 줄 오른쪽에 두는 보조 동작. */
  actions?: ReactNode;
  /** 표처럼 가장자리까지 채우는 내용이면 false. */
  padded?: boolean;
  children?: ReactNode;
}

/** 교사용 화면의 기본 카드. 모든 기능이 같은 모서리·테두리·여백을 쓴다. */
export function Panel({ title, description, actions, padded = true, className, children, ...props }: PanelProps) {
  const hasHeader = title !== undefined || description !== undefined || actions !== undefined;
  return (
    <section className={[panelClass, padded ? 'p-5 sm:p-6' : '', className ?? ''].filter(Boolean).join(' ')} {...props}>
      {hasHeader ? (
        <div className={`flex flex-wrap items-start justify-between gap-3 ${padded ? '' : 'px-5 pt-5 sm:px-6 sm:pt-6'}`}>
          <div className="min-w-0">
            {title !== undefined ? <h2 className="text-lg font-bold text-[#0F172A]">{title}</h2> : null}
            {description !== undefined ? <p className="mt-1 text-sm text-[#526174]">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {hasHeader && children ? <div className={padded ? 'mt-5' : 'mt-4'}>{children}</div> : children}
    </section>
  );
}
