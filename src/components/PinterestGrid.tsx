import React, { useState } from 'react';
import { 
  Sparkles, FileText, ShieldCheck, Mail, 
  Signature, Receipt, GraduationCap, FileCode, Landmark, 
  HelpCircle, Heart
} from 'lucide-react';
import { Workmate } from './Workmate';
import { Classmate } from './Classmate';

interface ToolItem {
  id: string;
  title: string;
  desc: string;
  category: 'collect' | 'evaluation' | 'admin';
  icon: any;
  tags: string[];
  bannerBg: string;
  cardHeight: string;
}

interface PinterestGridProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  activeToolId: string | null;
  setActiveToolId: (toolId: string | null) => void;
}

export const PinterestGrid: React.FC<PinterestGridProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  activeToolId,
  setActiveToolId,
}) => {
  const [bookmarkedTools, setBookmarkedTools] = useState<string[]>(['notice-collect', 'life-record']);

  const tools: ToolItem[] = [
    {
      id: 'notice-collect',
      title: '뚝딱 서류 수합기',
      desc: '가정통신문 및 동의서 PDF를 올리고 입력 영역을 지정한 뒤, 전용 링크/QR로 안전하게 수합해요.',
      category: 'collect',
      icon: Mail,
      tags: ['#가정통신문', '#QR수합', '#PDF'],
      bannerBg: 'from-rose-400 via-pink-400 to-red-500',
      cardHeight: 'h-64',
    },
    {
      id: 'life-record',
      title: '생활기록부 문구 생성',
      desc: '학생별 과목 세특과 행동발달 문구를 AI가 키워드 조합으로 맞춤 완성합니다. NEIS 글자수 자동 산출!',
      category: 'evaluation',
      icon: Sparkles,
      tags: ['#AI세특', '#NEIS글자수', '#행발'],
      bannerBg: 'from-purple-500 via-indigo-500 to-blue-500',
      cardHeight: 'h-72',
    },
    {
      id: 'receipt-auto',
      title: '영수증 자동 정리',
      desc: '영수증 촬영 사진을 올리면 AI OCR이 가액, 부가세, 상호명을 자동 텍스트 파싱하여 엑셀표로 만듭니다.',
      category: 'admin',
      icon: Receipt,
      tags: ['#OCR인식', '#엑셀변환', '#품의서'],
      bannerBg: 'from-amber-400 via-orange-500 to-amber-600',
      cardHeight: 'h-64',
    },
    {
      id: 'student-lookup',
      title: '개별 데이터 안심 조회',
      desc: '성적 및 평가 엑셀을 올리면, 학생은 본인 이름과 인증키로 다른 학생 정보 노출 없이 결과만 확인해요.',
      category: 'evaluation',
      icon: ShieldCheck,
      tags: ['#개인정보보호', '#성적조회', '#안심링크'],
      bannerBg: 'from-emerald-400 via-teal-500 to-green-600',
      cardHeight: 'h-80',
    },
    {
      id: 'registry-sign',
      title: '등록부 서명 수합기',
      desc: '각종 교직원 회의 등록부 명단을 만들고, 스마트폰 터치 서명을 모아 공문서 결재용 PDF로 저장하세요.',
      category: 'collect',
      icon: Signature,
      tags: ['#터치서명', '#회의록', '#결재서식'],
      bannerBg: 'from-sky-400 via-blue-500 to-indigo-600',
      cardHeight: 'h-64',
    },
    {
      id: 'special-room',
      title: '특별실 사용 신청',
      desc: '과학실, 컴퓨터실, 강당 등 교내 특별실 사용 타임라인 일정을 교사 간 중복 없이 실시간 조정해요.',
      category: 'admin',
      icon: Landmark,
      tags: ['#특별실예약', '#타임라인', '#교내시설'],
      bannerBg: 'from-indigo-400 via-purple-500 to-pink-500',
      cardHeight: 'h-72',
    },
    {
      id: 'eval-plan',
      title: '평가 계획 작성 도우미',
      desc: '수업 성취기준을 넣으면 상/중/하 채점 루브릭 매트릭스 성취도 평가표를 즉각 생성해 드립니다.',
      category: 'evaluation',
      icon: FileCode,
      tags: ['#루브릭', '#성취기준', '#평가계획'],
      bannerBg: 'from-teal-400 via-emerald-500 to-cyan-600',
      cardHeight: 'h-64',
    },
    {
      id: 'doc-sign',
      title: '문서 서명 받기',
      desc: '계약서나 외부 문서 서명이 필요할 때, 서명란 포지션을 지정하여 개별 비대면 서명을 수집합니다.',
      category: 'collect',
      icon: FileText,
      tags: ['#비대면서명', '#계약서', '#전자문서'],
      bannerBg: 'from-rose-500 via-red-500 to-orange-500',
      cardHeight: 'h-72',
    },
    {
      id: 'lost-found',
      title: '분실물 통합 게시판',
      desc: '교내 습득 분실물의 사진과 분실 장소를 등록하고, 학생 보관함 찾기 매칭 공지를 띄웁니다.',
      category: 'admin',
      icon: HelpCircle,
      tags: ['#분실물', '#습득물공지', '#사진공유'],
      bannerBg: 'from-violet-400 via-purple-600 to-indigo-700',
      cardHeight: 'h-64',
    },
    {
      id: 'cert-collect',
      title: '연수 이수증 자동 수합',
      desc: '교원 직무연수 이수증 PDF/이미지를 한 번에 수합하고 이수시간을 자동으로 산출 집계합니다.',
      category: 'collect',
      icon: GraduationCap,
      tags: ['#연수이수증', '#직무연수', '#시간집계'],
      bannerBg: 'from-blue-600 via-indigo-600 to-purple-700',
      cardHeight: 'h-80',
    },
  ];

  // Filter tools based on tab & search query
  const filteredTools = tools.filter((tool) => {
    const matchCategory = 
      activeTab === 'all' || 
      (activeTab === 'bookmark' ? bookmarkedTools.includes(tool.id) : tool.category === activeTab);
    const matchSearch = !searchQuery || 
      tool.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      tool.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const toggleBookmark = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (bookmarkedTools.includes(id)) {
      setBookmarkedTools(bookmarkedTools.filter(b => b !== id));
    } else {
      setBookmarkedTools([...bookmarkedTools, id]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Active Tool Simulator Modal */}
      {activeToolId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden my-auto border border-slate-150">
            <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-rose-500">📌</span>
                <span className="font-extrabold text-sm tracking-tight">
                  {tools.find(t => t.id === activeToolId)?.title} 작업 시뮬레이터
                </span>
              </div>
              <button
                onClick={() => setActiveToolId(null)}
                className="text-xs bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-full transition"
              >
                닫기 ✕
              </button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {activeToolId === 'life-record' || activeToolId === 'eval-plan' ? (
                <Workmate />
              ) : activeToolId === 'notice-collect' ? (
                <Classmate />
              ) : (
                <div className="text-center py-16 space-y-4">
                  <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl shadow-inner">
                    📌
                  </div>
                  <h3 className="font-extrabold text-base text-slate-800">
                    [{tools.find(t => t.id === activeToolId)?.title}] 기능 체험 모듈
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold max-w-md mx-auto leading-relaxed">
                    선생님의 안전한 서류 생태계를 보장하기 위한 시뮬레이터입니다. <br />
                    Vercel 상용 배포 및 Supabase DB 연결 시 실시간 학생 양식 수합 링크가 생성됩니다.
                  </p>
                  <button
                    onClick={() => setActiveToolId(null)}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow transition"
                  >
                    목록으로 돌아가기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pinterest Staggered Grid Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>스쿨독 아이디어 & 행정 도구 핀</span>
            <span className="text-xs font-bold bg-rose-100 text-rose-600 px-2.5 py-1 rounded-full">
              {filteredTools.length}개의 도구
            </span>
          </h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            원하는 카드를 마우스 오버하고 영감을 얻어 바로 행정 업무를 시작하세요.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${activeTab === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            전체
          </button>
          <button 
            onClick={() => setActiveTab('collect')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${activeTab === 'collect' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            수합 & 서명
          </button>
          <button 
            onClick={() => setActiveTab('evaluation')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${activeTab === 'evaluation' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            평가 & 조회
          </button>
          <button 
            onClick={() => setActiveTab('admin')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${activeTab === 'admin' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            행정 & 관리
          </button>
        </div>
      </div>

      {/* Pinterest Signature Masonry Card Columns */}
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          const isBookmarked = bookmarkedTools.includes(tool.id);

          return (
            <div
              key={tool.id}
              onClick={() => setActiveToolId(tool.id)}
              className="break-inside-avoid bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 group cursor-pointer relative"
            >
              {/* Card Top Banner Area with Vibrant Pastel Gradients */}
              <div className={`w-full ${tool.cardHeight} bg-gradient-to-br ${tool.bannerBg} p-6 flex flex-col justify-between relative overflow-hidden`}>
                
                {/* Background Geometric Accent */}
                <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>

                {/* Top Actions: Category Badge & Bookmark Pin */}
                <div className="flex justify-between items-center z-10">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full border border-white/20">
                    {tool.category}
                  </span>

                  <button
                    onClick={(e) => toggleBookmark(e, tool.id)}
                    className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-md flex items-center justify-center text-white transition-all transform hover:scale-110"
                  >
                    <Heart className={`w-4.5 h-4.5 ${isBookmarked ? 'fill-white text-white' : ''}`} />
                  </button>
                </div>

                {/* Center Icon Graphic */}
                <div className="my-auto text-center z-10 transform group-hover:scale-110 transition-transform duration-300">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white mx-auto shadow-lg">
                    <Icon className="w-8 h-8" />
                  </div>
                </div>

                {/* Pinterest Hover Overlay with Signature Red "실행하기 📌" Pill Button */}
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4 z-20">
                  <button className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-6 py-3 rounded-full shadow-lg transform group-hover:scale-105 transition-all flex items-center gap-1.5">
                    <span>도구 실행하기</span>
                    <span>📌</span>
                  </button>
                </div>
              </div>

              {/* Card Bottom Description Content */}
              <div className="p-5 space-y-3">
                <h3 className="font-extrabold text-slate-800 text-base group-hover:text-rose-600 transition-colors tracking-tight">
                  {tool.title}
                </h3>

                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  {tool.desc}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {tool.tags.map((tag, idx) => (
                    <span key={idx} className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
