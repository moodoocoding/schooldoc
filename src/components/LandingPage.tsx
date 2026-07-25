import React, { useState } from 'react';
import { Mail, CheckSquare, Settings, Search } from 'lucide-react';

interface LandingPageProps {
  setActiveTab: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ setActiveTab }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const services = [
    {
      id: 'collect',
      title: '수합 & 서명',
      subtitle: 'Collect & Sign',
      desc: '가정통신문, 온오프라인 서류 자료 수합, 등록부 서명 및 비대면 문서 서명을 클라우드로 처리합니다.',
      icon: Mail,
      accentColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50/40',
    },
    {
      id: 'evaluation',
      title: '평가 & 조회',
      subtitle: 'Evaluation & Lookup',
      desc: '개별 평가 데이터 안심 조회 서비스, AI 세특 문장 생성 및 수행평가 채점 기준 설정을 돕습니다.',
      icon: CheckSquare,
      accentColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50/40',
    },
    {
      id: 'admin',
      title: '행정 & 관리',
      subtitle: 'Admin & Management',
      desc: '영수증 자동 전사, 특별실 예약 현황 조율, 분실물 등록 공지 및 기자재 대여 일정을 제어합니다.',
      icon: Settings,
      accentColor: 'text-slate-700',
      bgColor: 'bg-slate-100/50',
    },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.toLowerCase();
    if (!query) return;

    if (query.includes('수합') || query.includes('서명') || query.includes('이수증') || query.includes('동의서') || query.includes('자료')) {
      setActiveTab('collect');
    } else if (query.includes('조회') || query.includes('생기부') || query.includes('세특') || query.includes('평가') || query.includes('배점') || query.includes('시험')) {
      setActiveTab('evaluation');
    } else if (query.includes('영수증') || query.includes('특별실') || query.includes('대여') || query.includes('분실물') || query.includes('예약')) {
      setActiveTab('admin');
    } else {
      alert('일치하는 도구 분류를 찾지 못했습니다. 주요 키워드(예: 수합, 조회, 영수증 등)로 검색해 주세요.');
    }
  };

  return (
    <div className="bg-slate-50/50 min-h-screen relative overflow-hidden">
      {/* Background Decorative Grid - Vercel / Linear Style */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none"></div>

      {/* Background Subtle Radial Spotlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-200/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-6 sm:px-12 text-center z-10">
        <div className="max-w-3xl mx-auto">
          {/* Main Title with fine letter spacing and custom weight */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mb-5">
            선생님의 일과에 여유를 더하는 <span className="bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">스쿨독</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl mx-auto leading-relaxed mb-10">
            가정통신문 수합, 서명 관리, 개별 데이터 안심 조회 및 영수증 자동 정리까지<br className="hidden sm:inline" />
            교직원 업무에 꼭 필요한 핵심 행정 기능을 단 한 곳에서 직관적으로 처리하세요.
          </p>

          {/* Clean Modern Search Bar with fine shadow and border */}
          <form onSubmit={handleSearchSubmit} className="max-w-md mx-auto">
            <div className="relative group">
              <input
                type="text"
                placeholder="필요한 행정 도구를 검색해 보세요 (예: 서류 수합, 영수증)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-24 py-3 rounded-2xl bg-white border border-slate-200/80 text-slate-800 placeholder-slate-400 text-xs font-semibold focus:outline-none focus:border-indigo-400/80 focus:ring-4 focus:ring-indigo-100 transition-all shadow-sm group-hover:border-slate-300"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600" />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4.5 py-1.5 rounded-xl transition-all shadow-sm"
              >
                검색
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Services Grid Section */}
      <section className="max-w-6xl mx-auto py-8 px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                onClick={() => setActiveTab(service.id)}
                className="bg-white border border-slate-200/70 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-350 hover:shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 cursor-pointer min-h-[200px] group"
              >
                <div>
                  {/* Clean badge icon */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-lg ${service.bgColor} flex items-center justify-center ${service.accentColor} border border-slate-100/50 flex-shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                        {service.title}
                      </h3>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5 opacity-60">
                        {service.subtitle}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-[11px] leading-relaxed text-slate-400 font-semibold mb-6">
                    {service.desc}
                  </p>
                </div>

                <div className="text-[11px] font-bold text-indigo-600 group-hover:text-indigo-800 group-hover:translate-x-0.5 transition-all flex items-center gap-0.5 pt-3 border-t border-slate-50">
                  <span>도구 목록 보기</span>
                  <span>&rarr;</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
