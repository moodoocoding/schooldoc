import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { HomeWorkspace } from './components/HomeWorkspace';
import { ToolExecutionPage } from './components/ToolExecutionPage';
import type { SidebarTab, SchoolTool } from './types/schooldoc';
import { MessageSquarePlus, X, CheckCircle2 } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('home');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const [isOpenSuggestion, setIsOpenSuggestion] = useState<boolean>(false);
  const [suggestionText, setSuggestionText] = useState<string>('');
  const [isSuggestionSent, setIsSuggestionSent] = useState<boolean>(false);

  // 10 Core Services matched EXACTLY with user specification
  const allToolsMap: Record<string, SchoolTool> = {
    'student-lookup': {
      id: 'student-lookup',
      name: '학생 결과 안내',
      desc: '엑셀을 올리고 학생별 결과를 안전하게 안내합니다.',
      iconName: 'shield-check',
      status: 'ready',
    },
    'notice-collect': {
      id: 'notice-collect',
      name: '가정통신문 수합',
      desc: '가정통신문의 응답과 보호자 서명을 온라인으로 받습니다.',
      iconName: 'file-signature',
      status: 'in_progress',
      statusText: '응답 28/30명 (미응답 2명)',
    },
    'registry-sign': {
      id: 'registry-sign',
      name: '등록부 서명',
      desc: '회의와 행사 참석자의 서명을 받아 등록부를 완성합니다.',
      iconName: 'clipboard-list',
      status: 'in_progress',
      statusText: '서명 완료 18/20명',
    },
    'data-collect': {
      id: 'data-collect',
      name: '자료 수합',
      desc: '필요한 제출 항목을 만들고 파일과 응답을 한곳에서 받습니다.',
      iconName: 'inbox',
      status: 'ready',
    },
    'doc-sign': {
      id: 'doc-sign',
      name: '문서 서명',
      desc: 'PDF의 서명 위치를 지정하고 비대면 서명을 받습니다.',
      iconName: 'file-pen',
      status: 'ready',
    },
    'receipt-auto': {
      id: 'receipt-auto',
      name: '영수증 정리',
      desc: '영수증을 촬영하면 금액과 상호명을 인식해 표로 정리합니다.',
      iconName: 'receipt',
      status: 'in_progress',
      statusText: '검토 필요 3건',
    },
    'cert-collect': {
      id: 'cert-collect',
      name: '이수증 수합',
      desc: '연수 이수증을 모으고 연수명과 이수 시간을 자동 집계합니다.',
      iconName: 'award',
      status: 'ready',
    },
    'special-room': {
      id: 'special-room',
      name: '특별실 예약',
      desc: '특별실의 사용 가능 시간을 확인하고 예약합니다.',
      iconName: 'calendar-clock',
      status: 'ready',
      statusText: '오늘 예약 4건',
    },
    'lost-found': {
      id: 'lost-found',
      name: '분실물 관리',
      desc: '습득물 사진과 장소를 등록하고 반환 상태를 관리합니다.',
      iconName: 'package-search',
      status: 'ready',
      statusText: '보관 중 6건',
    },
    'item-rent': {
      id: 'item-rent',
      name: '물품 대여',
      desc: '공용 물품의 대여자와 반납 예정일을 관리합니다.',
      iconName: 'package-check',
      status: 'ready',
      statusText: '대여 중 7건',
    },
  };

  const selectedTool = activeToolId ? allToolsMap[activeToolId] : null;

  const handleSendSuggestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim()) return;
    setIsSuggestionSent(true);
    setTimeout(() => {
      setIsSuggestionSent(false);
      setSuggestionText('');
      setIsOpenSuggestion(false);
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] font-sans text-[#0F172A] flex antialiased">
      {/* Sidebar Component */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setActiveToolId(null);
        }}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
        onOpenSuggestionModal={() => setIsOpenSuggestion(true)}
      />

      {/* Right Workspace Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {selectedTool ? (
          <main className="p-4 sm:p-8">
            <ToolExecutionPage
              tool={selectedTool}
              onBack={() => setActiveToolId(null)}
            />
          </main>
        ) : (
          <main className="flex-1">
            {activeTab === 'home' && (
              <HomeWorkspace
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onSelectTool={(id) => setActiveToolId(id)}
                onOpenMobileMenu={() => setIsOpenMobile(true)}
              />
            )}

            {activeTab === 'in_progress' && (
              <div className="max-w-7xl mx-auto p-6 sm:p-8 space-y-6">
                <h1 className="text-2xl font-extrabold text-[#0F172A]">진행 중인 업무</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.values(allToolsMap)
                    .filter((t) => t.statusText)
                    .map((tool) => (
                      <div
                        key={tool.id}
                        onClick={() => setActiveToolId(tool.id)}
                        className="bg-white p-5 rounded-xl border border-[#DCE3EA] shadow-xs hover:border-[#0F6CBD] cursor-pointer transition flex justify-between items-center"
                      >
                        <div>
                          <h3 className="text-base font-bold text-[#0F172A] mb-1">{tool.name}</h3>
                          <p className="text-xs text-[#0F6CBD] font-semibold">{tool.statusText}</p>
                        </div>
                        <span className="text-xs font-semibold bg-[#EFF6FC] text-[#0F6CBD] px-3 py-1.5 rounded-lg">
                          상세 보기 ↗
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {activeTab === 'completed' && (
              <div className="max-w-7xl mx-auto p-6 sm:p-8 space-y-6">
                <h1 className="text-2xl font-extrabold text-[#0F172A]">완료된 문서 및 결과물</h1>
                <div className="bg-white p-8 rounded-xl border border-[#DCE3EA] text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-[#16803C] mx-auto" />
                  <p className="text-base font-bold text-[#0F172A]">완료된 서류 12건 보관 중</p>
                  <p className="text-xs text-[#64748B]">최근 90일 이내에 작성 및 수합 완료된 PDF, 엑셀 문서 목록입니다.</p>
                </div>
              </div>
            )}

            {activeTab === 'roster' && (
              <div className="max-w-7xl mx-auto p-6 sm:p-8 space-y-6">
                <h1 className="text-2xl font-extrabold text-[#0F172A]">학급 명단 관리</h1>
                <div className="bg-white p-8 rounded-xl border border-[#DCE3EA] space-y-4">
                  <p className="text-sm font-semibold text-[#334155]">담임 학급 3학년 2반 명단 (총 25명)</p>
                  <div className="flex gap-2">
                    <button className="bg-[#0F6CBD] text-white text-xs font-semibold px-4 py-2 rounded-lg">
                      + 학생 일괄 등록 (엑셀)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="max-w-7xl mx-auto p-6 sm:p-8 space-y-6">
                <h1 className="text-2xl font-extrabold text-[#0F172A]">스쿨독 환경 설정</h1>
                <div className="bg-white p-8 rounded-xl border border-[#DCE3EA] space-y-4 max-w-xl">
                  <div>
                    <label className="text-xs font-bold text-[#64748B] block mb-1">소속 학교</label>
                    <input type="text" defaultValue="한국초등학교" className="w-full border border-[#DCE3EA] p-2.5 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#64748B] block mb-1">교사 성함</label>
                    <input type="text" defaultValue="김교사" className="w-full border border-[#DCE3EA] p-2.5 rounded-lg text-sm" />
                  </div>
                </div>
              </div>
            )}
          </main>
        )}
      </div>

      {/* 선생님 제안함 Modal */}
      {isOpenSuggestion && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="suggestion-modal-title"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-[#DCE3EA]">
            <div className="flex justify-between items-center border-b border-[#F6F8FB] pb-3">
              <h3 id="suggestion-modal-title" className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                <MessageSquarePlus className="w-5 h-5 text-[#0F6CBD]" />
                <span>선생님 제안함</span>
              </h3>
              <button
                onClick={() => setIsOpenSuggestion(false)}
                className="p-1 text-[#64748B] hover:text-[#0F172A] rounded-lg min-w-[32px] min-h-[32px] flex items-center justify-center"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isSuggestionSent ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-[#16803C] mx-auto animate-bounce" />
                <p className="text-base font-bold text-[#0F172A]">소중한 제안이 전달되었습니다!</p>
                <p className="text-xs text-[#64748B]">선생님의 아이디어를 검토해 기능 개발에 적극 반영하겠습니다.</p>
              </div>
            ) : (
              <form onSubmit={handleSendSuggestion} className="space-y-4">
                <p className="text-xs text-[#334155]">
                  필요하신 교무 서식이나 기능 개선 요청사항을 적어주세요.
                </p>
                <textarea
                  value={suggestionText}
                  onChange={(e) => setSuggestionText(e.target.value)}
                  placeholder="예: 체험학습 보고서 자동 집계 기능이 추가되면 좋겠습니다."
                  className="w-full h-32 border border-[#DCE3EA] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]"
                  required
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpenSuggestion(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F6F8FB] rounded-lg min-h-[44px]"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold bg-[#0F6CBD] hover:bg-[#0F5B9E] text-white rounded-lg shadow-xs min-h-[44px]"
                  >
                    보내기
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
