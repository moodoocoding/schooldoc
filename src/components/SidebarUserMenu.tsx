import { ChevronDown, LogIn, LogOut, Settings } from 'lucide-react';
import { useId } from 'react';
import { useTeacherAuth } from '../auth/teacherAuth';

interface SidebarUserMenuProps {
  isExpanded: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}

export function SidebarUserMenu({
  isExpanded,
  isOpen,
  onOpenChange,
  onOpenSettings,
}: SidebarUserMenuProps) {
  const { configured, displayName, error, loading, signIn, signOut, user } = useTeacherAuth();
  const menuId = useId();
  const initial = displayName.trim().charAt(0) || '교';

  if (!user) {
    return (
      <div>
        <button
          type="button"
          onClick={() => void signIn('/')}
          disabled={loading || !configured}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-xl p-2 text-left text-xs font-semibold text-[#64748B] transition-colors hover:bg-white hover:text-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] disabled:cursor-not-allowed disabled:opacity-60"
          title={!isExpanded ? '로그인' : !configured ? '로그인 서버 설정이 필요합니다' : undefined}
          aria-label="Google 로그인"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFF6FC]">
            <LogIn className="h-5 w-5 text-[#0F6CBD]" />
          </div>
          {isExpanded ? (
            <span className="whitespace-nowrap text-xs font-bold text-[#334155]">
              {loading ? '확인 중' : configured ? 'Google 로그인' : '로그인 설정 필요'}
            </span>
          ) : null}
        </button>
        {isExpanded && error ? (
          <p role="alert" className="px-2 pb-1 pt-2 text-[11px] font-semibold leading-relaxed text-[#B42318]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.stopPropagation();
          onOpenChange(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className="flex min-h-[44px] w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]"
        title={!isExpanded ? `${displayName} 사용자 메뉴` : undefined}
        aria-label={`사용자 메뉴: ${displayName}`}
        aria-expanded={isOpen}
        aria-controls={menuId}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0F6CBD] text-xs font-extrabold text-white">
          {initial}
        </div>
        {isExpanded ? (
          <>
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#0F172A]">{displayName}</span>
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 text-[#64748B] transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </>
        ) : null}
      </button>

      {isOpen && isExpanded ? (
        <div id={menuId} className="mt-1 space-y-1 rounded-xl border border-[#DCE3EA] bg-white p-1.5 shadow-sm">
          <div className="border-b border-[#E8EDF2] px-2 py-2">
            <p className="truncate text-xs font-bold text-[#0F172A]">{displayName}</p>
            {user.email ? <p className="mt-0.5 truncate text-[11px] text-[#64748B]">{user.email}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onOpenSettings();
            }}
            className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-[#334155] hover:bg-[#EFF6FC] hover:text-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]"
          >
            <Settings className="h-4 w-4" />
            <span>프로필 및 설정</span>
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-[#334155] hover:bg-[#FFF1F0] hover:text-[#B42318] focus:outline-none focus:ring-2 focus:ring-[#B42318]"
          >
            <LogOut className="h-4 w-4" />
            <span>로그아웃</span>
          </button>
          {error ? (
            <p role="alert" className="px-2 py-1 text-[11px] font-semibold leading-relaxed text-[#B42318]">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
