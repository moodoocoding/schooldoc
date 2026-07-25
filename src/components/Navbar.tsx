import React from 'react';
import { Sparkles, Users, Calendar, FolderOpen, MessageSquare, Bell, Menu } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'workmate', label: '워크메이트', icon: Sparkles, desc: 'AI 생기부/공문 행정' },
    { id: 'classmate', label: '클래스메이트', icon: Users, desc: '자리배치/학급도구' },
    { id: 'timetable', label: '시간표/일정', icon: Calendar, desc: '주간 시수 및 시간표' },
    { id: 'infomate', label: '자료실', icon: FolderOpen, desc: '교육 서식 및 링크집' },
    { id: 'community', label: '소통공간', icon: MessageSquare, desc: '교사 커뮤니티' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div 
            onClick={() => setActiveTab('home')} 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-indigo-100 group-hover:bg-indigo-700 transition-colors">
              SD
            </div>
            <div>
              <h1 className="font-black text-lg text-slate-800 tracking-tight flex items-center gap-1.5">
                스쿨독 <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">SchoolDoc</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">교직원 행정 및 학급 운영 스마트 지원</p>
            </div>
          </div>

          {/* Center Navigation Menu (Desktop) */}
          <nav className="hidden md:flex space-x-1 lg:space-x-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-250 ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-50/50'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Side Icons */}
          <div className="flex items-center gap-2.5">
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl relative transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>
            
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl py-1 px-3">
              <div className="w-6 h-6 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm">
                쌤
              </div>
              <span className="text-xs font-semibold text-slate-700">김교사 선생님</span>
            </div>

            {/* Mobile Menu Button */}
            <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-xl md:hidden transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Submenu Bar */}
      <div className="md:hidden border-t border-slate-50 bg-white flex overflow-x-auto scrollbar-none py-1.5 px-3 gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
