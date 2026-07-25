import React from 'react';
import { 
  Home, Mail, CheckSquare, Settings, Heart, 
  Bell, MessageSquare, User 
} from 'lucide-react';

interface PinterestSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setActiveToolId: (toolId: string | null) => void;
}

export const PinterestSidebar: React.FC<PinterestSidebarProps> = ({
  activeTab,
  setActiveTab,
  setActiveToolId,
}) => {
  const topNavItems = [
    { id: 'all', label: '메인 홈', icon: Home, color: 'text-slate-800' },
    { id: 'collect', label: '수합 & 서명', icon: Mail, color: 'text-rose-600' },
    { id: 'evaluation', label: '평가 & 조회', icon: CheckSquare, color: 'text-purple-600' },
    { id: 'admin', label: '행정 & 관리', icon: Settings, color: 'text-amber-600' },
    { id: 'bookmark', label: '즐겨찾기 핀', icon: Heart, color: 'text-rose-500' },
  ];

  return (
    <aside className="w-16 sm:w-20 bg-white border-r border-slate-150 h-screen sticky top-0 flex flex-col items-center justify-between py-5 z-50 flex-shrink-0">
      
      {/* Top Section: Red Pinterest Pin Brand & Icon Navigation */}
      <div className="flex flex-col items-center gap-6 w-full">
        
        {/* Pinterest Red Signature Logo Pin */}
        <button
          onClick={() => { setActiveTab('all'); setActiveToolId(null); }}
          className="w-11 h-11 bg-rose-600 hover:bg-rose-700 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg transition-transform hover:scale-110 group relative"
          title="스쿨독 홈으로 이동"
        >
          📌
          <span className="absolute left-16 bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-50">
            스쿨독 홈
          </span>
        </button>

        {/* Icon Navigation Buttons */}
        <div className="flex flex-col items-center gap-2 w-full px-2">
          {topNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setActiveToolId(null); }}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all group relative ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : item.color}`} />

                {/* Hover Tooltip */}
                <span className="absolute left-16 bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-50">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: Notifications, Messages, Profile */}
      <div className="flex flex-col items-center gap-3 w-full px-2">
        <button 
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors relative group"
          title="알림"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-600 rounded-full"></span>
          <span className="absolute left-16 bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-50">
            알림
          </span>
        </button>

        <button 
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors group relative"
          title="메세지"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="absolute left-16 bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-50">
            메세지
          </span>
        </button>

        {/* User Profile Avatar Circle */}
        <div 
          className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer group relative mt-1"
          title="김교사 프로필"
        >
          <User className="w-5 h-5" />
          <span className="absolute left-16 bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-50">
            김교사 선생님
          </span>
        </div>
      </div>
    </aside>
  );
};
