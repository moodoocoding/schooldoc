import React from 'react';
import { Mail, CheckSquare, Settings, Home, ChevronRight, User } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeToolId: string | null;
  setActiveToolId: (toolId: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeToolId,
  setActiveToolId,
}) => {
  const categories = [
    {
      id: 'collect',
      label: '수합 & 서명',
      icon: Mail,
      color: 'text-blue-600',
      tools: [
        { id: 'letter-collect', name: '가정통신문 수합' },
        { id: 'sig-collect', name: '등록부 서명 수합' },
        { id: 'data-collect', name: '올인원 자료 수합' },
        { id: 'doc-sign', name: '문서 서명' },
        { id: 'cert-collect', name: '연수 이수증 수합' },
      ],
    },
    {
      id: 'evaluation',
      label: '평가 & 조회',
      icon: CheckSquare,
      color: 'text-blue-650 text-blue-600',
      tools: [
        { id: 'student-lookup', name: '개별 데이터 조회' },
        { id: 'life-record', name: '생기부 세특 작성' },
        { id: 'eval-plan', name: '수행평가 계획 수립' },
      ],
    },
    {
      id: 'admin',
      label: '행정 & 관리',
      icon: Settings,
      color: 'text-slate-600',
      tools: [
        { id: 'receipt-auto', name: '영수증 자동 정리' },
        { id: 'special-room', name: '특별실 사용 신청' },
        { id: 'lost-found', name: '분실물 관리' },
        { id: 'item-rental', name: '물품 대여 관리' },
      ],
    },
  ];

  const handleToolClick = (catId: string, toolId: string) => {
    setActiveTab(catId);
    setActiveToolId(toolId);
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 h-screen sticky top-0 flex-shrink-0 z-20">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div 
          onClick={() => { setActiveTab('home'); setActiveToolId(null); }}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-extrabold text-xs shadow-md">
            SD
          </div>
          <span className="font-bold text-sm text-white tracking-tight group-hover:text-blue-400 transition-colors">
            스쿨독
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-7 scrollbar-none">
        
        {/* Home Button */}
        <div>
          <button
            onClick={() => { setActiveTab('home'); setActiveToolId(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'home'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>메인 대시보드</span>
          </button>
        </div>

        {/* Categorized Tools Menu */}
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.id} className="space-y-2">
              <div 
                onClick={() => { setActiveTab(cat.id); setActiveToolId(null); }}
                className="flex items-center justify-between px-3 py-1.5 cursor-pointer text-slate-500 hover:text-slate-350 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{cat.label}</span>
                </div>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div className="space-y-0.5 pl-2">
                {cat.tools.map((tool) => {
                  const isToolActive = activeToolId === tool.id;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => handleToolClick(cat.id, tool.id)}
                      className={`w-full text-left px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                        isToolActive
                          ? 'bg-slate-800 text-blue-400 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      }`}
                    >
                      {tool.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* User Profile Info Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">김교사 선생님</p>
            <p className="text-[9px] text-slate-500 font-bold">스쿨독 정회원</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
