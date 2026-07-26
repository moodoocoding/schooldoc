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

export interface ActiveTask {
  id: string;
  toolId: string;
  toolName: string;
  title: string;
  statusText: string;
  updatedAt: string;
  progressPercent?: number;
}

export type SidebarTab = 'home' | 'in_progress' | 'settings';

export interface StudentInfo {
  id: number | string;
  name: string;
  gender?: string;
  seatNumber?: number;
}

export interface CommunityComment {
  id: string;
  postId?: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  category: string;
  author: string;
  createdAt: string;
  likes: number;
  commentsCount?: number | any;
  comments?: CommunityComment[] | any;
}

export interface DocTemplate {
  id: string;
  title: string;
  desc?: string;
  description?: string | any;
  category: string;
  fileFormat?: string;
  fileType?: string | any;
  fileSize?: string | any;
}

export interface TimetableSlot {
  day: string | number;
  period: number;
  subject: string;
  room?: string;
}
