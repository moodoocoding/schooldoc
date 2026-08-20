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
      className={`flex flex-col h-full bg-[#FFFFFF] border-r border-[#DCE3EA] shadow-lg select-none transition-all duration-300 ease-in-out ${
        isHovered ? 'w-64' : 'w-16'
      } overflow-hidden`}
    >
      {/* Header / Brand Logo */}
      <div className="h-16 flex items-center border-b border-[#DCE3EA] px-3">
        <button
          onClick={() => {
            setActiveTab('home');
            setIsOpenMobile(false);
          }}
          className="flex items-center gap-3 group focus:outline-none rounded-lg w-full text-left"
          aria-label="스쿨독 홈으로 이동"
        >
          <div className="w-10 h-10 bg-[#0F6CBD] rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-xs group-hover:bg-[#0F5B9E] transition-colors flex-shrink-0">
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

      {/* Main Navigation Area */}
      <nav className="flex-1 py-4 px-2 space-y-2 overflow-y-auto overflow-x-hidden">
        {/* Fixed Top Items: 홈, 진행 중, 설정 */}
        <div className="space-y-1">
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
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${
                  isActive
                    ? 'bg-[#EFF6FC] text-[#0F6CBD] font-bold'
                    : 'text-[#334155] hover:bg-[#F6F8FB] hover:text-[#0F172A]'
                } focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] text-left`}
                title={!isHovered ? item.label : undefined}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#0F6CBD]' : 'text-[#64748B]'}`} />
                </div>
                {isHovered && (
                  <span className="whitespace-nowrap font-bold text-sm text-[#0F172A] truncate">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Clean Divider Line (-) */}
        <div className="py-2">
          <div className={`border-t border-[#DCE3EA] ${isHovered ? 'w-full px-2' : 'w-8 mx-auto'}`}></div>
        </div>

        {/* Quick Menu Header & Add Button (+) */}
        <div className="space-y-1">
          <div className={`flex items-center justify-between ${isHovered ? 'px-3' : 'justify-center'} py-1`}>
            {isHovered && (
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5 text-[#0F6CBD]" />
                <span>퀵 메뉴 ({quickMenuIds.length}/5)</span>
              </span>
            )}

            {/* Quick Add Button (+) */}
            {quickMenuIds.length < 5 && (
              <button
                onClick={() => setIsOpenQuickAddModal(true)}
                className={`rounded-xl bg-[#EFF6FC] text-[#0F6CBD] hover:bg-[#0F6CBD] hover:text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] ${
                  isHovered ? 'w-7 h-7' : 'w-9 h-9 mx-auto'
                }`}
                title="퀵 메뉴 등록 (+)"
                aria-label="퀵 메뉴 추가"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Registered Quick Menu Items */}
          <div className="space-y-1">
            {quickMenuIds.map((id) => {
              const tool = allToolsMap[id];
              if (!tool) return null;
              const Icon = getToolIcon(tool.iconName);
              const isReady = tool.status === 'ready';
              return (
                <div
                  key={id}
                  onClick={() => {
                    if (!isReady) return;
                    onSelectTool(tool.id);
                    setIsOpenMobile(false);
                  }}
                  className={`group relative flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors min-h-[40px] text-left ${
                    isReady
                      ? 'text-[#334155] hover:bg-[#EFF6FC] hover:text-[#0F6CBD] cursor-pointer'
                      : 'text-[#94A3B8] cursor-not-allowed'
                  }`}
                  title={!isHovered ? (isReady ? tool.name : `${tool.name} (개발 중)`) : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-4.5 h-4.5 ${isReady ? 'text-[#0F6CBD]' : 'text-[#AAB7C4]'}`} />
                    </div>
                    {isHovered && (
                      <span className={`truncate whitespace-nowrap text-xs ${isReady ? 'font-bold text-[#0F172A]' : 'font-semibold text-[#94A3B8]'}`}>
                        {tool.name}{isReady ? '' : ' (개발 중)'}
                      </span>
                    )}
                  </div>

                  {isHovered && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveQuickMenu(tool.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#64748B] hover:text-[#B42318] transition-opacity ml-1 flex-shrink-0"
                      title="퀵 메뉴 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Bottom Footer Link: 선생님 제안함 */}
      <div className="p-2 border-t border-[#DCE3EA] bg-[#F6F8FB]">
        <button
          onClick={onOpenSuggestionModal}
          className="w-full flex items-center gap-3 text-xs font-semibold text-[#64748B] hover:text-[#0F6CBD] transition-colors p-2 rounded-xl min-h-[44px] focus:outline-none text-left"
          title={!isHovered ? '선생님 제안함' : undefined}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0">
            <MessageSquarePlus className="w-5 h-5 text-[#0F6CBD]" />
          </div>
          {isHovered && <span className="whitespace-nowrap font-bold text-xs text-[#334155]">선생님 제안함</span>}
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
