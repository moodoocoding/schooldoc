import React from 'react';
import { 
  Home, Mail, CheckSquare, Users, Settings, Lightbulb 
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
    { id: 'all', label: '교무 대시보드', icon: Home },
    { id: 'collect', label: '수합함 모아보기', icon: Mail },
    { id: 'tasks', label: '완료 서식 대장', icon: CheckSquare },
    { id: 'members', label: '학급 명단 관리', icon: Users },
    { id: 'settings', label: '스쿨독 환경 설정', icon: Settings },
  ];

  const categories = [
    { id: 'all', label: '스쿨독 행정 센터', dotColor: 'bg-amber-400' },
    { id: 'collect', label: '수합 & 서명 센터', dotColor: 'bg-orange-400' },
    { id: 'evaluation', label: '평가 & 조회 센터', dotColor: 'bg-purple-400' },
    { id: 'admin', label: '행정 & 관리 센터', dotColor: 'bg-emerald-400' },
  ];

  return (
    <aside className="w-64 bg-[#fcfcfb] border-r border-[#e1dfdd]/80 h-screen sticky top-0 flex flex-col justify-between p-6 flex-shrink-0 z-30">
      <div className="space-y-8">
        
        {/* Brand Header */}
        <div 
          onClick={() => { setActiveCategory('all'); setActiveToolId(null); }}
          className="flex items-center gap-2.5 cursor-pointer group px-2"
        >
          <div className="w-8 h-8 bg-[#0f6cbd] rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm group-hover:bg-[#0078d4] transition-colors">
            SD
          </div>
          <span className="font-extrabold text-base text-slate-900 tracking-tight">
            스쿨독
          </span>
          <span className="text-[9px] font-bold bg-[#ebf3fc] text-[#0f6cbd] px-2 py-0.5 rounded-full border border-blue-200/50">
            Fluent 2
          </span>
        </div>

        {/* Top Main Navigation */}
        <nav className="space-y-1">
          {mainNavs.map((item) => {
            const Icon = item.icon;
            const isNavActive = activeCategory === item.id || (item.id === 'all' && activeCategory === 'all');
            return (
              <button
                key={item.id}
                onClick={() => { setActiveCategory(item.id === 'collect' ? 'collect' : 'all'); setActiveToolId(null); }}
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  isNavActive && item.id === 'all'
                    ? 'text-[#0f6cbd] bg-[#ebf3fc] font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon className={`w-4 h-4 ${isNavActive && item.id === 'all' ? 'text-[#0f6cbd]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Projects / Categories Section */}
        <div className="space-y-3 pt-2">
          <h4 className="text-[11px] font-bold text-slate-400 px-3 uppercase tracking-wider">
            행정 센터 범주
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
                      ? 'bg-[#0f6cbd] text-white shadow-sm shadow-blue-950/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : cat.dotColor}`}></span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Bottom Thoughts Time Card Widget (Customized for Teachers) */}
      <div className="bg-[#f4f3ed] rounded-2xl p-4 space-y-2 border border-slate-200/50 relative overflow-hidden">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-xs">
          <Lightbulb className="w-4 h-4" />
        </div>
        <h5 className="font-extrabold text-xs text-slate-800">선생님 제안함</h5>
        <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
          필요한 교무 서식이나 개선 아이디어를 남겨주시면 AI 기능으로 우선 반영해 드립니다.
        </p>
      </div>
    </aside>
  );
};
