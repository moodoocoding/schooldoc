export interface TimetableSlot {
  day: number; // 1 (Mon) to 5 (Fri)
  period: number; // 1 to 7 period
  subject: string;
  room: string;
}

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  author: string;
  category: 'free' | 'admin' | 'lessons' | 'market';
  createdAt: string;
  likes: number;
  commentsCount: number;
}

export interface CommunityComment {
  id: string;
  postId: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface StudentInfo {
  id: string;
  name: string;
  gender: 'M' | 'F';
  notes?: string;
}

export interface DocTemplate {
  id: string;
  title: string;
  description: string;
  category: '행정' | '학급경영' | '수업' | '가정통신';
  fileSize: string;
  fileType: 'HWP' | 'XLSX' | 'PDF' | 'DOCX';
}
