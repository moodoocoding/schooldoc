import { createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';

export interface TeacherAuthValue {
  user: User | null;
  loading: boolean;
  error: string;
  configured: boolean;
  displayName: string;
  signIn: (redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const TeacherAuthContext = createContext<TeacherAuthValue | null>(null);

export const teacherDisplayName = (user: User | null) => (
  user?.user_metadata.full_name
  ?? user?.user_metadata.name
  ?? user?.email
  ?? ''
);

export const teacherAuthRedirectUrl = (origin: string, redirectPath: string) => {
  const safePath = redirectPath.startsWith('/') && !redirectPath.startsWith('//')
    ? redirectPath
    : '/';
  return `${origin.replace(/\/$/, '')}${safePath}`;
};

export const useTeacherAuth = () => {
  const value = useContext(TeacherAuthContext);
  if (!value) throw new Error('useTeacherAuth must be used within TeacherAuthProvider.');
  return value;
};
