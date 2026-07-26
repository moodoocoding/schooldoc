import React, { useState } from 'react';
import { 
  Search, Bell, Clock, ArrowRight, X 
} from 'lucide-react';
import type { SchoolTool, SidebarTab } from '../types/schooldoc';
import { ToolCard } from './ToolCard';

interface HomeWorkspaceProps {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  onSelectTool: (toolId: string) => void;
  onOpenMobileMenu: () => void;
}

export const HomeWorkspace: React.FC<HomeWorkspaceProps> = ({
  activeTab,
  setActiveTab,
  onSelectTool,
  onOpenMobileMenu,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 10 Core Services matched EXACTLY with user specification
  const allTools: SchoolTool[] = [
    {
      id: 'student-lookup',
      name: '학생 결과 안내',
      desc: '엑셀을 올리고 학생별 결과를 안전하게 안내합니다.',
      iconName: 'shield-check',
      status: 'ready',
    },
    {
      id: 'notice-collect',
      name: '가정통신문 수합',
      desc: '가정통신문의 응답과 보호자 서명을 온라인으로 받습니다.',
      iconName: 'file-signature',
      status: 'in_progress',
      statusText: '응답 28/30명 (미응답 2명)',
      activeCount: 28,
      totalCount: 30,
    },
    {
      id: 'registry-sign',
      name: '등록부 서명',
      desc: '회의와 행사 참석자의 서명을 받아 등록부를 완성합니다.',
      iconName: 'clipboard-list',
      status: 'in_progress',
      statusText: '서명 완료 18/20명',
      activeCount: 18,
      totalCount: 20,
    },
    {
      id: 'data-collect',
      name: '자료 수합',
      desc: '필요한 제출 항목을 만들고 파일과 응답을 한곳에서 받습니다.',
      iconName: 'inbox',
      status: 'ready',
    },
    {
      id: 'doc-sign',
      name: '문서 서명',
      desc: 'PDF의 서명 위치를 지정하고 비대면 서명을 받습니다.',
      iconName: 'file-pen',
      status: 'ready',
    },
    {
      id: 'receipt-auto',
      name: '영수증 정리',
      desc: '영수증을 촬영하면 금액과 상호명을 인식해 표로 정리합니다.',
      iconName: 'receipt',
      status: 'in_progress',
      statusText: '검토 필요 3건',
      warningCount: 3,
    },
    {
      id: 'cert-collect',
      name: '이수증 수합',
      desc: '연수 이수증을 모으고 연수명과 이수 시간을 자동 집계합니다.',
      iconName: 'award',
      status: 'ready',
    },
    {
      id: 'special-room',
      name: '특별실 예약',
      desc: '특별실의 사용 가능 시간을 확인하고 예약합니다.',
      iconName: 'calendar-clock',
      status: 'ready',
      statusText: '오늘 예약 4건',
    },
    {
      id: 'lost-found',
      name: '분실물 관리',
      desc: '습득물 사진과 장소를 등록하고 반환 상태를 관리합니다.',
      iconName: 'package-search',
      status: 'ready',
      statusText: '보관 중 6건',
    },
    {
      id: 'item-rent',
      name: '물품 대여',
      desc: '공용 물품의 대여자와 반납 예정일을 관리합니다.',
      iconName: 'package-check',
      status: 'ready',
      statusText: '대여 중 7건',
    },
  ];

  // Filter tools based on search
  const filteredTools = allTools.filter((tool) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tool.name.toLowerCase().includes(q) ||
      tool.desc.toLowerCase().includes(q)
    );
  });

  // Tasks in progress (max 3)
  const tasksInProgress = allTools.filter(t => t.status === 'in_progress' || t.statusText).slice(0, 3);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      
      {/* Top Bar: Clean & Uncluttered Header */}
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

        {/* Notification & User Profile */}
        <div className="flex items-center gap-3">
          <button
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F6F8FB] rounded-lg relative transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]"
            aria-label="알림 2건 존재함"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#B42318] rounded-full"></span>
          </button>

          <div className="flex items-center gap-2 bg-[#F6F8FB] border border-[#DCE3EA] px-3.5 py-1.5 rounded-full min-h-[44px]">
            <div className="w-6 h-6 rounded-full bg-[#0F6CBD] text-white flex items-center justify-center text-xs font-bold">
              김
            </div>
            <span className="text-sm font-semibold text-[#0F172A]">김교사 선생님</span>
          </div>
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

      {/* In Progress Section (진행 영역: 최대 3개 표시) */}
      {activeTab === 'home' && !searchQuery && tasksInProgress.length > 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#0F6CBD]" />
              <span>진행 중인 업무</span>
            </h2>
            <button
              onClick={() => setActiveTab('in_progress')}
              className="text-xs font-semibold text-[#0F6CBD] hover:text-[#0F5B9E] flex items-center gap-1 min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] rounded-lg"
            >
              <span>전체 보기</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tasksInProgress.map((task) => (
              <div
                key={task.id}
                onClick={() => onSelectTool(task.id)}
                className="bg-[#EFF6FC] border border-[#0F6CBD]/20 rounded-xl p-4 flex flex-col justify-between hover:border-[#0F6CBD] transition-all cursor-pointer group shadow-xs min-h-[120px]"
              >
                <div>
                  <span className="text-xs font-bold text-[#0F6CBD] block mb-1">
                    {task.name}
                  </span>
                  <p className="text-sm font-semibold text-[#0F172A] line-clamp-1">
                    {task.statusText}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-[#0F6CBD] pt-2">
                  <span>작성 진행 확인</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tools Area (도구 영역: 10개 카드를 직접 표시) */}
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
            <p className="text-xs text-[#64748B]">
              가정통신문, 성적, 특별실, 이수증 등 다른 키워드로 검색해 보세요.
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
