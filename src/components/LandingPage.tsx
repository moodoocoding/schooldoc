import React, { useState } from 'react';
import { Sparkles, Users, Calendar, FolderOpen, MessageSquare, Search, ArrowRight, CheckCircle2, TrendingUp, Cpu } from 'lucide-react';

interface LandingPageProps {
  setActiveTab: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ setActiveTab }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const services = [
    {
      id: 'workmate',
      title: '워크메이트 (Workmate)',
      desc: 'AI를 활용한 생활기록부 문장 생성 및 가정통신문, 평가 계획 등 서류 작업 자동화 도구 모음',
      icon: Sparkles,
      color: 'from-pink-500 to-rose-500',
      textColor: 'text-rose-500',
      bgColor: 'bg-rose-50',
      features: ['AI 생기부 세특 작성', '바이트 수 계산기', '가정통신문 초안 작성', '수행평가 채점 루브릭'],
    },
    {
      id: 'classmate',
      title: '클래스메이트 (Classmate)',
      desc: '시각적이고 재미있는 인터랙션을 결합한 학급 운영 및 수업용 도구 모음',
      icon: Users,
      color: 'from-amber-500 to-orange-500',
      textColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      features: ['인터랙티브 자리 배치', '발표자 애니메이션 추첨', '반장 선거/비밀 투표', '모둠 구성기'],
    },
    {
      id: 'timetable',
      title: '시간표 / 일정 (Timetable)',
      desc: '개인 시간표 빌더와 주간 시수 및 학기별 교과 시수 통계 분석 도구',
      icon: Calendar,
      color: 'from-emerald-500 to-teal-500',
      textColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      features: ['교시별 과목 등록', '주간 시수 자동 계산', '학업 일정 체크리스트'],
    },
    {
      id: 'infomate',
      title: '인포메이트 자료실 (Infomate)',
      desc: '학교 행정에 필요한 필수 아래한글/엑셀 문서 양식 및 교육용 유용한 사이트 북마크',
      icon: FolderOpen,
      color: 'from-blue-500 to-indigo-500',
      textColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      features: ['행정 서식 프리뷰/다운로드', 'NEIS/에듀넷 바로가기집', '공문서 작성 가이드'],
    },
    {
      id: 'community',
      title: '소통공간 (Community)',
      desc: '전국 선생님들과의 행정 노하우 질의응답 및 수업 자료 나눔을 위한 익명 소통 게시판',
      icon: MessageSquare,
      color: 'from-violet-500 to-purple-500',
      textColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
      features: ['자유 게시판', '행정/공문 Q&A', '수업 공유 자료실', '익명 고민 상담'],
    },
  ];

  // Simple local search matching feature tags or titles
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.toLowerCase();
    if (!query) return;

    if (query.includes('생기부') || query.includes('기록') || query.includes('문구') || query.includes('평가') || query.includes('서류') || query.includes('공문') || query.includes('가정')) {
      setActiveTab('workmate');
    } else if (query.includes('자리') || query.includes('배치') || query.includes('학생') || query.includes('발표') || query.includes('뽑기') || query.includes('투표') || query.includes('선거')) {
      setActiveTab('classmate');
    } else if (query.includes('시간') || query.includes('시수') || query.includes('일정')) {
      setActiveTab('timetable');
    } else if (query.includes('자료') || query.includes('서식') || query.includes('다운') || query.includes('링크')) {
      setActiveTab('infomate');
    } else if (query.includes('소통') || query.includes('커뮤니티') || query.includes('게시판') || query.includes('질문')) {
      setActiveTab('community');
    } else {
      alert('일치하는 도구를 찾지 못했습니다. 주요 키워드(예: 생기부, 자리배치, 시간표 등)로 검색해 주세요.');
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white py-20 px-6 sm:px-12 lg:px-24">
        {/* Decorative lights */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Tagline */}
            <div className="inline-flex items-center gap-2 bg-indigo-500/15 border border-indigo-500/30 rounded-full py-1.5 px-4 mb-6 shadow-sm">
              <Cpu className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span className="text-xs font-bold text-indigo-200 tracking-wide">
                현직 교사 피드백 적극 반영한 스마트 에듀테크
              </span>
            </div>

            {/* Main Hero Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight mb-6 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
              선생님의 일과에 <br className="sm:hidden" />
              <span className="text-indigo-400">여유</span>를 더하는 <span className="underline decoration-indigo-500 decoration-wavy">스쿨독</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 font-medium mb-10 leading-relaxed max-w-2xl mx-auto">
              행정 서류 자동 작성부터 인터랙티브 학급 배치, 주간 시수 관리와 익명 커뮤니티까지 교무실 업무에 필요한 모든 유틸리티를 한번에 관리하세요.
            </p>

            {/* Search Bar - SchoolDocu style */}
            <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto mb-12">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="원하시는 행정 도구나 기능을 검색해보세요 (예: 생기부 세특, 자리배치...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-28 py-4 sm:py-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:text-slate-900 transition-all duration-350 shadow-xl"
                />
                <Search className="w-5 sm:w-6 h-5 sm:h-6 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600" />
                <button
                  type="submit"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-4 py-2 sm:py-2.5 rounded-xl transition shadow-lg"
                >
                  검색
                </button>
              </div>
            </form>

            {/* Stats section */}
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-md text-center">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400">60%</div>
                <div className="text-[10px] sm:text-xs text-slate-400 font-semibold mt-1">평균 행정시간 감소</div>
              </div>
              <div className="border-x border-white/10">
                <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400">12,400+</div>
                <div className="text-[10px] sm:text-xs text-slate-400 font-semibold mt-1">누적 활성 교사수</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400">98.5%</div>
                <div className="text-[10px] sm:text-xs text-slate-400 font-semibold mt-1">현직 교사 서비스 만족도</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid Section */}
      <section className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">스쿨독 핵심 서비스 모듈</h2>
          <p className="text-slate-500 mt-2 font-medium">교사가 오직 교육에만 집중할 수 있도록 복잡한 행정 업무와 학급 운영을 간소화합니다.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.slice(0, 3).map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                onClick={() => setActiveTab(service.id)}
                className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-350 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className={`w-12 h-12 rounded-2xl ${service.bgColor} flex items-center justify-center mb-6`}>
                    <Icon className={`w-6 h-6 ${service.textColor}`} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-3 group-hover:text-indigo-600 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
                    {service.desc}
                  </p>
                  
                  {/* Features tags */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {service.features.map((f, i) => (
                      <span key={i} className="text-xs bg-slate-50 text-slate-600 border border-slate-100 rounded-lg px-2.5 py-1 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-slate-400" />
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-700 mt-auto pt-4 border-t border-slate-50">
                  <span>서비스 바로가기</span>
                  <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          {services.slice(3).map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                onClick={() => setActiveTab(service.id)}
                className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-350 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-2xl ${service.bgColor} flex items-center justify-center mb-6`}>
                      <Icon className={`w-6 h-6 ${service.textColor}`} />
                    </div>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-3 group-hover:text-indigo-600 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
                    {service.desc}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {service.features.map((f, i) => (
                      <span key={i} className="text-xs bg-slate-50 text-slate-600 border border-slate-100 rounded-lg px-2.5 py-1 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-slate-400" />
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-700 mt-auto pt-4 border-t border-slate-50">
                  <span>서비스 바로가기</span>
                  <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust & Promotion Banner */}
      <section className="bg-indigo-50 border-y border-indigo-100 py-12 px-6 text-center">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <TrendingUp className="w-10 h-10 text-indigo-600 mb-4" />
          <h3 className="text-xl font-extrabold text-slate-900 mb-2">교직원 회원들을 위한 클라우드 혜택</h3>
          <p className="text-sm text-slate-600 font-medium max-w-xl mb-6">
            무료 회원 가입 시 작성한 모든 생활기록부 초안, 커스텀 학급 배치표, 주간 시간표 데이터가 안전하게 암호화되어 Supabase 클라우드에 영구 백업됩니다.
          </p>
          <button 
            onClick={() => setActiveTab('workmate')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-md transition-colors"
          >
            지금 바로 시작하기 (무료)
          </button>
        </div>
      </section>
    </div>
  );
};
