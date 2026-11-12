export interface SchoolTool {
  id: string;
  name: string;
  desc: string;
  iconName: string;
  status: 'ready' | 'in_progress' | 'coming_soon';
  statusText?: string;
  /** 개발 중에도 기능 안내 화면을 열 수 있는 도구. 실제 기능의 준비 상태와 구분한다. */
  previewAvailable?: boolean;
  activeCount?: number;
  totalCount?: number;
  warningCount?: number;
}

export type SidebarTab = 'home' | 'in_progress' | 'settings';
