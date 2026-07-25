import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { Bell, HelpCircle } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  const getHeaderTitle = () => {
    if (activeTab === 'home') return '대시보드';
    if (activeTab === 'collect') return '수합 & 서명';
    if (activeTab === 'evaluation') return '평가 & 조회';
    if (activeTab === 'admin') return '행정 & 관리';
    return '스쿨독';
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-800">
      {/* Left Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        activeToolId={activeToolId}
        setActiveToolId={setActiveToolId}
      />

      {/* Right Content Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Header of Right Area */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-extrabold text-slate-800 tracking-tight">
              {getHeaderTitle()}
            </h2>
            {activeToolId && (
              <>
                <span className="text-slate-300 text-xs">/</span>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  모듈 실행 중
                </span>
              </>
            )}
          </div>

          {/* Right Header Menu */}
          <div className="flex items-center gap-3">
            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              <HelpCircle className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg relative transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Main Routing Screen */}
        <main className="flex-1">
          {activeTab === 'home' && (
            <LandingPage setActiveTab={(tab) => { setActiveTab(tab); setActiveToolId(null); }} />
          )}
          {['collect', 'evaluation', 'admin'].includes(activeTab) && (
            <Dashboard 
              activeCategory={activeTab} 
              activeToolId={activeToolId}
              setActiveToolId={setActiveToolId}
            />
          )}
        </main>

        {/* Unified Light Footer */}
        <footer className="bg-white border-t border-slate-100 py-4 px-8 text-[10px] font-bold text-slate-400 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-slate-700">스쿨독 (SchoolDoc)</span>
            <span>&copy; {new Date().getFullYear()} SchoolDoc. All rights reserved.</span>
          </div>
          <div className="flex gap-4">
            <a href="https://foreducator.com" target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors">
              ForEducator
            </a>
            <a href="https://schooldocu.vercel.app" target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors">
              SchoolDocu
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
