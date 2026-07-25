import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { Workmate } from './components/Workmate';
import { Classmate } from './components/Classmate';
import { Timetable } from './components/Timetable';
import { Infomate } from './components/Infomate';
import { Community } from './components/Community';

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
      <footer className="bg-white border-t border-slate-100 py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-bold text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-700">스쿨독 (SchoolDoc)</span>
            <span>&copy; {new Date().getFullYear()} SchoolDoc. All rights reserved.</span>
          </div>

          <div className="flex gap-4">
            <a href="https://foreducator.com" target="_blank" rel="noreferrer" className="hover:text-indigo-600 flex items-center gap-0.5">
              ForEducator
            </a>
            <a href="https://schooldocu.vercel.app" target="_blank" rel="noreferrer" className="hover:text-indigo-600 flex items-center gap-0.5">
              SchoolDocu
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
