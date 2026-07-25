import React, { useState } from 'react';
import { Mail, CheckSquare, Settings } from 'lucide-react';

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
      desc: '가정통신문 수합, 자료 수합, 등록부 서명 및 비대면 문서 서명을 안전하고 빠르게 처리합니다.',
      icon: Mail,
      accentColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      id: 'evaluation',
      title: '평가 & 조회',
      subtitle: 'Evaluation & Lookup',
      desc: '개별 평가 데이터 안심 조회 서비스, AI 세특 문장 생성 및 수행평가 채점 루브릭을 관리합니다.',
      icon: CheckSquare,
      accentColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      id: 'admin',
      title: '행정 & 관리',
      subtitle: 'Admin & Management',
      desc: '영수증 자동 전사 대장, 교내 특별실 사용 신청 조율, 분실물 등록 및 공용 물품 대여를 모니터링합니다.',
      icon: Settings,
      accentColor: 'text-pink-600',
      bgColor: 'bg-rose-50',
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
      {/* Hero Section - Matched with Reference (학교문서AI) */}
      <section className="bg-gradient-to-r from-indigo-900 to-purple-800 text-white py-20 px-6 sm:px-12 lg:px-24">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
          
          {/* Left: Left-aligned Texts & Actions */}
          <div className="flex-1 text-left space-y-6">
            {/* Small Gold Tag */}
            <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full py-1.5 px-3">
              <span className="text-[10px] font-bold text-indigo-200 tracking-wide">
                ✨ AI 기반 학교 행정 지원 솔루션
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              학교 행정 업무,<br />
              <span className="text-indigo-200">AI와 함께</span> 쉽고 빠르게
            </h1>

            {/* Subtitle */}
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl leading-relaxed">
              선생님들의 복잡한 행정 서류 작업과 학급 대장을 효율적으로 처리합니다. 
              한글(HWP) 및 엑셀(XLSX) 양식에 완벽히 연동되는 형식으로 행정 업무 시간을 획기적으로 줄여드립니다.
            </p>

            {/* Left aligned Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => setActiveTab('collect')}
                className="bg-white hover:bg-slate-100 text-indigo-900 font-extrabold text-xs sm:text-sm px-6 py-3.5 rounded-xl transition shadow"
              >
                📝 행정 도구 시작
              </button>
              
              <button
                onClick={() => alert('스쿨독 소개 가이드를 엽니다.')}
                className="border border-white/30 hover:bg-white/10 text-white font-extrabold text-xs sm:text-sm px-6 py-3.5 rounded-xl transition"
              >
                ⚙️ 서비스 소개
              </button>
            </div>
          </div>

          {/* Right: Search Box inside Hero */}
          <div className="w-full lg:w-96 bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-6 shadow-xl">
            <h4 className="text-xs font-bold text-indigo-200 mb-3">빠른 도구 이동</h4>
            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="도구 키워드 검색 (예: 생기부, 영수증)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-10 py-3 rounded-xl bg-white text-slate-800 placeholder-slate-400 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition shadow-sm"
              >
                검색하기
              </button>
            </form>
          </div>

        </div>
      </section>

      {/* Categories Introduction Section - Centered */}
      <section className="max-w-6xl mx-auto pt-16 pb-20 px-6">
        <div className="text-center mb-12 space-y-3 animate-fade-in">
          <span className="inline-block text-[10px] font-bold bg-indigo-50 border border-indigo-150 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider">
            10가지 행정 서비스
          </span>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            필요한 도구를 선택하세요
          </h2>
          <p className="text-xs text-slate-400 font-semibold max-w-md mx-auto leading-relaxed">
            선생님의 업무 강도를 낮추기 위해 검증된 분야별 행정 보조 도구를 제공합니다
          </p>
        </div>

        {/* Categories Card Grid - Notion/SaaS clean style */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                onClick={() => setActiveTab(service.id)}
                className="bg-white border border-slate-200/60 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-350 hover:shadow-lg transition-all duration-300 cursor-pointer min-h-[220px] group"
              >
                <div>
                  {/* Pastel Rounded Square Icon Box */}
                  <div className="flex items-center gap-3.5 mb-5">
                    <div className={`w-10 h-10 rounded-xl ${service.bgColor} flex items-center justify-center ${service.accentColor} border border-slate-100 flex-shrink-0`}>
                      <Icon className="w-5 h-5" />
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

                <div className="text-[11px] font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-0.5 pt-3.5 border-t border-slate-100 transition-colors">
                  <span>작성하기</span>
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
