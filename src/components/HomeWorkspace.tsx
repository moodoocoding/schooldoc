import React, { useState } from 'react';
import { 
  Search, Bell, LogIn, LogOut, X 
} from 'lucide-react';
import type { SchoolTool, SidebarTab, ActiveTask } from '../types/schooldoc';
import { ToolCard } from './ToolCard';

interface HomeWorkspaceProps {
  setActiveTab: (tab: SidebarTab) => void;
  allToolsMap: Record<string, SchoolTool>;
  activeTasks: ActiveTask[];
  isLoggedIn: boolean;
  onToggleLogin: () => void;
  onSelectTool: (toolId: string) => void;
  onOpenMobileMenu: () => void;
}

export const HomeWorkspace: React.FC<HomeWorkspaceProps> = ({
  setActiveTab,
  allToolsMap,
  activeTasks,
  isLoggedIn,
  onToggleLogin,
  onSelectTool,
  onOpenMobileMenu,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const allTools = Object.values(allToolsMap);

  // Filter tools based on search
  const filteredTools = allTools.filter((tool) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tool.name.toLowerCase().includes(q) ||
      tool.desc.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      
      {/* Top Bar: Clean Header with Auth Button */}
      <div className="flex items-center justify-between border-b border-[#DCE3EA] pb-4">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-[#334155] hover:bg-[#EFF6FC] rounded-lg transition-colors"
          aria-label="사이드바 메뉴 열기"
        >
          <span className="font-extrabold text-lg">☰</span>
        </button>

        <div className="hidden sm:block">
          <span className="text-xs font-semibold text-[#64748B]">
            스쿨독 스마트 교무 센터
          </span>
        </div>

        {/* Top Right Actions: Auth State (로그인 / 김교사 선생님) */}
        <div className="flex items-center gap-3">
          <button
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F6F8FB] rounded-lg relative transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]"
            aria-label="알림 목록"
          >
            <Bell className="w-5 h-5" />
          </button>

          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#F6F8FB] border border-[#DCE3EA] px-3.5 py-1.5 rounded-full min-h-[44px]">
                <div className="w-6 h-6 rounded-full bg-[#0F6CBD] text-white flex items-center justify-center text-xs font-bold">
                  김
                </div>
                <span className="text-sm font-semibold text-[#0F172A]">김교사 선생님</span>
              </div>
              <button
                onClick={onToggleLogin}
                className="text-xs font-semibold text-[#64748B] hover:text-[#B42318] p-2 flex items-center gap-1 rounded-lg min-h-[44px]"
                title="로그아웃"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onToggleLogin}
              className="bg-[#0F6CBD] hover:bg-[#0F5B9E] text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition shadow-xs flex items-center gap-1.5 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]"
            >
              <LogIn className="w-4 h-4" />
              <span>로그인</span>
            </button>
          )}
        </div>
      </div>

      {/* Greeting Section (인사 영역: 28px / 800) */}
      <section className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight leading-snug">
          오늘 어떤 업무를 도와드릴까요?
        </h1>
        <p className="text-sm text-[#334155] font-normal">
          필요한 교무 업무 도구를 검색하거나 아래 목록에서 선택해 바로 시작하세요.
        </p>
      </section>

      {/* Search Input Section (검색 영역) */}
      <section>
        <div className="relative max-w-2xl">
          <Search className="w-5 h-5 text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="가정통신문, 이수증, 특별실 등을 검색하세요"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-white border border-[#DCE3EA] text-[#0F172A] placeholder-[#64748B] text-sm font-medium focus:outline-none focus:border-[#0F6CBD] focus:ring-2 focus:ring-[#0F6CBD]/20 shadow-xs transition-all min-h-[48px]"
            aria-label="업무 도구 검색"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] rounded-full min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="검색어 지우기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* In Progress Section (실제로 진행 중인 데이터가 있을 때만 출력!) */}
      {activeTasks.length > 0 && !searchQuery && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#0F172A]">진행 중인 업무</h2>
            <button
              onClick={() => setActiveTab('in_progress')}
              className="text-xs font-semibold text-[#0F6CBD] hover:text-[#0F5B9E]"
            >
              전체 보기 ↗
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onSelectTool(task.toolId)}
                className="bg-[#EFF6FC] border border-[#0F6CBD]/20 rounded-xl p-4 flex flex-col justify-between hover:border-[#0F6CBD] transition cursor-pointer"
              >
                <div>
                  <span className="text-xs font-bold text-[#0F6CBD]">{task.toolName}</span>
                  <p className="text-sm font-semibold text-[#0F172A] mt-1">{task.title}</p>
                </div>
                <span className="text-xs font-semibold text-[#0F6CBD] pt-2">상세 보기 ↗</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tools Area (10개 카드를 직접 표시) */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0F172A]">
            전체 업무 도구 ({filteredTools.length})
          </h2>
        </div>

        {filteredTools.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-[#DCE3EA] space-y-3">
            <p className="text-base font-semibold text-[#334155]">
              "{searchQuery}"에 해당되는 도구를 찾지 못했습니다.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredTools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onSelectTool={onSelectTool}
              />
            ))}
          </div>
        )}
      </section>

    </div>
  );
};
