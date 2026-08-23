import { CalendarClock, LogIn } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { isSpecialRoomsDemoMode } from './specialRoomsConfig';

export function SpecialRoomsAuthGate({ children }: { children: ReactNode }) {
  const { configured, error, loading, signIn, user } = useTeacherAuth();

  if (isSpecialRoomsDemoMode) return children;
  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#526174]">로그인 상태를 확인하고 있습니다.</div>;
  if (!configured) return <div className="py-20 text-center text-sm font-semibold text-[#B42318]">Supabase 연결 정보를 확인해 주세요.</div>;
  if (!user) {
    return (
      <div className="mx-auto grid min-h-[620px] max-w-5xl place-items-center py-10">
        <section className="w-full max-w-md border-y border-[#DCE3EA] bg-white px-6 py-10 sm:px-8">
          <CalendarClock className="h-8 w-8 text-[#0F6CBD]" />
          <p className="mt-5 text-xs font-bold text-[#0F6CBD]">교직원 전용</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#0F172A]">특별실 예약</h1>
          <p className="mt-3 text-sm leading-6 text-[#526174]">Google 계정으로 로그인해 특별실 예약표와 예약 현황을 관리하세요.</p>
          <button
            type="button"
            onClick={() => void signIn('/tools/special-rooms')}
            className="mt-7 inline-flex min-h-[48px] w-full items-center justify-center gap-3 rounded-lg border border-[#C8D0DA] bg-white px-5 text-sm font-bold hover:bg-[#F6F8FB]"
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
