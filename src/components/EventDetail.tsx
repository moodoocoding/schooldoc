import React, { useState } from 'react';
import { ArrowLeft, Share2, Download, Printer, Copy, Check, MessageSquare, CheckSquare, RefreshCw, XCircle } from 'lucide-react';
import type { EventData, StudentData } from '../types';
import { exportToCSV } from '../utils/excelHelper';

interface EventDetailProps {
  event: EventData;
  onBack: () => void;
  onUpdateEvent: (updatedEvent: EventData) => void;
  onPrintQRs: () => void;
}

export const EventDetail: React.FC<EventDetailProps> = ({
  event,
  onBack,
  onUpdateEvent,
  onPrintQRs
}) => {
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | StudentData['status']>('all');
  const [selectedDisputeStudent, setSelectedDisputeStudent] = useState<StudentData | null>(null);
  const [resolveFeedback, setResolveFeedback] = useState('');

  // Statistics calculations
  const total = event.students.length;
  const unviewed = event.students.filter(s => s.status === 'unviewed').length;
  const viewed = event.students.filter(s => s.status === 'viewed').length;
  const confirmed = event.students.filter(s => s.status === 'confirmed').length;
  const disputed = event.students.filter(s => s.status === 'disputed').length;

  const confirmRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const viewRate = total > 0 ? Math.round(((viewed + confirmed + disputed) / total) * 100) : 0;

  // Filter students
  const filteredStudents = event.students.filter(s => {
    if (statusFilter === 'all') return true;
    return s.status === statusFilter;
  });

  const getPortalLink = () => {
    // Generate portal link with hash params for simulated routing
    const base = window.location.origin + window.location.pathname;
    return `${base}?eventId=${event.id}`;
  };

  const getStudentPortalLink = (student: StudentData) => {
    const base = window.location.origin + window.location.pathname;
    return `${base}?eventId=${event.id}&studentId=${student.id}&code=${student.accessCode}`;
  };

  const handleCopyLink = () => {
    const link = getPortalLink();
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyStudentLink = (student: StudentData) => {
    const link = getStudentPortalLink(student);
    navigator.clipboard.writeText(link);
    setCopiedStudentId(student.id);
    setTimeout(() => setCopiedStudentId(null), 2000);
  };

  // Simulated dispute resolution
  const handleResolveDispute = (studentId: string, action: 'accept' | 'reject') => {
    const updatedStudents = event.students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          status: action === 'accept' ? ('confirmed' as const) : ('viewed' as const),
          feedback: resolveFeedback 
            ? `${s.feedback}\n[교사 조치]: ${resolveFeedback}`
            : s.feedback,
          disputeMessage: undefined,
          updatedAt: new Date().toISOString()
        };
      }
      return s;
    });

    onUpdateEvent({
      ...event,
      students: updatedStudents
    });
    setSelectedDisputeStudent(null);
    setResolveFeedback('');
  };

  const handleManualStatusChange = (studentId: string, newStatus: StudentData['status']) => {
    const updatedStudents = event.students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          status: newStatus,
          updatedAt: new Date().toISOString()
        };
      }
      return s;
    });
    onUpdateEvent({
      ...event,
      students: updatedStudents
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-500 transition"
        >
          <ArrowLeft className="w-5 h-5" /> 대시보드로 돌아가기
        </button>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleCopyLink}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-green-500" /> 링크 복사됨!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" /> 전체 공유 링크
              </>
            )}
          </button>
          <button
            onClick={onPrintQRs}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition"
          >
            <Printer className="w-4 h-4" /> QR 코드 인쇄
          </button>
          <button
            onClick={() => exportToCSV(event)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl transition"
          >
            <Download className="w-4 h-4" /> 결과 내보내기 (CSV)
          </button>
        </div>
      </div>

      {/* Title & Metadata */}
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">{event.title}</h1>
        <p className="text-xs text-slate-500 mt-1">
          개설일: {new Date(event.createdAt).toLocaleString('ko-KR')} | 평가 요소: {event.criteria.length}개
        </p>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: '전체 학생', value: total, color: 'text-slate-800 bg-slate-100/50' },
          { label: '미조회', value: unviewed, color: 'text-slate-400 bg-slate-50' },
          { label: '조회함', value: viewed, color: 'text-blue-600 bg-blue-50/50' },
          { label: '확인완료', value: confirmed, color: 'text-green-600 bg-green-50/50' },
          { label: '이의제기', value: disputed, color: 'text-red-600 bg-red-50/50' }
        ].map((item, i) => (
          <div key={i} className={`p-4 rounded-xl border border-slate-100 flex flex-col justify-between ${item.color}`}>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
            <span className="text-2xl font-black mt-2">{item.value}명</span>
          </div>
        ))}
      </div>

      {/* Summary progress bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
          <span>학생 확인 진행 상황 (목표: 100% 완료)</span>
          <span className="text-slate-700">
            확인율: <strong className="text-brand-500 text-sm font-bold">{confirmRate}%</strong> (조회율: {viewRate}%)
          </span>
        </div>
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
          <div
            className="bg-green-500 h-full rounded-l-full transition-all duration-500"
            style={{ width: `${confirmRate}%` }}
          ></div>
          <div
            className="bg-blue-400 h-full transition-all duration-500"
            style={{ width: `${viewRate - confirmRate}%` }}
          ></div>
        </div>
      </div>

      {/* Active Disputes Section */}
      {disputed > 0 && (
        <div className="bg-red-50/50 border border-red-100 p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-extrabold text-red-800 flex items-center gap-1.5">
            <MessageSquare className="w-5 h-5" /> 이의제기가 접수되었습니다 ({disputed}건)
          </h3>
          <div className="space-y-2">
            {event.students
              .filter(s => s.status === 'disputed')
              .map(student => (
                <div
                  key={student.id}
                  onClick={() => setSelectedDisputeStudent(student)}
                  className="bg-white border border-red-100 p-4 rounded-xl shadow-sm hover:border-red-300 transition cursor-pointer flex justify-between items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{student.name}</span>
                      <span className="text-xs text-slate-400 font-mono">({student.id})</span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1 italic">
                      "{student.disputeMessage}"
                    </p>
                  </div>
                  <button className="text-xs font-semibold bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200 transition shrink-0">
                    상세 검토 및 답변
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filter and Student list Table */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Header Filter */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-700">학생 개별 상태 목록</h3>
          <div className="flex flex-wrap gap-1 text-xs font-semibold">
            {[
              { id: 'all', label: '전체보기' },
              { id: 'unviewed', label: '미조회' },
              { id: 'viewed', label: '조회함' },
              { id: 'confirmed', label: '확인완료' },
              { id: 'disputed', label: '이의제기' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/30 text-slate-600 font-bold border-b border-slate-100 text-xs">
              <tr>
                <th className="px-6 py-3.5">ID/학번</th>
                <th className="px-6 py-3.5">이름</th>
                <th className="px-6 py-3.5 text-center">인증번호</th>
                {event.criteria.map(c => (
                  <th key={c.name} className="px-6 py-3.5 text-center font-medium max-w-[120px] truncate" title={c.name}>
                    {c.name}
                  </th>
                ))}
                <th className="px-6 py-3.5">학생 상태</th>
                <th className="px-6 py-3.5 text-right">간편 조치</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5 + event.criteria.length} className="text-center py-10 text-slate-400 text-xs">
                    해당 상태의 학생이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50/50 group">
                    <td className="px-6 py-3 font-mono text-slate-500 text-xs">{student.id}</td>
                    <td className="px-6 py-3">
                      <div className="font-semibold text-slate-900">{student.name}</div>
                      {student.feedback && (
                        <div className="text-[10px] text-slate-400 max-w-[200px] truncate mt-0.5" title={student.feedback}>
                          {student.feedback}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                        {student.accessCode}
                      </span>
                    </td>
                    {event.criteria.map(c => (
                      <td key={c.name} className="px-6 py-3 text-center font-bold text-slate-700">
                        {student.scores[c.name] ?? 0}
                      </td>
                    ))}
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          student.status === 'unviewed' && 'bg-slate-100 text-slate-400'
                        } ${student.status === 'viewed' && 'bg-blue-50 text-blue-600'} ${
                          student.status === 'confirmed' && 'bg-green-50 text-green-600'
                        } ${student.status === 'disputed' && 'bg-red-50 text-red-600'}`}
                      >
                        {student.status === 'unviewed' && '미확인'}
                        {student.status === 'viewed' && '조회함'}
                        {student.status === 'confirmed' && '확인완료'}
                        {student.status === 'disputed' && '이의제기'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleCopyStudentLink(student)}
                          title="학생 전용 바로가기 링크 복사"
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition"
                        >
                          {copiedStudentId === student.id ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {student.status !== 'confirmed' && (
                          <button
                            onClick={() => handleManualStatusChange(student.id, 'confirmed')}
                            title="확인 완료로 강제 변경"
                            className="p-1.5 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-green-600 transition"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {student.status === 'confirmed' && (
                          <button
                            onClick={() => handleManualStatusChange(student.id, 'viewed')}
                            title="조회 상태로 되돌리기"
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 transition"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispute Resolution Modal */}
      {selectedDisputeStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-xl border border-slate-100">
            <div className="p-6 bg-red-50 border-b border-red-100 flex justify-between items-center">
              <div>
                <h3 className="text-md font-bold text-red-900 flex items-center gap-1.5">
                  <MessageSquare className="w-5 h-5" /> 이의 제기 상세 검토
                </h3>
                <p className="text-xs text-red-700 mt-0.5">{selectedDisputeStudent.name} 학생 ({selectedDisputeStudent.id})</p>
              </div>
              <button 
                onClick={() => setSelectedDisputeStudent(null)}
                className="p-1 rounded-full hover:bg-red-100 text-red-500 transition"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Student scores */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <p className="font-bold text-slate-600 mb-2">학생 현재 점수</p>
                <div className="grid grid-cols-2 gap-2">
                  {event.criteria.map(c => (
                    <div key={c.name} className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="text-slate-500">{c.name}</span>
                      <span className="font-bold text-slate-800">{selectedDisputeStudent.scores[c.name] ?? 0} / {c.maxScore}점</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dispute Content */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">학생의 의견 제출 내용</label>
                <div className="p-3 bg-red-50/30 rounded-lg text-sm text-slate-800 border border-red-100 italic">
                  "{selectedDisputeStudent.disputeMessage}"
                </div>
              </div>

              {/* Teacher response */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">의견 피드백 수정/보완 및 처리 사유</label>
                <textarea
                  rows={3}
                  value={resolveFeedback}
                  onChange={(e) => setResolveFeedback(e.target.value)}
                  placeholder="예: 학생 의견을 검토하여 1번 항목 스케치 의도를 인정, 점수를 10점으로 조정합니다. 또는 타당한 감점 사유를 입력하여 재통보합니다."
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                ></textarea>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-sm">
              <button
                onClick={() => handleResolveDispute(selectedDisputeStudent.id, 'reject')}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg transition"
              >
                의견 반려 (기존 유지)
              </button>
              <button
                onClick={() => handleResolveDispute(selectedDisputeStudent.id, 'accept')}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg transition shadow-sm"
              >
                의견 수용 및 처리 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
