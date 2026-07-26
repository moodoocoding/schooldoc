import React from 'react';
import { Home, Clock, CheckCircle2, Users, Settings, MessageSquarePlus, X } from 'lucide-react';
import type { SidebarTab } from '../types/schooldoc';

interface SidebarProps {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  onOpenSuggestionModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile,
  setIsOpenMobile,
  onOpenSuggestionModal,
}) => {
  const navItems: { id: SidebarTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: '홈', icon: Home },
    { id: 'in_progress', label: '진행 중', icon: Clock },
    { id: 'completed', label: '완료', icon: CheckCircle2 },
    { id: 'roster', label: '학급 명단', icon: Users },
    { id: 'settings', label: '설정', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#FFFFFF] border-r border-[#DCE3EA] w-64 select-none">
      {/* Header / Logo */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-[#DCE3EA]">
        <button
          onClick={() => {
            setActiveTab('home');
            setIsOpenMobile(false);
          }}
          className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] rounded-lg p-1"
          aria-label="스쿨독 홈으로 이동"
        >
          <div className="w-8 h-8 bg-[#0F6CBD] rounded-lg flex items-center justify-center text-white font-extrabold text-sm shadow-xs group-hover:bg-[#0F5B9E] transition-colors">
            SD
          </div>
          <span className="font-extrabold text-lg text-[#0F172A] tracking-tight">
            스쿨독
          </span>
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={() => setIsOpenMobile(false)}
          className="md:hidden p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F6F8FB] rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="메뉴 닫기"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Status-Based Navigation List */}
      <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto" aria-label="주 메뉴">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpenMobile(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all min-h-[44px] text-left ${
                isActive
                  ? 'bg-[#EFF6FC] text-[#0F6CBD] font-bold shadow-xs'
                  : 'text-[#334155] hover:bg-[#F6F8FB] hover:text-[#0F172A]'
              } focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#0F6CBD]' : 'text-[#64748B]'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Footer Link: 선생님 제안함 */}
      <div className="p-4 border-t border-[#DCE3EA] bg-[#F6F8FB]">
        <button
          onClick={onOpenSuggestionModal}
          className="w-full flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#0F6CBD] transition-colors p-2 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]"
        >
          <MessageSquarePlus className="w-4 h-4 text-[#0F6CBD]" />
          <span>선생님 제안함</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block w-64 h-screen sticky top-0 flex-shrink-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isOpenMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpenMobile(false)}
            aria-hidden="true"
          />
          <div className="relative flex-1 max-w-xs w-full bg-white shadow-2xl z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
