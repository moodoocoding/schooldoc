import { useState } from 'react';
import { PinterestNavbar } from './components/PinterestNavbar';
import { PinterestGrid } from './components/PinterestGrid';

function App() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 antialiased selection:bg-rose-100 selection:text-rose-600">
      {/* Pinterest Style Header Navigation */}
      <PinterestNavbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setActiveToolId={setActiveToolId}
      />

      {/* Main Pinterest Dynamic Masonry Workspace */}
      <main className="pt-20 pb-16 px-4 sm:px-8 max-w-[1600px] mx-auto">
        <PinterestGrid 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          activeToolId={activeToolId}
          setActiveToolId={setActiveToolId}
        />
      </main>

      {/* Clean Pinterest Footer */}
      <footer className="border-t border-slate-100 py-8 px-8 text-center text-xs font-semibold text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-rose-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">📌</span>
            <span className="text-slate-800 font-bold">스쿨독 (SchoolDoc)</span>
            <span>&copy; {new Date().getFullYear()} SchoolDoc, Inc.</span>
          </div>

          <div className="flex gap-6 text-slate-500">
            <a href="https://foreducator.com" target="_blank" rel="noreferrer" className="hover:text-rose-600 transition-colors">
              ForEducator
            </a>
            <a href="https://schooldocu.vercel.app" target="_blank" rel="noreferrer" className="hover:text-rose-600 transition-colors">
              SchoolDocu
            </a>
            <a href="https://kr.pinterest.com" target="_blank" rel="noreferrer" className="hover:text-rose-600 transition-colors">
              Pinterest Mood
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
