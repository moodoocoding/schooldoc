import React, { useState } from 'react';
import { 
  Sparkles, FileText, Calculator, ShieldCheck, Mail, FolderOpen, 
  Signature, Receipt, GraduationCap, FileCode, Landmark, 
  Package, HelpCircle, Upload
} from 'lucide-react';
import { Workmate } from './Workmate';
import { Classmate } from './Classmate';

interface ToolItem {
  id: string;
  title: string;
  desc: string;
  category: 'collect' | 'evaluation' | 'admin';
  icon: any;
  color: string;
}

interface DashboardProps {
  activeCategory: string;
  setActiveTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ activeCategory }) => {
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  // Tools mapping from user request + screenshot
  const tools: ToolItem[] = [
    // 수합 & 서명 (collect)
    { id: 'notice-collect', title: '뚝딱 서류 수합기', desc: '가정통신문·동의서 등 PDF를 업로드하고 입력 영역을 지정한 뒤, 링크/QR로 응답을 받아요.', category: 'collect', icon: Mail, color: 'bg-emerald-500 text-white' },
    { id: 'data-collect', title: '자료 수합', desc: '문항을 자유롭게 구성해 링크로 자료를 받고, 임시 ID 기반으로 타임라인까지 한 페이지에서 관리해요.', category: 'collect', icon: FolderOpen, color: 'bg-violet-500 text-white' },
    { id: 'registry-sign', title: '등록부 서명 수합기', desc: '등록부 양식과 명단을 만들고, 링크를 공유해 참석자들의 서명을 받아 PDF로 저장하세요.', category: 'collect', icon: Signature, color: 'bg-pink-500 text-white' },
    { id: 'doc-sign', title: '문서 서명 받기', desc: '결제·계약 등 한 문서에 여러 명의 서명이 필요할 때, PDF에 칸을 지정하고 이름별로 서명을 받아요.', category: 'collect', icon: FileText, color: 'bg-indigo-500 text-white' },
    { id: 'cert-collect', title: '연수 이수증 수합', desc: '공유 링크로 이수증을 수합하고 OCR·AI로 자동 정리하세요. 이름·연수명·이수일 등을 자동으로 파악해요.', category: 'collect', icon: GraduationCap, color: 'bg-purple-500 text-white' },

    // 평가 & 조회 (evaluation)
    { id: 'student-lookup', title: '개별 데이터 안심 조회', desc: '엑셀로 평가 데이터를 올리면, 학생은 이름+인증번호나 개인 QR로 본인 결과만 안전하게 조회해요.', category: 'evaluation', icon: ShieldCheck, color: 'bg-orange-500 text-white' },
    { id: 'life-record', title: '생활기록부 문구 생성', desc: '학생별 맞춤 생활기록부 문구를 AI가 키워드 조합 및 성향 분석을 통해 빠르고 자연스럽게 완성하도록 도와드려요.', category: 'evaluation', icon: Sparkles, color: 'bg-emerald-500 text-white' },
    { id: 'eval-plan', title: '평가 계획 작성', desc: '성취기준을 입력하면 수업·평가 계획 및 상/중/하 성취기준 루브릭 매트릭스를 제안해요.', category: 'evaluation', icon: FileCode, color: 'bg-indigo-500 text-white' },
    { id: 'exam-weight', title: '시험 문항 배점 생성기', desc: '총점/문항수/난이도/배점간격을 넣으면 난이도별 배점 및 문항수를 논리적으로 설계 계산해요.', category: 'evaluation', icon: Calculator, color: 'bg-sky-500 text-white' },

    // 행정 & 관리 (admin)
    { id: 'receipt-auto', title: '영수증 자동정리', desc: '영수증 이미지를 올리면 AI가 자동으로 사용 항목, 공급 가액, 부가세 금액을 인식해 표로 정리해요.', category: 'admin', icon: Receipt, color: 'bg-emerald-500 text-white' },
    { id: 'special-room', title: '특별실 사용 신청', desc: '과학실, 컴퓨터실, 도서실 등 교내 주요 특별실의 대여 일정을 조율하고 실시간 예약을 관리합니다.', category: 'admin', icon: Landmark, color: 'bg-amber-500 text-white' },
    { id: 'lost-found', title: '분실물 통합 관리', desc: '교내에서 발생한 습득물과 분실물을 사진 및 날짜별로 게시하여 학생들과 신속하게 매칭합니다.', category: 'admin', icon: HelpCircle, color: 'bg-rose-500 text-white' },
    { id: 'item-rent', title: '물품 대여 관리', desc: '학급 보드게임, 체육 교구, 교사 무선 마이크 등 공용 기자재의 재고 상황과 대여 기한을 모니터링합니다.', category: 'admin', icon: Package, color: 'bg-blue-500 text-white' },
  ];

  // Filter tools based on selected GNB tab
  const displayCategory = activeCategory === 'home' ? 'collect' : activeCategory;
  const filteredTools = tools.filter(t => t.category === displayCategory);

  const handleLaunchTool = (id: string) => {
    setActiveToolId(id);
  };

  // Mock receipt upload state
  const [receiptList, setReceiptList] = useState<{ id: string; store: string; date: string; amount: number }[]>([]);
  const [specialRoomBooking, setSpecialRoomBooking] = useState<{ id: string; room: string; time: string; teacher: string }[]>([
    { id: '1', room: '컴퓨터 1실', time: '월요일 3교시', teacher: '이교사' },
    { id: '2', room: '과학실험실', time: '화요일 2교시', teacher: '박교사' }
  ]);
  const [newRoom, setNewRoom] = useState('과학실험실');
  const [newTime, setNewTime] = useState('수요일 4교시');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {activeToolId ? (
        /* Render Active Tool Panel */
        <div className="bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden animate-scale-up">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-150 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-800 text-sm">
                ⚙️ {tools.find(t => t.id === activeToolId)?.title} 작동 시뮬레이터
              </span>
            </div>
            <button 
              onClick={() => setActiveToolId(null)}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold border border-slate-200 rounded-lg px-3 py-1 bg-white hover:bg-slate-50 transition"
            >
              닫기
            </button>
          </div>

          <div className="p-6">
            {/* Tool 1: AI 생기부 세특 */}
            {activeToolId === 'life-record' && <Workmate />}

            {/* Tool 2: 평가 계획 */}
            {activeToolId === 'eval-plan' && <Workmate />}

            {/* Tool 3: 개별 데이터 안심 조회 */}
            {activeToolId === 'student-lookup' && <Classmate />}

            {/* Tool 4: 영수증 자동정리 */}
            {activeToolId === 'receipt-auto' && (
              <div className="max-w-xl mx-auto text-center space-y-6">
                <h4 className="font-bold text-sm text-slate-800">📸 예산 집행 증빙용 영수증 자동 전사</h4>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 bg-slate-50 hover:bg-slate-100/50 transition cursor-pointer">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                  <span className="text-xs text-slate-500 font-bold block">영수증 이미지 파일 드래그 또는 클릭 업로드</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">JPG, PNG, PDF 지원 (최대 10MB)</span>
                </div>
                <button
                  onClick={() => {
                    const mock = { id: Date.now().toString(), store: '중앙 알파문구', date: '2026-07-25', amount: 34500 };
                    setReceiptList([mock, ...receiptList]);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition"
                >
                  가상 영수증 OCR 분석 실행 (시뮬레이션)
                </button>

                {receiptList.length > 0 && (
                  <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden mt-6">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <th className="p-3">가맹점</th>
                        <th className="p-3">일자</th>
                        <th className="p-3">금액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-slate-700 font-medium">
                      {receiptList.map(r => (
                        <tr key={r.id}>
                          <td className="p-3 font-bold text-slate-800">{r.store}</td>
                          <td className="p-3">{r.date}</td>
                          <td className="p-3 text-indigo-600 font-extrabold">{r.amount.toLocaleString()}원</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tool 5: 특별실 사용 신청 */}
            {activeToolId === 'special-room' && (
              <div className="max-w-xl mx-auto space-y-6">
                <h4 className="font-bold text-sm text-slate-800 text-center">🏫 교내 공동 특별실 실시간 사용 신청 현황</h4>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 border border-slate-150 rounded-2xl text-xs font-semibold">
                  <div>
                    <label className="block text-slate-400 mb-1.5">특별실 선택</label>
                    <select value={newRoom} onChange={(e) => setNewRoom(e.target.value)} className="w-full bg-white border border-slate-200 p-2 rounded-xl">
                      <option>과학실험실</option>
                      <option>컴퓨터 1실</option>
                      <option>어학실</option>
                      <option>체육실</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5">희망 시간대</label>
                    <input type="text" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full bg-white border border-slate-200 p-2 rounded-xl" />
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSpecialRoomBooking([...specialRoomBooking, { id: Date.now().toString(), room: newRoom, time: newTime, teacher: '김교사 (본인)' }]);
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition"
                >
                  사용 예약 승인 요청
                </button>

                <div className="space-y-2 mt-6">
                  <h5 className="text-xs font-bold text-slate-500">예약 대장</h5>
                  {specialRoomBooking.map(b => (
                    <div key={b.id} className="flex justify-between items-center bg-slate-50 border border-slate-150 p-3 rounded-xl text-xs font-bold">
                      <span className="text-slate-800">{b.room} &bull; {b.time}</span>
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{b.teacher}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Remaining Tools Fallback Simulation */}
            {!['life-record', 'eval-plan', 'student-lookup', 'receipt-auto', 'special-room'].includes(activeToolId) && (
              <div className="max-w-md mx-auto text-center py-16 space-y-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 mx-auto rounded-xl flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-800">
                  [{tools.find(t => t.id === activeToolId)?.title}] 서비스 준비 중
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                  본 기능은 학생 및 학부모 수합 연동 모듈이 수반되는 서식입니다. <br />
                  원격 Supabase DB 테이블 구성 및 Vercel 실배포 완료 후 학생용 공개 링크 기능과 함께 연동됩니다.
                </p>
                <button
                  onClick={() => setActiveToolId(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition"
                >
                  대시보드로 돌아가기
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Minimalist Zen-style Category Card Grid */
        <div>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm">📦</span>
            <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">사용 가능한 도구</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div 
                  key={tool.id} 
                  className="bg-white border border-slate-150 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-300 transition-all min-h-[170px]"
                >
                  <div>
                    {/* Tiny Muted Icon & Title */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 flex-shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-xs sm:text-sm">{tool.title}</h4>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-450 text-slate-400 font-medium mb-4">
                      {tool.desc}
                    </p>
                  </div>

                  <button
                    onClick={() => handleLaunchTool(tool.id)}
                    className="text-left text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 mt-auto pt-2"
                  >
                    도구 실행하기 &rarr;
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
