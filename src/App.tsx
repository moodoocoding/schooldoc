import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { Workmate } from './components/Workmate';
import { Classmate } from './components/Classmate';
import { Timetable } from './components/Timetable';
import { Infomate } from './components/Infomate';
import { Community } from './components/Community';
import { ArrowUpRight } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<string>('home');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-800">
      {/* GNB Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Workspace Router */}
      <main className="flex-1">
        {activeTab === 'home' && <LandingPage setActiveTab={setActiveTab} />}
        {activeTab === 'workmate' && <Workmate />}
        {activeTab === 'classmate' && <Classmate />}
        {activeTab === 'timetable' && <Timetable />}
        {activeTab === 'infomate' && <Infomate />}
        {activeTab === 'community' && <Community />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm">
              SD
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-800">스쿨독 (SchoolDoc)</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                School & Document - 교사를 위한 행정 및 학급경영 스마트 지원 솔루션
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-[10px] font-bold text-slate-400">
            <a href="https://foreducator.com" target="_blank" rel="noreferrer" className="hover:text-indigo-600 flex items-center gap-0.5">
              포에듀케이터 레퍼런스 <ArrowUpRight className="w-3 h-3" />
            </a>
            <a href="https://schooldocu.vercel.app" target="_blank" rel="noreferrer" className="hover:text-indigo-600 flex items-center gap-0.5">
              스쿨도큐 레퍼런스 <ArrowUpRight className="w-3 h-3" />
            </a>
            <span>&copy; {new Date().getFullYear()} SchoolDoc. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
