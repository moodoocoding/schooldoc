import type { ReactNode } from 'react';
import { FolderLock, LogIn, LogOut } from 'lucide-react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { isDataCollectDemoMode, isDataCollectDeveloper } from './dataCollectConfig';

export function DataCollectAuthGate({ children }: { children: ReactNode }) {
  const { configured, error, loading, signIn, signOut, user } = useTeacherAuth();
  if (isDataCollectDemoMode) return children;
  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#526174]">로그인 상태를 확인하고 있습니다.</div>;
  if (!configured) return <div className="py-20 text-center text-sm font-semibold text-[#B42318]">Supabase 연결 정보를 확인해 주세요.</div>;
  if (!user) return (
    <div className="mx-auto grid min-h-[620px] max-w-5xl place-items-center py-10">
      <section className="w-full max-w-md border-y border-[#DCE3EA] bg-white px-6 py-10 sm:px-8">
        <FolderLock className="h-8 w-8 text-[#0F6CBD]" />
        <p className="mt-5 text-xs font-bold text-[#0F6CBD]">교직원 전용</p>
        <h1 className="mt-2 text-2xl font-extrabold">자료 수합</h1>
        <p className="mt-3 text-sm leading-6 text-[#526174]">Google 계정으로 로그인해 배포 파일과 제출 현황을 관리하세요.</p>
        <button type="button" onClick={() => void signIn('/tools/data-collect')} className="mt-7 inline-flex min-h-[48px] w-full items-center justify-center gap-3 rounded-lg border border-[#C8D0DA] bg-white px-5 text-sm font-bold hover:bg-[#F6F8FB]"><LogIn className="h-5 w-5 text-[#0F6CBD]" />Google로 로그인</button>
        {error ? <p role="alert" className="mt-4 text-sm font-semibold text-[#B42318]">{error}</p> : null}
      </section>
    </div>
  );
  if (!isDataCollectDeveloper(user)) return (
    <div className="mx-auto grid min-h-[620px] max-w-5xl place-items-center py-10">
      <section className="w-full max-w-md border-y border-[#DCE3EA] bg-white px-6 py-10 text-center sm:px-8">
        <FolderLock className="mx-auto h-8 w-8 text-[#0F6CBD]" />
        <p className="mt-5 text-xs font-bold text-[#0F6CBD]">개발자 미리보기</p>
        <h1 className="mt-2 text-2xl font-extrabold">자료 수합을 준비 중입니다</h1>
        <p className="mt-3 text-sm leading-6 text-[#526174]">현재는 지정된 개발자 계정에서만 자료 수합을 확인할 수 있습니다.</p>
        <button type="button" onClick={() => void signOut()} className="mt-7 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] px-5 text-sm font-bold text-[#526174] hover:bg-[#F6F8FB]"><LogOut className="h-4 w-4" />다른 계정으로 로그인</button>
      </section>
    </div>
  );
  return children;
}
