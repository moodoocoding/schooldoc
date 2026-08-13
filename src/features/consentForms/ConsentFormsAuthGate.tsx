import type { ReactNode } from 'react';
import { FileCheck2, LogIn, LogOut } from 'lucide-react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { isConsentFormsDemoMode } from './consentFormsConfig';

export function ConsentFormsAuthGate({ children }: { children: ReactNode }) {
  const { configured, displayName, error, loading, signIn, signOut, user } = useTeacherAuth();
  if (isConsentFormsDemoMode) return children;
  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#526174]">로그인 상태를 확인하고 있습니다.</div>;
  if (!configured) return <div className="py-20 text-center text-sm font-semibold text-[#B42318]">Supabase 연결 정보를 확인해 주세요.</div>;
  if (!user) return (
    <div className="mx-auto grid min-h-[620px] max-w-5xl place-items-center py-10">
      <section className="w-full max-w-md border-y border-[#DCE3EA] bg-white px-6 py-10 sm:px-8">
        <FileCheck2 className="h-8 w-8 text-[#0F6CBD]" />
        <p className="mt-5 text-xs font-bold text-[#0F6CBD]">교직원 전용</p>
        <h1 className="mt-2 text-2xl font-extrabold">가정통신문 수합</h1>
        <p className="mt-3 text-sm leading-6 text-[#526174]">Google 계정으로 로그인해 가정통신문 원본과 보호자 응답을 관리하세요.</p>
        <button type="button" onClick={() => void signIn('/tools/consent-forms')} className="mt-7 inline-flex min-h-[48px] w-full items-center justify-center gap-3 rounded-lg border border-[#C8D0DA] bg-white px-5 text-sm font-bold hover:bg-[#F6F8FB]"><LogIn className="h-5 w-5 text-[#0F6CBD]" />Google로 로그인</button>
        {error ? <p role="alert" className="mt-4 text-sm font-semibold text-[#B42318]">{error}</p> : null}
      </section>
    </div>
  );
  return <><div className="mx-auto mb-2 flex min-h-[40px] w-full max-w-7xl items-center justify-end gap-2"><span className="max-w-48 truncate text-xs font-semibold text-[#526174]">{displayName}</span><button type="button" onClick={() => void signOut()} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#526174] hover:bg-white hover:text-[#0F6CBD]" aria-label="로그아웃" title="로그아웃"><LogOut className="h-4 w-4" /></button></div>{children}</>;
}
