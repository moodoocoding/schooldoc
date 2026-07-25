import React, { useState } from 'react';
import { Sparkles, Users, Calendar, FolderOpen, MessageSquare, Search, ArrowRight, CheckCircle2 } from 'lucide-react';

interface LandingPageProps {
  setActiveTab: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ setActiveTab }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const services = [
    {
      id: 'workmate',
      title: '워크메이트 (Workmate)',
      desc: 'AI 교과세특 문장 생성 및 가정통신문, 수행평가 계획서 자동 작성',
      icon: Sparkles,
      color: 'from-pink-500 to-rose-500',
      textColor: 'text-rose-500',
      bgColor: 'bg-rose-50',
      features: ['AI 생기부 세특 작성', '바이트 수 계산기', '가정통신문 초안 작성', '수행평가 채점 루브릭'],
    },
    {
      id: 'classmate',
      title: '클래스메이트 (Classmate)',
      desc: '모둠 구성, 자리 배치표 셔플, 랜덤 발표자 및 반장 선거 비밀 투표',
      icon: Users,
      color: 'from-amber-500 to-orange-500',
      textColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      features: ['인터랙티브 자리 배치', '발표자 애니메이션 추첨', '반장 선거/비밀 투표', '모둠 구성기'],
    },
    {
      id: 'timetable',
      title: '시간표 / 일정 (Timetable)',
      desc: '교시별 학급 시간표 빌더와 매주 누적되는 교과 수업 시수 자동 통계',
      icon: Calendar,
      color: 'from-emerald-500 to-teal-500',
      textColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      features: ['교시별 과목 등록', '주간 시수 자동 계산', '학업 일정 체크리스트'],
    },
    {
      id: 'infomate',
      title: '인포메이트 자료실 (Infomate)',
      desc: '체험학습 계획서, 결석계 등 공문 서식 및 교사용 필수 사이트 모음',
      icon: FolderOpen,
      color: 'from-blue-500 to-indigo-500',
      textColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      features: ['행정 서식 프리뷰/다운로드', 'NEIS/에듀넷 바로가기집', '공문서 작성 가이드'],
    },
    {
      id: 'community',
      title: '소통공간 (Community)',
      desc: '행정 노하우 질의응답 및 학급 고민 나눔을 위한 교직원 전용 익명 게시판',
      icon: MessageSquare,
      color: 'from-violet-500 to-purple-500',
      textColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
      features: ['자유 게시판', '행정/공문 Q&A', '수업 공유 자료실', '익명 고민 상담'],
    },
  ];

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
      {/* Refined Premium Dark Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white py-16 px-6 sm:px-12">
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-4">
            선생님의 일과에 여유를 더하는 <span className="text-indigo-400">스쿨독</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-450 font-medium mb-8 max-w-lg mx-auto text-slate-300">
            AI 행정문서 자동 작성부터 인터랙티브 학급 배치, 주간 시수 관리까지 교무실 업무에 필요한 모든 유틸리티를 한곳에서 간결하게 처리하세요.
          </p>

          {/* Clean Search Bar */}
          <form onSubmit={handleSearchSubmit} className="max-w-lg mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="필요한 도구를 검색해보세요 (예: 생기부 세특, 자리배치)"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                onClick={() => setActiveTab(service.id)}
                className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className={`w-10 h-10 rounded-xl ${service.bgColor} flex items-center justify-center mb-5`}>
                    <Icon className={`w-5 h-5 ${service.textColor}`} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-semibold mb-4 leading-relaxed">
                    {service.desc}
                  </p>
                  
                  {/* Features tags */}
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {service.features.map((f, i) => (
                      <span key={i} className="text-[10px] bg-slate-50 text-slate-500 border border-slate-100 rounded-lg px-2 py-0.5 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-slate-300" />
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center text-[10px] font-bold text-indigo-600 hover:text-indigo-700 mt-auto pt-4 border-t border-slate-50">
                  <span>실행하기</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
