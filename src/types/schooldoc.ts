export interface SchoolTool {
  id: string;
  name: string;
  desc: string;
  iconName: string;
  status: 'ready' | 'in_progress' | 'coming_soon';
  statusText?: string;
  activeCount?: number;
  totalCount?: number;
  warningCount?: number;
}

export type SidebarTab = 'home' | 'in_progress' | 'settings';
