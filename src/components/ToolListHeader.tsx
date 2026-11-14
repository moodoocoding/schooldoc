import type { ReactNode } from 'react';
import { PageHeader, PageHeaderBadge } from './ui/PageHeader';

interface ToolListHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action: ReactNode;
  toolbar: ReactNode;
  descriptionExtra?: ReactNode;
}

/** 모든 교사용 도구 목록이 같은 두 줄짜리 상단 구조를 쓰게 한다. */
export function ToolListHeader(props: ToolListHeaderProps) {
  return <PageHeader back={{ label: '업무 도구로', to: '/' }} {...props} />;
}

export const ToolHeaderBadge = PageHeaderBadge;
