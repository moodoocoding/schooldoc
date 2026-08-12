import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { teacherAuthRedirectUrl, teacherDisplayName } from '../../src/auth/teacherAuth';

const userWith = (metadata: Record<string, string>, email = 'teacher@example.com') => ({
  email,
  user_metadata: metadata,
}) as User;

describe('teacherDisplayName', () => {
  it('Google 전체 이름, 이름, 이메일 순서로 계정 표시명을 정한다', () => {
    expect(teacherDisplayName(userWith({ full_name: '김하늘', name: '하늘' }))).toBe('김하늘');
    expect(teacherDisplayName(userWith({ name: '이도윤' }))).toBe('이도윤');
    expect(teacherDisplayName(userWith({}))).toBe('teacher@example.com');
    expect(teacherDisplayName(null)).toBe('');
  });
});

describe('teacherAuthRedirectUrl', () => {
  it('현재 사이트의 내부 경로로 OAuth 복귀 주소를 만든다', () => {
    expect(teacherAuthRedirectUrl('https://school.example', '/')).toBe('https://school.example/');
    expect(teacherAuthRedirectUrl('http://127.0.0.1:5176/', '/tools/registry-sign'))
      .toBe('http://127.0.0.1:5176/tools/registry-sign');
  });

  it('외부 주소로 해석될 수 있는 경로는 루트로 되돌린다', () => {
    expect(teacherAuthRedirectUrl('https://school.example', '//other.example/path'))
      .toBe('https://school.example/');
    expect(teacherAuthRedirectUrl('https://school.example', 'https://other.example/path'))
      .toBe('https://school.example/');
  });
});
