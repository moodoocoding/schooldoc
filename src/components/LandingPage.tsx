import React, { useState } from 'react';
import { Sparkles, Users, Calendar, FolderOpen, MessageSquare, Search, ArrowRight, CheckCircle2, TrendingUp, Compass } from 'lucide-react';

interface LandingPageProps {
  setActiveTab: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ setActiveTab }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const services = [
    {
      id: 'workmate',
      title: '워크메이트 (Workmate)',
      desc: '생활기록부 세특 초안 생성, 학급 공문 양식 및 가정통신문 기획 업무를 돕는 AI 행정 비서',
      icon: Sparkles,
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50/50',
      features: ['AI 생기부 세특 작성', '바이트 수 계산기', '가정통신문 초안 작성', '수행평가 채점 루브릭'],
    },
    {
      id: 'classmate',
      title: '클래스메이트 (Classmate)',
      desc: '모둠 구성, 자리 배치표 셔플, 럭키드로우 발표 추첨과 비밀 투표를 포함한 학급 운영 시스템',
      icon: Users,
      textColor: 'text-slate-700',
      bgColor: 'bg-slate-100/70',
      features: ['인터랙티브 자리 배치', '발표자 애니메이션 추첨', '반장 선거/비밀 투표', '모둠 구성기'],
    },
    {
      id: 'timetable',
      title: '시간표 / 일정 (Timetable)',
      desc: '요일 및 교시별 학급 시간표 빌더와 매주 누적되는 교과 수업 시수 자동 통계 시각화',
      icon: Calendar,
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50/50',
      features: ['교시별 과목 등록', '주간 시수 자동 계산', '학업 일정 체크리스트'],
    },
    {
      id: 'infomate',
      title: '인포메이트 자료실 (Infomate)',
      desc: '결석사유서, 현장체험학습 등 필수 학교 서식 제공 및 교사를 위한 유용한 웹 사이트 모음',
      icon: FolderOpen,
      textColor: 'text-slate-700',
      bgColor: 'bg-slate-100/70',
      features: ['행정 서식 프리뷰/다운로드', 'NEIS/에듀넷 바로가기집', '공문서 작성 가이드'],
    },
    {
      id: 'community',
      title: '소통공간 (Community)',
      desc: '행정 노하우 질의응답 및 학급 운영 고민 나눔을 위한 교직원 전용 익명 소통 커뮤니티',
      icon: MessageSquare,
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50/50',
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
    <div className="bg-slate-50 min-h-screen font-sans">
      {/* Calm & Airy Hero Section */}
      <section className="bg-white border-b border-slate-100 py-24 px-6 sm:px-12 lg:px-24">
        <div className="max-w-4xl mx-auto text-center">
          
          {/* Subtitle tag */}
          <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-full py-1.5 px-3.5 mb-6">
            <Compass className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500 tracking-wide">
              차분하고 정돈된 교직원 업무 캔버스
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-800 mb-6 leading-tight">
            선생님의 일과에 <span className="text-indigo-600 font-black">평온함</span>을 더하는, 스쿨독
          </h1>

          <p className="text-sm sm:text-base text-slate-400 font-medium mb-12 leading-relaxed max-w-xl mx-auto">
            번잡한 행정 서류 작성부터 학급 운영, 시수 계산과 정보 공유까지.<br />
            정돈된 UI/UX 환경에서 조용하고 신속하게 행정 일과를 매듭지으세요.
          </p>

          {/* Minimal Search Bar */}
          <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto mb-16">
            <div className="relative">
              <input
                type="text"
                placeholder="어떤 행정 도구를 사용하시겠어요? (예: 생기부 세특, 자리배치)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-24 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-300 focus:bg-white transition-all shadow-sm"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
              >
                검색
              </button>
            </div>
          </form>

          {/* Clean Muted Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto py-4 border-t border-slate-100 text-center">
            <div>
              <div className="text-xl font-bold text-slate-700">60%</div>
              <div className="text-[10px] text-slate-400 font-bold">평균 행정 시간 감소</div>
            </div>
            <div className="border-x border-slate-100">
              <div className="text-xl font-bold text-slate-700">12,400+</div>
              <div className="text-[10px] text-slate-400 font-bold">전국 활성 교사 수</div>
            </div>
            <div>
              <div className="text-xl font-bold text-slate-700">98.5%</div>
              <div className="text-[10px] text-slate-400 font-bold">사용 만족도</div>
            </div>
          </div>

        </div>
      </section>

      {/* Services Grid Section */}
      <section className="max-w-6xl mx-auto py-16 px-6">
        <div className="text-left mb-12">
          <h2 className="text-xl font-bold text-slate-800">핵심 기능 카탈로그</h2>
          <p className="text-xs text-slate-400 mt-1 font-semibold">각 도구를 선택하여 간편하게 교무 업무를 정리해 보세요.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                onClick={() => setActiveTab(service.id)}
                className="bg-white rounded-2xl p-6 border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className={`w-10 h-10 rounded-xl ${service.bgColor} flex items-center justify-center mb-5`}>
                    <Icon className={`w-5 h-5 ${service.textColor}`} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mb-5 leading-relaxed">
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

                <div className="flex items-center text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 mt-auto pt-4 border-t border-slate-50 transition-colors">
                  <span>실행하기</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust & Promotion Banner */}
      <section className="bg-slate-100/50 border-t border-slate-200/50 py-16 px-6 text-center">
        <div className="max-w-2xl mx-auto flex flex-col items-center">
          <TrendingUp className="w-6 h-6 text-slate-400 mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-2">클라우드 데이터 자동 연동</h3>
          <p className="text-xs text-slate-400 font-medium max-w-md mb-6 leading-relaxed">
            별도의 복잡한 설치 없이 브라우저에 임시 기록되고, 템플릿 환경 변수를 통해 간편하게 Supabase 클라우드 데이터베이스와 동기화할 수 있습니다.
          </p>
          <button 
            onClick={() => setActiveTab('workmate')}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            업무 도구 시작하기
          </button>
        </div>
      </section>
    </div>
  );
};
