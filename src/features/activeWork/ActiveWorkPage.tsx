import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckSquare2,
  ClipboardList,
  FileCheck2,
  Inbox,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { isActiveWorkDemoMode } from './activeWorkProviders';
import type { ActiveWorkToolId } from './types';
import { useActiveWork } from './useActiveWork';

const ICONS: Record<ActiveWorkToolId, ComponentType<{ className?: string }>> = {
  'registry-sign': ClipboardList,
  'student-lookup': ShieldCheck,
  'notice-collect': FileCheck2,
  'data-collect': Inbox,
  'special-room': CalendarClock,
};

const formatUpdatedAt = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '최근 갱신';
  return `${date.toLocaleDateString('ko-KR')} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 갱신`;
};

export function ActiveWorkPage() {
  const navigate = useNavigate();
  const { configured, loading: authLoading, signIn, user } = useTeacherAuth();
  const { groups, failures, loading, refreshing, refresh } = useActiveWork(user?.id ?? '');
  const totalCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  const loginRequired = !user && !isActiveWorkDemoMode;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-4 border-b border-[#DCE3EA] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold text-[#0F6CBD]">한곳에서 이어서 하기</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#0F172A] sm:text-3xl">진행 중인 업무</h1>
          <p className="mt-2 text-sm text-[#526174]">각 도구에서 종료하지 않은 수합·안내·서명·예약을 모아 보여줍니다.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || refreshing}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] bg-white px-4 text-sm font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD] disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? '새로 고치는 중' : '새로고침'}
        </button>
      </div>

      {!loginRequired && failures.length > 0 ? (
        <div role="alert" className="flex items-start gap-2 border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#8A1C13]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">일부 업무를 불러오지 못했습니다.</p>
            <p className="mt-1 text-xs">{failures.map((failure) => failure.toolName).join(', ')} 목록은 해당 도구에서 다시 확인해 주세요.</p>
          </div>
        </div>
      ) : null}

      {loginRequired ? (
        <div className="border-y border-[#DCE3EA] bg-white px-6 py-20 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-[#94A3B8]" />
          <h2 className="mt-4 text-lg font-bold text-[#0F172A]">로그인하면 내 진행 업무를 확인할 수 있습니다</h2>
          <p className="mt-2 text-sm text-[#526174]">업무별 자료는 교사 계정에 나뉘어 저장됩니다.</p>
          <button
            type="button"
            onClick={() => void signIn('/')}
            disabled={!configured || authLoading}
            className="mt-5 min-h-[44px] rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
          >
            {authLoading ? '로그인 확인 중' : configured ? 'Google 로그인' : '로그인 설정 필요'}
          </button>
        </div>
      ) : loading ? (
        <div role="status" className="flex min-h-56 items-center justify-center gap-2 border-y border-[#DCE3EA] bg-white text-sm font-semibold text-[#526174]">
          <RefreshCw className="h-5 w-5 animate-spin text-[#0F6CBD]" />
          진행 중인 업무를 불러오는 중입니다.
        </div>
      ) : totalCount === 0 && failures.length > 0 ? (
        <div className="border-y border-[#FECACA] bg-white px-6 py-20 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-[#B42318]" />
          <h2 className="mt-4 text-lg font-bold text-[#0F172A]">진행 업무를 확인하지 못했습니다</h2>
          <p className="mt-2 text-sm text-[#526174]">잠시 후 다시 시도하거나 각 업무 도구의 목록에서 확인해 주세요.</p>
          <button type="button" onClick={() => void refresh()} className="mt-5 min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD] hover:bg-[#EFF6FC]">다시 시도</button>
        </div>
      ) : totalCount === 0 ? (
        <div className="border-y border-[#DCE3EA] bg-white px-6 py-20 text-center">
          <CheckSquare2 className="mx-auto h-10 w-10 text-[#94A3B8]" />
          <h2 className="mt-4 text-lg font-bold text-[#0F172A]">현재 진행 중인 업무가 없습니다</h2>
          <p className="mt-2 text-sm text-[#526174]">홈에서 필요한 업무 도구를 선택해 새 업무를 시작할 수 있습니다.</p>
          <button type="button" onClick={() => navigate('/')} className="mt-5 min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD] hover:bg-[#EFF6FC]">전체 업무 도구 보기</button>
        </div>
      ) : (
        <div className="space-y-8">
          <p className="text-sm font-semibold text-[#526174]">{groups.length}개 도구에서 {totalCount}건이 진행 중입니다.</p>
          {groups.map((group) => {
            const Icon = ICONS[group.toolId];
            return (
              <section key={group.toolId} aria-labelledby={`active-work-${group.toolId}`} className="space-y-3">
                <button
                  type="button"
                  onClick={() => navigate(group.listPath)}
                  className="group flex min-h-[56px] w-full items-center gap-3 border-y border-[#DCE3EA] bg-white px-4 py-3 text-left hover:border-[#0F6CBD] hover:bg-[#F8FBFE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6CBD]"
                  aria-label={`${group.toolName} 전체 목록으로 이동`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FC] text-[#0F6CBD]"><Icon className="h-5 w-5" /></span>
                  <span id={`active-work-${group.toolId}`} className="min-w-0 flex-1 text-base font-extrabold text-[#0F172A]">{group.toolName}</span>
                  <span className="rounded-md bg-[#EFF6FC] px-2.5 py-1 text-xs font-bold text-[#0F6CBD]">{group.items.length}건</span>
                  <span className="hidden text-xs font-bold text-[#526174] group-hover:text-[#0F6CBD] sm:inline">전체 목록</span>
                  <ArrowRight className="h-4 w-4 text-[#64748B] group-hover:text-[#0F6CBD]" />
                </button>

                <div className="grid gap-3 md:grid-cols-2">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(item.detailPath)}
                      className="rounded-lg border border-[#DCE3EA] bg-white p-5 text-left shadow-sm transition hover:border-[#0F6CBD] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6CBD]"
                      aria-label={`${item.title} ${group.toolName} 관리 화면으로 이동`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${item.overdue ? 'bg-[#FFF1F0] text-[#B42318]' : 'bg-[#E6F4EA] text-[#126B32]'}`}>{item.statusLabel}</span>
                        <span className="text-xs font-semibold text-[#526174]">{item.progressLabel}</span>
                      </div>
                      <h3 className="mt-3 line-clamp-2 min-h-12 text-base font-bold leading-6 text-[#0F172A]">{item.title}</h3>
                      <div className="mt-4 flex items-center justify-between border-t border-[#EEF1F4] pt-3">
                        <span className="text-xs text-[#64748B]">{formatUpdatedAt(item.updatedAt)}</span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0F6CBD]">관리하기 <ArrowRight className="h-3.5 w-3.5" /></span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
