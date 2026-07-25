import React, { useState } from 'react';
import { Plus, Search, Calendar, Users, ChevronRight, BarChart2 } from 'lucide-react';
import type { EventData } from '../types';

interface TeacherDashboardProps {
  events: EventData[];
  onSelectEvent: (event: EventData) => void;
  onOpenCreateModal: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  events,
  onSelectEvent,
  onOpenCreateModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = events.filter(e =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats calculation
  const totalEvents = events.length;
  const totalStudents = events.reduce((sum, e) => sum + e.students.length, 0);
  const confirmedStudents = events.reduce(
    (sum, e) => sum + e.students.filter(s => s.status === 'confirmed').length,
    0
  );
  const overallConfirmRate = totalStudents > 0 ? Math.round((confirmedStudents / totalStudents) * 100) : 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Banner */}
        <div className="md:col-span-2 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-orange text-white p-6 rounded-2xl shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
            <BarChart2 className="w-64 h-64" />
          </div>
          <div className="z-10">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">안녕하세요, 선생님! 🏫</h1>
            <p className="text-sm opacity-90 mt-2 max-w-md">
              평가 결과를 엑셀로 업로드하고, 학생들에게 안전하고 직관적인 개별 성적 카드를 배포하세요.
            </p>
          </div>
          <div className="mt-6 z-10 flex gap-3">
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-1.5 bg-white text-brand-600 font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition"
            >
              <Plus className="w-5 h-5" /> 새 이벤트 만들기
            </button>
          </div>
        </div>

        {/* Small Stats Grid */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">전체 확인 현황</span>
            <h3 className="text-3xl font-black text-slate-800 mt-1">{overallConfirmRate}%</h3>
            <p className="text-xs text-slate-500 mt-1.5">
              총 {totalStudents}명 중 {confirmedStudents}명이 확인을 완료했습니다.
            </p>
          </div>
          {/* Progress bar */}
          <div className="mt-4">
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-brand-500 to-brand-orange h-full rounded-full transition-all duration-500"
                style={{ width: `${overallConfirmRate}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 mt-1.5 font-medium">
              <span>이벤트 수: {totalEvents}개</span>
              <span>총 학생수: {totalStudents}명</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Events List Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            조회 이벤트 관리 목록
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
              {filteredEvents.length}
            </span>
          </h2>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이벤트 이름 검색..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-bounce" />
            <p className="font-semibold text-slate-700">생성된 이벤트가 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">상단의 '+ 새 이벤트 만들기' 버튼을 눌러 개별 조회를 개설해 보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvents.map((evt) => {
              const studentsCount = evt.students.length;
              const viewedCount = evt.students.filter(s => s.status !== 'unviewed').length;
              const confirmedCount = evt.students.filter(s => s.status === 'confirmed').length;
              const disputedCount = evt.students.filter(s => s.status === 'disputed').length;

              const viewRate = studentsCount > 0 ? Math.round((viewedCount / studentsCount) * 100) : 0;
              const confirmRate = studentsCount > 0 ? Math.round((confirmedCount / studentsCount) * 100) : 0;

              return (
                <div
                  key={evt.id}
                  onClick={() => onSelectEvent(evt)}
                  className="group bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-md hover:border-brand-200 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-48"
                >
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-slate-800 group-hover:text-brand-500 transition line-clamp-1">
                        {evt.title}
                      </h3>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition" />
                    </div>

                    {/* Metadata */}
                    <div className="flex gap-4 text-xs text-slate-400 mt-2 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(evt.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {studentsCount}명
                      </span>
                    </div>
                  </div>

                  {/* Status Progress and Stats */}
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-600">조회 및 확인율</span>
                      <span className="font-bold text-brand-600">
                        확인 {confirmedCount}명 ({confirmRate}%) / 조회 {viewedCount}명 ({viewRate}%)
                      </span>
                    </div>
                    {/* Multi-layered visual bar */}
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                      <div
                        className="bg-brand-500 h-full rounded-l-full transition-all duration-500"
                        style={{ width: `${confirmRate}%` }}
                        title={`확인 완료: ${confirmRate}%`}
                      ></div>
                      <div
                        className="bg-brand-peach h-full transition-all duration-500"
                        style={{ width: `${viewRate - confirmRate}%` }}
                        title={`조회함: ${viewRate - confirmRate}%`}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center pt-2 text-[10px] text-slate-400 border-t border-slate-50">
                      <span>평가 요소: {evt.criteria.length}개</span>
                      {disputedCount > 0 && (
                        <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold">
                          이의제기 접수: {disputedCount}건
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
