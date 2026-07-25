import React from 'react';
import { Sparkles, Users, Calendar, FolderOpen, MessageSquare, Bell, Menu } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'workmate', label: '워크메이트', icon: Sparkles },
    { id: 'classmate', label: '클래스메이트', icon: Users },
    { id: 'timetable', label: '시간표/일정', icon: Calendar },
    { id: 'infomate', label: '자료실', icon: FolderOpen },
    { id: 'community', label: '소통공간', icon: MessageSquare },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100/80 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <div 
            onClick={() => setActiveTab('home')} 
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-sm">
              SD
            </div>
            <h1 className="font-bold text-sm text-slate-800 tracking-tight">
              스쿨독
            </h1>
          </div>

          {/* Center Navigation Menu (Desktop) */}
          <nav className="hidden md:flex space-x-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Side Icons */}
          <div className="flex items-center gap-2">
            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg relative transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
            </button>
            
            <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 rounded-lg py-1 px-2.5">
              <span className="text-[10px] font-bold text-slate-600">김교사 선생님</span>
            </div>

            {/* Mobile Menu Button */}
            <button className="p-1.5 text-slate-500 hover:bg-slate-50 rounded-lg md:hidden transition-colors">
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Submenu Bar */}
      <div className="md:hidden border-t border-slate-50 bg-white flex overflow-x-auto scrollbar-none py-1 px-2 gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-none flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
