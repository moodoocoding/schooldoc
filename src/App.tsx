import { useState } from 'react';
import { PinterestSidebar } from './components/PinterestSidebar';
import { PinterestGrid } from './components/PinterestGrid';
import { Search, Sparkles } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  const tabs = [
    { id: 'all', label: '전체 도구 📌' },
    { id: 'collect', label: '✉️ 수합 & 서명' },
    { id: 'evaluation', label: '☑️ 평가 & 조회' },
    { id: 'admin', label: '⚙️ 행정 & 관리' },
    { id: 'bookmark', label: '💖 즐겨찾기' },
  ];

  return (
    <div className="min-h-screen flex bg-white font-sans text-slate-800 antialiased selection:bg-rose-100 selection:text-rose-600">
      
      {/* Left Icon Sidebar (Pinterest Style) */}
      <PinterestSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        setActiveToolId={setActiveToolId}
      />

      {/* Right Main Content Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        
        {/* Pinterest Workspace Top Search & Filter Bar */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Pinterest Rounded-Full Search Input */}
          <div className="relative flex-1 max-w-3xl">
            <Search className="w-4.5 h-4.5 text-slate-400 absolute left-4.5 top-1/2 -translate-y-1/2 group-focus-within:text-rose-600 transition-colors" />
            <input
              type="text"
              placeholder="교무 서류, 자리 배치, 영수증, 세특 키워드 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-full bg-slate-100 hover:bg-slate-150 focus:bg-white text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:shadow-md transition-all border border-transparent focus:border-rose-200"
            />
          </div>

          {/* User Profile Pill Tag */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 bg-slate-100 hover:bg-slate-150 px-3.5 py-1.5 rounded-full cursor-pointer transition-colors border border-slate-200/50">
              <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-black">
                김
              </span>
              <span className="text-xs font-bold text-slate-700">김교사 선생님</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
          </div>
        </header>

        {/* Pinterest Filter Pills Sub-bar */}
        <div className="px-8 pt-6 pb-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setActiveToolId(null); }}
                className={`px-4 py-2 rounded-full text-xs font-black transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm scale-105'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Main Masonry Staggered Grid Container */}
        <main className="flex-1 p-6 sm:p-8">
          <PinterestGrid 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchQuery={searchQuery}
            activeToolId={activeToolId}
            setActiveToolId={setActiveToolId}
          />
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-100 py-6 px-8 text-center text-xs font-semibold text-slate-400">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-rose-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">📌</span>
              <span className="text-slate-800 font-extrabold">스쿨독 (SchoolDoc)</span>
              <span>&copy; {new Date().getFullYear()} SchoolDoc, Inc. Pretendard Font Applied.</span>
            </div>

            <div className="flex gap-6 text-slate-500 font-bold">
              <a href="https://foreducator.com" target="_blank" rel="noreferrer" className="hover:text-rose-600 transition-colors">
                ForEducator
              </a>
              <a href="https://schooldocu.vercel.app" target="_blank" rel="noreferrer" className="hover:text-rose-600 transition-colors">
                SchoolDocu
              </a>
              <a href="https://kr.pinterest.com" target="_blank" rel="noreferrer" className="hover:text-rose-600 transition-colors">
                Pinterest
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
