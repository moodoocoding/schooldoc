import React from 'react';
import { 
  Home, MessageSquare, CheckSquare, Users, Settings, Lightbulb 
} from 'lucide-react';

interface KanbanSidebarProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  setActiveToolId: (toolId: string | null) => void;
}

export const KanbanSidebar: React.FC<KanbanSidebarProps> = ({
  activeCategory,
  setActiveCategory,
  setActiveToolId,
}) => {
  const mainNavs = [
    { id: 'all', label: 'Home', icon: Home },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const categories = [
    { id: 'all', label: 'App Design', dotColor: 'bg-amber-400' },
    { id: 'collect', label: '수합 & 서명', dotColor: 'bg-orange-400' },
    { id: 'evaluation', label: '평가 & 조회', dotColor: 'bg-purple-400' },
    { id: 'admin', label: '행정 & 관리', dotColor: 'bg-rose-400' },
  ];

  return (
    <aside className="w-64 bg-[#fbfbf9] border-r border-slate-200/60 h-screen sticky top-0 flex flex-col justify-between p-6 flex-shrink-0 z-30">
      <div className="space-y-8">
        
        {/* Brand Header */}
        <div 
          onClick={() => { setActiveCategory('all'); setActiveToolId(null); }}
          className="flex items-center gap-2.5 cursor-pointer group px-2"
        >
          <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm">
            SD
          </div>
          <span className="font-extrabold text-base text-slate-900 tracking-tight">
            스쿨독
          </span>
        </div>

        {/* Top Main Navigation */}
        <nav className="space-y-1">
          {mainNavs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveCategory(item.id === 'all' ? 'all' : 'all'); setActiveToolId(null); }}
                className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100/70 transition-all text-left"
              >
                <Icon className="w-4 h-4 text-slate-400" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Projects / Categories Section */}
        <div className="space-y-3 pt-2">
          <h4 className="text-[11px] font-bold text-slate-400 px-3 uppercase tracking-wider">
            PROJECTS
          </h4>
          <div className="space-y-1">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setActiveToolId(null); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-left ${
                    isActive
                      ? 'bg-[#fef08a]/80 text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${cat.dotColor}`}></span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Bottom Thoughts Time Card Widget (Matched with Screenshot) */}
      <div className="bg-[#f4f3ed] rounded-2xl p-4 space-y-2 border border-slate-200/50 relative overflow-hidden">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-xs">
          <Lightbulb className="w-4 h-4" />
        </div>
        <h5 className="font-extrabold text-xs text-slate-800">Thoughts Time</h5>
        <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
          선생님의 자유로운 아이디어와 행정 서식 제안을 적어주시면 AI가 반영해 드립니다.
        </p>
      </div>
    </aside>
  );
};
