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
      title: '수합 & 서명 (Collect & Sign)',
      desc: '가정통신문, 자료 수합, 등록부 서명, 비대면 문서 서명 및 이수증 자동 처리',
      icon: Mail,
      color: 'from-emerald-500 to-teal-500',
      textColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      features: ['뚝딱 서류 수합기', '자료 수합', '등록부 서명 수합', '문서 서명 받기', '연수 이수증 수합'],
    },
    {
      id: 'evaluation',
      title: '평가 & 조회 (Evaluation & Lookup)',
      desc: '개별 데이터 안심 조회, 생활기록부 문구 생성, 평가 계획 수립 및 시험 배점 연산',
      icon: CheckSquare,
      color: 'from-indigo-500 to-blue-500',
      textColor: 'text-indigo-500',
      bgColor: 'bg-indigo-50',
      features: ['개별 데이터 안심 조회', '생활기록부 문구 생성', '평가 계획 작성', '시험 문항 배점 생성기'],
    },
    {
      id: 'admin',
      title: '행정 & 관리 (Admin & Management)',
      desc: '영수증 자동 정리, 교내 특별실 사용 신청, 분실물 통합 공지 및 기자재 대여 모니터링',
      icon: Settings,
      color: 'from-amber-500 to-orange-500',
      textColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      features: ['영수증 자동 정리', '특별실 사용 신청', '분실물 통합 관리', '물품 대여 관리'],
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
    <div className="bg-slate-50 min-h-screen">
      {/* Refined Premium Dark Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white py-16 px-6 sm:px-12">
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-4">
            선생님의 일과에 여유를 더하는 <span className="text-indigo-400">스쿨독</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-350 font-medium mb-8 max-w-lg mx-auto text-slate-300">
            가정통신문 수합, 서명 관리, 개별 데이터 안심 조회 및 영수증 자동 정리까지 교직원 업무에 필수적인 유틸리티를 한곳에서 처리하세요.
          </p>

          {/* Clean Search Bar */}
          <form onSubmit={handleSearchSubmit} className="max-w-lg mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="필요한 업무 범주를 검색해보세요 (예: 서류 수합, 안심 조회, 영수증)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-24 py-3.5 rounded-2xl bg-white/10 border border-white/10 text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white focus:text-slate-900 transition-all shadow-lg"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow"
              >
                검색
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Services Grid Section */}
      <section className="max-w-6xl mx-auto py-12 px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                onClick={() => setActiveTab(service.id)}
                className="bg-white border border-slate-150 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-350 transition-all cursor-pointer min-h-[170px] group"
              >
                <div>
                  {/* Flat Muted Icon & Title */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 flex-shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {service.title}
                    </h3>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-450 text-slate-400 font-medium mb-4">
                    {service.desc}
                  </p>
                </div>

                <div className="flex items-center text-[10px] font-bold text-indigo-600 group-hover:text-indigo-800 group-hover:underline mt-auto pt-2 border-t border-slate-50">
                  <span>도구 목록 보기 &rarr;</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
