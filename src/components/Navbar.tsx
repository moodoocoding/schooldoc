import React from 'react';
import { Mail, CheckSquare, Settings, Bell, Menu } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'collect', label: '수합 & 서명', icon: Mail },
    { id: 'evaluation', label: '평가 & 조회', icon: CheckSquare },
    { id: 'admin', label: '행정 & 관리', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Left: Logo */}
          <div 
            onClick={() => setActiveTab('home')} 
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-extrabold text-sm shadow-sm group-hover:bg-indigo-700 transition-colors">
              SD
            </div>
            <h1 className="font-extrabold text-base text-slate-800 tracking-tight">
              스쿨독
            </h1>
          </div>

          {/* Center: Clean Text Menus */}
          <nav className="hidden md:flex space-x-6">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`text-sm font-semibold transition-colors py-1 ${
                    isActive
                      ? 'text-indigo-600 border-b-2 border-indigo-650'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right: Indigo Primary Buttons & Notification */}
          <div className="flex items-center gap-3">
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg relative transition-colors">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
            </button>
            
            <button
              onClick={() => setActiveTab('collect')}
              className="hidden sm:inline-flex bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-sm"
            >
              내 보관함
            </button>
            
            <button
              onClick={() => alert('교사 설정창을 엽니다.')}
              className="hidden sm:inline-flex border border-indigo-200 text-indigo-650 hover:bg-indigo-50 font-bold text-xs px-4 py-2 rounded-xl transition"
            >
              교사 설정
            </button>

            {/* Mobile Menu Button */}
            <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg md:hidden transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Submenu Bar */}
      <div className="md:hidden border-t border-slate-50 bg-white flex overflow-x-auto scrollbar-none py-2 px-3 gap-2">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
