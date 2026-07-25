import React from 'react';
import { Bell, Menu } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'collect', label: '수합 & 서명' },
    { id: 'evaluation', label: '평가 & 조회' },
    { id: 'admin', label: '행정 & 관리' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          
          {/* Left: Refined Blue Logo */}
          <div 
            onClick={() => setActiveTab('home')} 
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-extrabold text-xs shadow-sm group-hover:bg-blue-700 transition-colors">
              SD
            </div>
            <span className="font-bold text-sm text-slate-800 tracking-tight">
              스쿨독
            </span>
          </div>

          {/* Center: Clean Text Menus */}
          <nav className="hidden md:flex space-x-6">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`text-xs font-bold tracking-tight transition-colors py-1 ${
                    isActive
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right: Muted Buttons */}
          <div className="flex items-center gap-2">
            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg relative transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
            </button>
            
            <button
              onClick={() => setActiveTab('collect')}
              className="hidden sm:inline-flex bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition shadow-sm"
            >
              내 보관함
            </button>
            
            <button
              onClick={() => alert('교사 설정창을 엽니다.')}
              className="hidden sm:inline-flex border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold text-xs px-3.5 py-1.5 rounded-lg transition"
            >
              교사 설정
            </button>

            {/* Mobile Menu Button */}
            <button className="p-1.5 text-slate-500 hover:bg-slate-50 rounded-lg md:hidden transition-colors">
              <Menu className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Submenu Bar */}
      <div className="md:hidden border-t border-slate-50 bg-white flex overflow-x-auto scrollbar-none py-1.5 px-3 gap-2">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-none px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
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
