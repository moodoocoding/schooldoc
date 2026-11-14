import type { ReactNode } from 'react';

export type PageWidth = 'narrow' | 'default' | 'full';

/*
 * 페이지 너비는 세 가지만 쓴다.
 * - narrow: 한 열 입력 화면(새로 만들기 등)
 * - default: 목록·관리·현황 화면
 * - full: 원본 문서와 편집 패널을 나란히 두는 편집 화면
 * 세로 스크롤은 문서 하나가 맡으므로 여기서 높이나 overflow를 정하지 않는다.
 */
const WIDTHS: Record<PageWidth, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-7xl',
  full: 'max-w-[1500px]',
};

interface PageShellProps {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}

export function PageShell({ width = 'default', className, children }: PageShellProps) {
  return (
    <div className={['mx-auto w-full space-y-6', WIDTHS[width], className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
