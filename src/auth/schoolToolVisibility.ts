import type { User } from '@supabase/supabase-js';
import type { SchoolTool } from '../types/schooldoc';

// 기존 운영 관리자 계정만 개발 중 도구를 볼 수 있다. 개발 모드나 변경 가능한
// user_metadata는 판별에 쓰지 않는다. 이 규칙은 메뉴 표시용이며 API 권한이 아니다.
const adminEmail = 'panthea0@gmail.com';
const adminPreviewToolIds = new Set(['cert-collect', 'doc-sign', 'lost-found', 'item-rent']);
type ToolVisibilityUser = Pick<User, 'id' | 'email' | 'email_confirmed_at' | 'is_anonymous'>;

export function canViewAdminPreviewTools(user?: ToolVisibilityUser | null, authLoading = false) {
  return !authLoading
    && Boolean(user?.id && !user.is_anonymous && user.email_confirmed_at)
    && user?.email?.trim().toLowerCase() === adminEmail;
}

export function getVisibleSchoolTools(
  tools: Record<string, SchoolTool>,
  user?: ToolVisibilityUser | null,
  authLoading = false,
): Record<string, SchoolTool> {
  const canViewPreviews = canViewAdminPreviewTools(user, authLoading);
  return Object.fromEntries(Object.entries(tools).filter(
    ([id]) => canViewPreviews || !adminPreviewToolIds.has(id),
  ));
}
