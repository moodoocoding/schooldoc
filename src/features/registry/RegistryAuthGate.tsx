import { type ReactNode } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { isRegistryDemoMode } from './registryConfig';

export function RegistryAuthGate({ children }: { children: ReactNode }) {
  const { configured, error, loading, signIn, user } = useTeacherAuth();

  if (isRegistryDemoMode) return children;

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl border-y border-[#DCE3EA] bg-white px-6 py-16 text-center">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#B9D9F2] border-t-[#0F6CBD]" />
        <p className="mt-4 text-sm font-semibold text-[#526174]">로그인 상태를 확인하고 있습니다.</p>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="mx-auto max-w-3xl border-y border-[#DCE3EA] bg-white px-6 py-14 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-[#94A3B8]" />
        <h1 className="mt-4 text-xl font-extrabold text-[#0F172A]">서버 연결 정보를 확인해 주세요</h1>
        <p className="mt-2 text-sm text-[#526174]">관리자에게 Supabase 환경 설정을 요청해 주세요.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto grid min-h-[620px] max-w-5xl place-items-center py-10">
        <section className="w-full max-w-md border-y border-[#DCE3EA] bg-white px-6 py-10 sm:px-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EFF6FC] text-[#0F6CBD]">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <p className="mt-6 text-xs font-bold text-[#0F6CBD]">교직원 전용</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#0F172A]">등록부 서명 관리</h1>
          <p className="mt-3 text-sm leading-6 text-[#526174]">Google 계정으로 로그인해 등록부를 만들고 서명 현황을 관리하세요.</p>
          <button
            type="button"
            onClick={() => void signIn('/tools/registry-sign')}
            className="mt-7 inline-flex min-h-[48px] w-full items-center justify-center gap-3 rounded-lg border border-[#C8D0DA] bg-white px-5 text-sm font-bold text-[#0F172A] hover:bg-[#F6F8FB]"
          >
            <LogIn className="h-5 w-5 text-[#0F6CBD]" />
            Google로 로그인
          </button>
          {error ? <p role="alert" className="mt-4 text-sm font-semibold text-[#B42318]">{error}</p> : null}
        </section>
      </div>
    );
  }

  return children;
}
