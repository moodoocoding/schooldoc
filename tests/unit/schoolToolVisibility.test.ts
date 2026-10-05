import { describe, expect, test } from 'vitest';
import { canViewAdminPreviewTools, getVisibleSchoolTools } from '../../src/auth/schoolToolVisibility';
import type { SchoolTool } from '../../src/types/schooldoc';

const admin = { id: 'fixture-admin', email: 'panthea0@gmail.com', email_confirmed_at: '2026-10-05T00:00:00Z', is_anonymous: false };
const teacher = { ...admin, id: 'fixture-teacher', email: 'teacher@example.invalid' };
const previewIds = ['cert-collect', 'doc-sign', 'lost-found', 'item-rent'];
const publicIds = ['class-missions', 'classroom-roles', 'student-lookup', 'notice-collect', 'registry-sign', 'data-collect', 'special-room', 'receipt-auto'];
const tools: Record<string, SchoolTool> = Object.fromEntries([...publicIds, ...previewIds].map(id => [id, {
  id, name: id, desc: '가상 도구', iconName: 'inbox', status: previewIds.includes(id) ? 'in_progress' : 'ready',
}]));

describe('개발 중 네 도구의 관리자 전용 표시', () => {
  test('확인된 기존 관리자 계정만 볼 수 있다', () => {
    expect(canViewAdminPreviewTools(admin)).toBe(true);
    expect(canViewAdminPreviewTools({ ...admin, email: ' PANTHEA0@GMAIL.COM ' })).toBe(true);
    expect(canViewAdminPreviewTools(teacher)).toBe(false);
  });

  test('로그아웃·확인 중·익명·미확인 이메일·ID 누락은 숨긴다', () => {
    for (const user of [null, undefined, { ...admin, is_anonymous: true }, { ...admin, email_confirmed_at: undefined }, { ...admin, id: '' }]) {
      expect(canViewAdminPreviewTools(user)).toBe(false);
      expect(Object.keys(getVisibleSchoolTools(tools, user))).toEqual(publicIds);
    }
    expect(canViewAdminPreviewTools(admin, true)).toBe(false);
    expect(Object.keys(getVisibleSchoolTools(tools, admin, true))).toEqual(publicIds);
  });

  test('다른 계정의 역할·프로필 입력을 관리자 권한으로 보지 않는다', () => {
    const spoofed = { ...teacher, app_metadata: { role: 'admin' }, user_metadata: { role: 'admin', email: admin.email } };
    expect(canViewAdminPreviewTools(spoofed)).toBe(false);
  });

  test('일반 도구의 순서·설정과 원본 목록은 바꾸지 않는다', () => {
    const visible = getVisibleSchoolTools(tools, teacher);
    expect(Object.keys(visible)).toEqual(publicIds);
    for (const id of publicIds) expect(visible[id]).toBe(tools[id]);
    expect(Object.keys(tools)).toHaveLength(12);
    expect(getVisibleSchoolTools(tools, admin)).toEqual(tools);
  });
});
