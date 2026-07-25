import React from 'react';
import { Search, Bell, MessageSquare, User } from 'lucide-react';

interface PinterestNavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setActiveToolId: (toolId: string | null) => void;
}

export const PinterestNavbar: React.FC<PinterestNavbarProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  setActiveToolId,
}) => {
  const tabs = [
    { id: 'all', label: '전체 도구' },
    { id: 'collect', label: '수합 & 서명' },
    { id: 'evaluation', label: '평가 & 조회' },
    { id: 'admin', label: '행정 & 관리' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md px-4 sm:px-6 h-18 flex items-center justify-between gap-3 border-b border-slate-100">
      
      {/* Left: Brand Logo & Navigation Pills */}
      <div className="flex items-center gap-3">
        {/* Pinterest Red Logo Icon */}
        <div 
          onClick={() => { setActiveTab('all'); setActiveToolId(null); }}
          className="w-10 h-10 bg-rose-600 hover:bg-rose-700 rounded-full flex items-center justify-center text-white font-black text-lg shadow-md cursor-pointer transition-transform hover:scale-105 flex-shrink-0"
        >
          📌
        </div>

        <span 
          onClick={() => { setActiveTab('all'); setActiveToolId(null); }}
          className="font-black text-lg text-rose-600 tracking-tight hidden lg:inline cursor-pointer mr-2"
        >
          스쿨독
        </span>

        {/* Pinterest Style Navigation Pills */}
        <nav className="hidden md:flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setActiveToolId(null); }}
                className={`px-4 py-2.5 rounded-full text-xs font-extrabold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Center: Pinterest Signature Rounded-Full Search Bar */}
      <div className="flex-1 max-w-3xl mx-2">
        <div className="relative group">
          <Search className="w-4.5 h-4.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-rose-600 transition-colors" />
          <input
            type="text"
            placeholder="교무 서류, 자리 배치, 영수증, 생기부 키워드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-full bg-slate-100 hover:bg-slate-150 focus:bg-white text-slate-800 placeholder-slate-400 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:shadow-md transition-all"
          />
        </div>
      </div>

      {/* Right: Notifications & Profile Pill */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-600 rounded-full"></span>
        </button>

        <button className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-full transition-colors hidden sm:block">
          <MessageSquare className="w-5 h-5" />
        </button>

        {/* Pinterest Profile Circle */}
        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer ml-1">
          <User className="w-5 h-5" />
        </div>
      </div>
    </header>
  );
};
