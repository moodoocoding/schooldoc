import React, { useState } from 'react';
import { 
  Home, Clock, Settings, Plus, MessageSquarePlus, X, Trash2, Pin 
} from 'lucide-react';
import type { SidebarTab, SchoolTool } from '../types/schooldoc';
import { getToolIcon } from './ToolCard';

interface SidebarProps {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  quickMenuIds: string[];
  allToolsMap: Record<string, SchoolTool>;
  onSelectTool: (toolId: string) => void;
  onAddQuickMenu: (toolId: string) => void;
  onRemoveQuickMenu: (toolId: string) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  onOpenSuggestionModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  quickMenuIds,
  allToolsMap,
  onSelectTool,
  onAddQuickMenu,
  onRemoveQuickMenu,
  isOpenMobile,
  setIsOpenMobile,
  onOpenSuggestionModal,
}) => {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isOpenQuickAddModal, setIsOpenQuickAddModal] = useState<boolean>(false);

  const mainNavs: { id: SidebarTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: '홈', icon: Home },
    { id: 'in_progress', label: '진행 중', icon: Clock },
    { id: 'settings', label: '설정', icon: Settings },
  ];

  const availableQuickTools = Object.values(allToolsMap).filter(
    (t) => !quickMenuIds.includes(t.id)
  );

  const sidebarContent = (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`flex flex-col h-full bg-[#FFFFFF] border-r border-[#DCE3EA] shadow-sm select-none transition-all duration-300 ease-in-out ${
        isHovered ? 'w-64' : 'w-16'
      } overflow-hidden`}
    >
      {/* Header / Logo */}
      <div className="h-16 flex items-center px-4 border-b border-[#DCE3EA] justify-between">
        <button
          onClick={() => {
            setActiveTab('home');
            setIsOpenMobile(false);
          }}
          className="flex items-center gap-3 group focus:outline-none rounded-lg"
          aria-label="스쿨독 홈으로 이동"
        >
          <div className="w-9 h-9 bg-[#0F6CBD] rounded-lg flex items-center justify-center text-white font-extrabold text-sm shadow-xs group-hover:bg-[#0F5B9E] transition-colors flex-shrink-0">
            SD
          </div>
          {isHovered && (
            <span className="font-extrabold text-lg text-[#0F172A] tracking-tight whitespace-nowrap animate-fade-in">
              스쿨독
            </span>
          )}
        </button>

        {/* Mobile Close Button */}
        {isOpenMobile && (
          <button
            onClick={() => setIsOpenMobile(false)}
            className="md:hidden p-1.5 text-[#64748B] hover:text-[#0F172A] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {/* Fixed Top Items: 홈, 진행 중, 설정 */}
        {mainNavs.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpenMobile(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${
                isActive
                  ? 'bg-[#EFF6FC] text-[#0F6CBD] font-bold'
                  : 'text-[#334155] hover:bg-[#F6F8FB] hover:text-[#0F172A]'
              } focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]`}
              title={!isHovered ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#0F6CBD]' : 'text-[#64748B]'}`} />
              {isHovered && <span className="whitespace-nowrap truncate">{item.label}</span>}
            </button>
          );
        })}

        {/* Section Indicator Divider Line (-) */}
        <div className="my-3 px-2">
          <div className="border-t border-[#DCE3EA] relative">
            <span className="absolute left-1/2 -top-2.5 -translate-x-1/2 bg-[#FFFFFF] px-1.5 text-[10px] font-bold text-[#94A3B8]">
              —
            </span>
          </div>
        </div>

        {/* Custom Quick Menu Section */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between px-3 py-1">
            {isHovered ? (
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                <Pin className="w-3 h-3 text-[#0F6CBD]" />
                <span>퀵 메뉴 ({quickMenuIds.length}/5)</span>
              </span>
            ) : (
              <span className="w-full text-center text-[10px] font-bold text-[#94A3B8]">—</span>
            )}

            {/* Add Quick Menu Button (+) */}
            {quickMenuIds.length < 5 && (
              <button
                onClick={() => setIsOpenQuickAddModal(true)}
                className="w-7 h-7 rounded-lg bg-[#EFF6FC] text-[#0F6CBD] hover:bg-[#0F6CBD] hover:text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]"
                title="퀵 메뉴 등록 (+)"
                aria-label="퀵 메뉴 추가"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Menu Items */}
          {quickMenuIds.map((id) => {
            const tool = allToolsMap[id];
            if (!tool) return null;
            const Icon = getToolIcon(tool.iconName);
            return (
              <div
                key={id}
                className="group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-[#334155] hover:bg-[#EFF6FC] hover:text-[#0F6CBD] cursor-pointer transition-colors min-h-[40px]"
                onClick={() => {
                  onSelectTool(tool.id);
                  setIsOpenMobile(false);
                }}
                title={!isHovered ? tool.name : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 text-[#0F6CBD] flex-shrink-0" />
                  {isHovered && <span className="truncate whitespace-nowrap font-medium">{tool.name}</span>}
                </div>

                {isHovered && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveQuickMenu(tool.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#64748B] hover:text-[#B42318] transition-opacity"
                    title="퀵 메뉴 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {quickMenuIds.length === 0 && isHovered && (
            <p className="text-[11px] text-[#94A3B8] px-3 py-2 leading-relaxed">
              + 버튼을 눌러 자주 쓰는 도구를 퀵 메뉴로 등록하세요.
            </p>
          )}
        </div>
      </nav>

      {/* Bottom Footer Link: 선생님 제안함 */}
      <div className="p-3 border-t border-[#DCE3EA] bg-[#F6F8FB]">
        <button
          onClick={onOpenSuggestionModal}
          className="w-full flex items-center gap-3 text-xs font-semibold text-[#64748B] hover:text-[#0F6CBD] transition-colors p-2 rounded-lg min-h-[40px] focus:outline-none"
          title={!isHovered ? '선생님 제안함' : undefined}
        >
          <MessageSquarePlus className="w-4.5 h-4.5 text-[#0F6CBD] flex-shrink-0" />
          {isHovered && <span className="whitespace-nowrap">선생님 제안함</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Expandable Hover Sidebar */}
      <aside className="hidden md:block h-screen sticky top-0 flex-shrink-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isOpenMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setIsOpenMobile(false)}
          />
          <div className="relative flex-1 max-w-xs w-full bg-white shadow-2xl z-10">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Quick Menu Add Modal */}
      {isOpenQuickAddModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-[#DCE3EA]">
            <div className="flex justify-between items-center border-b border-[#F6F8FB] pb-3">
              <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                <Pin className="w-4 h-4 text-[#0F6CBD]" />
                <span>퀵 메뉴 도구 등록 (최대 5개)</span>
              </h3>
              <button
                onClick={() => setIsOpenQuickAddModal(false)}
                className="p-1 text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 py-1">
              {availableQuickTools.map((tool) => {
                const Icon = getToolIcon(tool.iconName);
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      onAddQuickMenu(tool.id);
                      setIsOpenQuickAddModal(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border border-[#DCE3EA] hover:border-[#0F6CBD] hover:bg-[#EFF6FC] text-left transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-[#0F6CBD]" />
                      <span className="text-xs font-bold text-[#0F172A]">{tool.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#0F6CBD] bg-white px-2 py-0.5 rounded border border-[#0F6CBD]/20">
                      + 추가
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
