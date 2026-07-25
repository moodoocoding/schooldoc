import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck, Send, AlertTriangle, CheckCircle, ShieldAlert, Award, FileText } from 'lucide-react';
import type { EventData, StudentData } from '../types';

interface StudentPortalProps {
  events: EventData[];
  urlEventId: string | null;
  urlStudentId: string | null;
  urlCode: string | null;
  onUpdateEvent: (updatedEvent: EventData) => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  events,
  urlEventId,
  urlStudentId,
  urlCode,
  onUpdateEvent
}) => {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  
  const [authenticatedStudent, setAuthenticatedStudent] = useState<StudentData | null>(null);
  const [activeEvent, setActiveEvent] = useState<EventData | null>(null);
  const [loginError, setLoginError] = useState('');

  // Dispute States
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [disputeText, setDisputeText] = useState('');

  // Handle URL Pre-fill
  useEffect(() => {
    if (urlEventId && events.length > 0) {
      const matchedEvent = events.find(e => e.id === urlEventId);
      if (matchedEvent) {
        setSelectedEventId(urlEventId);
        setActiveEvent(matchedEvent);

        if (urlStudentId && urlCode) {
          const matchedStudent = matchedEvent.students.find(
            s => s.id === urlStudentId && s.accessCode === urlCode
          );
          if (matchedStudent) {
            setAuthenticatedStudent(matchedStudent);
            setStudentName(matchedStudent.name);
            setAccessCode(matchedStudent.accessCode);
            
            // Mark student status as 'viewed' if they were 'unviewed'
            if (matchedStudent.status === 'unviewed') {
              updateStudentStatus(matchedEvent, matchedStudent.id, 'viewed');
            }
          }
        }
      }
    }
  }, [urlEventId, urlStudentId, urlCode, events]);

  const updateStudentStatus = (
    event: EventData, 
    studentId: string, 
    newStatus: StudentData['status'], 
    disputeMsg?: string
  ) => {
    const updatedStudents = event.students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          status: newStatus,
          disputeMessage: disputeMsg !== undefined ? disputeMsg : s.disputeMessage,
          updatedAt: new Date().toISOString()
        };
      }
      return s;
    });

    const updatedEvent = {
      ...event,
      students: updatedStudents
    };

    onUpdateEvent(updatedEvent);
    
    // Update local state if authenticated
    if (authenticatedStudent && authenticatedStudent.id === studentId) {
      setAuthenticatedStudent({
        ...authenticatedStudent,
        status: newStatus,
        disputeMessage: disputeMsg !== undefined ? disputeMsg : authenticatedStudent.disputeMessage,
        updatedAt: new Date().toISOString()
      });
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!selectedEventId) {
      setLoginError('조회할 평가 이벤트를 선택해 주세요.');
      return;
    }

    const event = events.find(e => e.id === selectedEventId);
    if (!event) {
      setLoginError('존재하지 않는 평가 이벤트입니다.');
      return;
    }

    const student = event.students.find(
      s => s.name.trim() === studentName.trim() && s.accessCode.trim() === accessCode.trim()
    );

    if (!student) {
      setLoginError('입력하신 이름 또는 인증번호가 일치하지 않습니다.');
      return;
    }

    setAuthenticatedStudent(student);
    setActiveEvent(event);

    // If student was unviewed, transition to viewed
    if (student.status === 'unviewed') {
      updateStudentStatus(event, student.id, 'viewed');
    }
  };

  const handleConfirm = () => {
    if (!activeEvent || !authenticatedStudent) return;
    updateStudentStatus(activeEvent, authenticatedStudent.id, 'confirmed');
  };

  const handleDisputeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !authenticatedStudent || !disputeText.trim()) return;

    updateStudentStatus(activeEvent, authenticatedStudent.id, 'disputed', disputeText);
    setIsDisputeOpen(false);
    setDisputeText('');
  };

  const handleLogout = () => {
    setAuthenticatedStudent(null);
    setActiveEvent(null);
    setStudentName('');
    setAccessCode('');
    // Remove URL parameters
    window.history.pushState({}, document.title, window.location.pathname);
  };

  // Scores calculations
  const totalScore = authenticatedStudent && activeEvent
    ? activeEvent.criteria.reduce((sum, c) => sum + (authenticatedStudent.scores[c.name] ?? 0), 0)
    : 0;

  const maxTotalScore = activeEvent
    ? activeEvent.criteria.reduce((sum, c) => sum + c.maxScore, 0)
    : 0;

  const percentage = maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0;

  return (
    <div className="max-w-md mx-auto py-4 animate-fadeIn">
      {!authenticatedStudent ? (
        /* Student Login View */
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto text-brand-500">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">개별 데이터 안심 조회</h2>
            <p className="text-xs text-slate-400">
              선생님께 전달받은 조회 링크 또는 인증 정보를 입력하세요.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-sm">
            {loginError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl flex items-start gap-1.5 text-xs border border-red-100">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">1. 평가 이벤트 선택</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-700"
              >
                <option value="">-- 이벤트를 선택하세요 --</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">2. 학생 이름</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="이름 입력 (예: 홍길동)"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">3. 인증번호 (비밀번호)</label>
              <input
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="4자리 숫자 또는 제공 코드"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-700"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-brand-500 to-brand-orange hover:shadow-lg text-white font-bold py-3 rounded-xl transition mt-2 shadow-sm text-sm"
            >
              내 평가 결과 안심 조회하기
            </button>
          </form>

          <div className="border-t border-slate-100 pt-4 flex gap-2 text-[10px] text-slate-400">
            <UserCheck className="w-4 h-4 shrink-0 mt-0.5 text-brand-peach" />
            <p>
              본 시스템은 타인의 성적 조회가 원천 차단되며, 인증된 세션에서 오직 본인의 점수와 개별 피드백만 표시합니다.
            </p>
          </div>
        </div>
      ) : (
        /* Student Report Card View */
        <div className="space-y-4">
          {/* Card Header & Score badge */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md relative overflow-hidden space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black bg-brand-50 text-brand-500 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  개별 평가 통지표
                </span>
                <h3 className="font-bold text-slate-800 text-base mt-2 line-clamp-1">
                  {activeEvent?.title}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  학생명: <strong className="text-slate-700">{authenticatedStudent.name}</strong> ({authenticatedStudent.id})
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-slate-400 hover:text-slate-600 transition"
              >
                닫기
              </button>
            </div>

            {/* Total score ring/visual block */}
            <div className="bg-gradient-to-r from-brand-50 to-brand-100/50 p-4 rounded-2xl flex items-center justify-between border border-brand-100">
              <div className="flex items-center gap-2">
                <Award className="w-8 h-8 text-brand-500" />
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">종합 득점</p>
                  <p className="text-sm font-black text-slate-800">
                    {totalScore} <span className="text-xs text-slate-400 font-medium">/ {maxTotalScore}점</span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-semibold">성취율</p>
                <p className="text-base font-black text-brand-500">{percentage}%</p>
              </div>
            </div>

            {/* Status alerts */}
            {authenticatedStudent.status === 'confirmed' && (
              <div className="p-3 bg-green-50 text-green-700 rounded-xl flex items-center gap-2 text-[11px] border border-green-100 font-semibold">
                <CheckCircle className="w-4 h-4 shrink-0 text-green-600" />
                <span>선생님께 확인 완료 신호를 보냈습니다.</span>
              </div>
            )}

            {authenticatedStudent.status === 'disputed' && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-[11px] border border-red-100 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <div>
                  <span>선생님께 이의 제기 의견을 제출했습니다.</span>
                  <p className="text-[10px] font-medium text-red-500 mt-1 italic">
                    " {authenticatedStudent.disputeMessage} "
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Criteria scoring list */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-4 h-4" /> 세부 평가 항목별 점수
            </h4>
            <div className="space-y-4">
              {activeEvent?.criteria.map((c) => {
                const score = authenticatedStudent.scores[c.name] ?? 0;
                const scorePercent = Math.round((score / c.maxScore) * 100);

                return (
                  <div key={c.name} className="space-y-2 border-b border-slate-50 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <span className="font-bold text-slate-800 text-[13px]">{c.name}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{c.desc}</p>
                      </div>
                      <span className="font-black text-slate-700 shrink-0 ml-4">
                        {score} <span className="text-[10px] text-slate-400 font-medium">/ {c.maxScore}점</span>
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-50 h-2.5 rounded-full overflow-hidden border border-slate-100">
                      <div
                        className="bg-brand-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${scorePercent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* General Feedback Comments */}
          {authenticatedStudent.feedback && (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">선생님의 종합 코멘트 피드백</h4>
              <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100 whitespace-pre-line">
                {authenticatedStudent.feedback}
              </p>
            </div>
          )}

          {/* Interaction area */}
          {authenticatedStudent.status === 'viewed' && (
            <div className="flex gap-2 print:hidden">
              <button
                onClick={() => setIsDisputeOpen(true)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-3 rounded-xl transition text-xs flex justify-center items-center gap-1.5"
              >
                <AlertTriangle className="w-4 h-4 text-red-500" /> 이의 제기 / 의견 작성
              </button>
              <button
                onClick={handleConfirm}
                className="flex-2 bg-gradient-to-r from-brand-500 to-brand-orange hover:shadow-lg text-white font-bold py-3 rounded-xl transition text-xs flex justify-center items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" /> 결과 확인 완료
              </button>
            </div>
          )}

          {/* Dispute Input Dialog */}
          {isDisputeOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
                <div className="text-left">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-5 h-5 text-red-500" /> 이의 제기 / 의견 제출
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    점수나 피드백에 대해 정정이 필요하거나 보완 질문이 있는 경우 의견을 남기면 담당 선생님께 실시간 전달됩니다.
                  </p>
                </div>
                
                <form onSubmit={handleDisputeSubmit} className="space-y-4">
                  <textarea
                    rows={4}
                    value={disputeText}
                    onChange={(e) => setDisputeText(e.target.value)}
                    placeholder="선생님께 전달할 의견을 작성하세요 (예: 피드백 2항목에 맞춰 보완 제작했던 부분에 대해..."
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700"
                    required
                  ></textarea>

                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDisputeOpen(false);
                        setDisputeText('');
                      }}
                      className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-lg transition"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg transition shadow-sm flex items-center justify-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" /> 의견 제출
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
