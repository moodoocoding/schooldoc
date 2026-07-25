import React from 'react';
import { 
  Filter, Calendar, Share2, Grid, Link, MessageSquare, Paperclip
} from 'lucide-react';
import { Workmate } from './Workmate';
import { Classmate } from './Classmate';

interface KanbanWorkspaceProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  activeToolId: string | null;
  setActiveToolId: (toolId: string | null) => void;
}

interface ToolCard {
  id: string;
  title: string;
  desc: string;
  priority: string;
  priorityBg: string;
  priorityText: string;
  responses: number;
  timeSaved: string;
  imgBg: string;
  category: 'collect' | 'evaluation' | 'admin';
}

export const KanbanWorkspace: React.FC<KanbanWorkspaceProps> = ({
  activeCategory,
  activeToolId,
  setActiveToolId,
}) => {

  const tools: ToolCard[] = [
    // Column 1: 수합 & 서명 (collect)
    {
      id: 'notice-collect',
      title: '뚝딱 서류 수합기',
      desc: '가정통신문 및 동의서 PDF를 업로드하고 서명란 지정 후 링크/QR로 응답을 수합해요.',
      priority: '🔥 즉시 실행',
      priorityBg: 'bg-rose-100/80',
      priorityText: 'text-rose-700',
      responses: 28,
      timeSaved: '1분',
      imgBg: 'from-orange-100 via-amber-100 to-yellow-200',
      category: 'collect',
    },
    {
      id: 'registry-sign',
      title: '등록부 서명 수합기',
      desc: '등록부 명단을 만들고 링크를 공유해 참석자 터치 서명을 받아 PDF로 저장하세요.',
      priority: '🔒 안심 인증',
      priorityBg: 'bg-emerald-100/80',
      priorityText: 'text-emerald-700',
      responses: 18,
      timeSaved: '2분',
      imgBg: 'from-rose-100 via-pink-100 to-orange-100',
      category: 'collect',
    },
    {
      id: 'doc-sign',
      title: '문서 서명 받기',
      desc: '결재·계약 등 한 문서에 여러 명의 서명이 필요할 때 PDF에 칸을 지정하고 서명을 수집합니다.',
      priority: '📂 HWP/XLSX 연동',
      priorityBg: 'bg-blue-100/80',
      priorityText: 'text-blue-700',
      responses: 15,
      timeSaved: '3분',
      imgBg: 'from-blue-100 via-indigo-100 to-slate-200',
      category: 'collect',
    },

    // Column 2: 평가 & 조회 (evaluation)
    {
      id: 'student-lookup',
      title: '개별 데이터 안심 조회',
      desc: '성적 엑셀을 올리면 학생은 본인 이름+인증키로 본인 결과만 안전하게 조회해요.',
      priority: '🔒 안심 인증',
      priorityBg: 'bg-emerald-100/80',
      priorityText: 'text-emerald-700',
      responses: 42,
      timeSaved: '1분',
      imgBg: 'from-red-100 via-orange-100 to-amber-200',
      category: 'evaluation',
    },
    {
      id: 'life-record',
      title: '생활기록부 문구 생성',
      desc: '학생별 맞춤 세특 문구를 AI가 키워드 조합 및 성향 분석을 바탕으로 자연스럽게 생성합니다.',
      priority: '✨ AI 자동화',
      priorityBg: 'bg-amber-100/80',
      priorityText: 'text-amber-700',
      responses: 35,
      timeSaved: '5분',
      imgBg: 'from-purple-100 via-indigo-100 to-sky-200',
      category: 'evaluation',
    },
    {
      id: 'eval-plan',
      title: '평가 계획 작성 도우미',
      desc: '성취기준을 입력하면 수업·평가 계획 및 상/중/하 채점 루브릭 매트릭스를 자동 생성해 드려요.',
      priority: '✨ AI 자동화',
      priorityBg: 'bg-amber-100/80',
      priorityText: 'text-amber-700',
      responses: 12,
      timeSaved: '4분',
      imgBg: 'from-emerald-100 via-teal-100 to-cyan-200',
      category: 'evaluation',
    },

    // Column 3: 행정 & 관리 (admin)
    {
      id: 'receipt-auto',
      title: '영수증 자동 정리',
      desc: '영수증 이미지를 올리면 AI OCR이 가액, 부가세, 상호명을 자동 파싱해 엑셀로 정리해요.',
      priority: '✨ AI 자동화',
      priorityBg: 'bg-amber-100/80',
      priorityText: 'text-amber-700',
      responses: 14,
      timeSaved: '2분',
      imgBg: 'from-amber-100 via-yellow-100 to-green-100',
      category: 'admin',
    },
    {
      id: 'special-room',
      title: '특별실 사용 신청',
      desc: '과학실, 컴퓨터실, 강당 등 교내 특별실 대여 일정을 조율하고 실시간 예약을 관리합니다.',
      priority: '🔥 즉시 실행',
      priorityBg: 'bg-rose-100/80',
      priorityText: 'text-rose-700',
      responses: 9,
      timeSaved: '1분',
      imgBg: 'from-blue-100 via-cyan-100 to-teal-100',
      category: 'admin',
    },
    {
      id: 'lost-found',
      title: '분실물 통합 관리',
      desc: '교내 습득물과 분실물 사진을 게시하여 학생들과 신속하게 매칭 공지를 띄웁니다.',
      priority: '📂 HWP/XLSX 연동',
      priorityBg: 'bg-blue-100/80',
      priorityText: 'text-blue-700',
      responses: 6,
      timeSaved: '1분',
      imgBg: 'from-pink-100 via-purple-100 to-rose-200',
      category: 'admin',
    },
  ];

  const columns = [
    { id: 'collect', title: '수합 & 서명 센터', subTitle: '가정통신문 · 동의서 · 서명', dotColor: 'bg-amber-400', cards: tools.filter(t => t.category === 'collect') },
    { id: 'evaluation', title: '평가 & 조회 센터', subTitle: '성적조회 · AI세특 · 루브릭', dotColor: 'bg-orange-400', cards: tools.filter(t => t.category === 'evaluation') },
    { id: 'admin', title: '행정 & 관리 센터', subTitle: '영수증 · 특별실 · 분실물', dotColor: 'bg-emerald-400', cards: tools.filter(t => t.category === 'admin') },
  ];

  const visibleColumns = activeCategory === 'all' 
    ? columns 
    : columns.filter(c => c.id === activeCategory);

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
      
      {/* Active Tool Simulator Modal */}
      {activeToolId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden my-auto border border-slate-150">
            <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-amber-400">✨</span>
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
                  <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto text-xl shadow-inner">
                    💡
                  </div>
                  <h3 className="font-extrabold text-base text-slate-800">
                    [{tools.find(t => t.id === activeToolId)?.title}] 기능 체험 모듈
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold max-w-md mx-auto leading-relaxed">
                    선생님의 시무 서류 생태계를 보장하기 위한 시뮬레이터입니다. <br />
                    Vercel 상용 배포 및 Supabase DB 연동 시 학생용 제출 링크가 바로 연결됩니다.
                  </p>
                  <button
                    onClick={() => setActiveToolId(null)}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow transition"
                  >
                    목록으로 돌아가기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Header (Customized for SchoolDoc Domain) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Title & Link Icons */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            스쿨독 교무 행정 센터
          </h1>
          <div className="flex items-center gap-1 text-slate-400">
            <button className="p-1.5 hover:bg-slate-200/60 rounded-lg transition-colors" title="업무 가이드">
              <Link className="w-4 h-4" />
            </button>
            <button className="p-1.5 hover:bg-slate-200/60 rounded-lg transition-colors" title="학생 제출 URL">
              <Link className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Sub Actions (+ 학급 교사 추가, Avatars, 서식 공유, View Mode) */}
        <div className="flex items-center gap-3">
          <button className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">
            + 학급 교사 추가
          </button>
          
          {/* Member Avatars */}
          <div className="flex items-center -space-x-2">
            <div className="w-7 h-7 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-[10px] font-black text-slate-900" title="김교사">
              김
            </div>
            <div className="w-7 h-7 rounded-full bg-blue-400 border-2 border-white flex items-center justify-center text-[10px] font-black text-white" title="이교사">
              이
            </div>
            <div className="w-7 h-7 rounded-full bg-purple-400 border-2 border-white flex items-center justify-center text-[10px] font-black text-white" title="박교사">
              박
            </div>
            <div className="w-7 h-7 rounded-full bg-rose-300 border-2 border-white flex items-center justify-center text-[10px] font-bold text-rose-700">
              +2
            </div>
          </div>

          <button className="bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 font-bold text-xs px-3.5 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5" />
            <span>서식 공유</span>
          </button>

          <button className="bg-white border border-slate-200/80 hover:bg-slate-50 p-2 rounded-xl text-slate-600 transition shadow-xs">
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter & Date Pills Row */}
      <div className="flex items-center gap-3">
        <button className="bg-white border border-slate-200/80 hover:bg-slate-50 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 transition shadow-xs flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>분류 필터</span>
        </button>

        <button className="bg-white border border-slate-200/80 hover:bg-slate-50 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 transition shadow-xs flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>오늘의 일과</span>
        </button>
      </div>

      {/* Kanban 3-Column Layout (Customized for School Administrative Categories) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {visibleColumns.map((col) => (
          <div key={col.id} className="space-y-4">
            
            {/* Column Title Header */}
            <div className="flex items-center justify-between pb-2 border-b-2 border-slate-200/60">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`}></span>
                <h3 className="font-black text-sm text-slate-800">{col.title}</h3>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full">
                  {col.cards.length}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-400">{col.subTitle}</span>
            </div>

            {/* Cards in Column */}
            <div className="space-y-4">
              {col.cards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => setActiveToolId(card.id)}
                  className="bg-white rounded-2xl p-5 border border-[#e1dfdd]/90 shadow-[0_2px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-blue-400/80 transition-all duration-200 group cursor-pointer space-y-3.5"
                >
                  {/* Priority / Status Tag Pill */}
                  <div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-md ${card.priorityBg} ${card.priorityText}`}>
                      {card.priority}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <h4 className="font-black text-slate-900 text-sm group-hover:text-[#0f6cbd] transition-colors">
                      {card.title}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                      {card.desc}
                    </p>
                  </div>

                  {/* Artwork Illustration Thumbnail */}
                  <div className={`w-full h-28 rounded-xl bg-gradient-to-tr ${card.imgBg} flex items-center justify-center p-4 relative overflow-hidden group-hover:scale-[1.01] transition-transform`}>
                    <div className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-xl flex items-center justify-center text-[#0f6cbd] shadow-sm font-black text-base">
                      📄
                    </div>
                  </div>

                  {/* Bottom Stats: Avatars + Teacher Workflow Metrics */}
                  <div className="flex items-center justify-between pt-2 text-[11px] font-bold text-slate-400 border-t border-slate-50">
                    {/* Avatars */}
                    <div className="flex items-center -space-x-1.5">
                      <div className="w-5 h-5 rounded-full bg-amber-400 border border-white flex items-center justify-center text-[8px] font-black text-slate-900">
                        김
                      </div>
                      <div className="w-5 h-5 rounded-full bg-blue-400 border border-white flex items-center justify-center text-[8px] font-black text-white">
                        이
                      </div>
                    </div>

                    {/* Meta Stats */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span>수합 {card.responses}건</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                        <span>절감 {card.timeSaved}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};
