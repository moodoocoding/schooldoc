export interface PreviewAccessUser {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
}

// Applies to the explicitly designated preview account, not other teachers' data.
// Server callers must supply the user returned by Supabase auth.getUser.
export function isVerifiedPreviewAdmin(user?: PreviewAccessUser | null): boolean {
  return Boolean(user?.id && !user.is_anonymous && user.email_confirmed_at)
    && user?.email?.trim().toLowerCase() === 'panthea0@gmail.com';
}
