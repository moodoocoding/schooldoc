import React, { useState, useEffect } from 'react';
import { Plus, BarChart2, Check, Info } from 'lucide-react';
import type { TimetableSlot } from '../types/schooldoc';

export const Timetable: React.FC = () => {
  const days = ['월요일', '화요일', '수요일', '목요일', '금요일'];
  const periods = [1, 2, 3, 4, 5, 6, 7];

  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [editingSlot, setEditingSlot] = useState<{ day: number; period: number } | null>(null);
  const [subjectInput, setSubjectInput] = useState('');
  const [roomInput, setRoomInput] = useState('');

  // Subject color map
  const colorMap: Record<string, string> = {
    '국어': 'bg-red-50 text-red-700 border-red-150',
    '수학': 'bg-blue-50 text-blue-700 border-blue-150',
    '사회': 'bg-amber-50 text-amber-700 border-amber-150',
    '과학': 'bg-purple-50 text-purple-700 border-purple-150',
    '영어': 'bg-pink-50 text-pink-700 border-pink-150',
    '체육': 'bg-emerald-50 text-emerald-700 border-emerald-150',
    '미술': 'bg-orange-50 text-orange-700 border-orange-150',
    '음악': 'bg-teal-50 text-teal-700 border-teal-150',
    '도덕': 'bg-slate-50 text-slate-700 border-slate-150',
    '창체': 'bg-indigo-50 text-indigo-700 border-indigo-150',
  };

  const getSubjectColor = (subject: string) => {
    if (!subject) return 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50';
    return colorMap[subject] || 'bg-indigo-50/50 text-indigo-700 border-indigo-100';
  };

  // Load Timetable Slots
  useEffect(() => {
    const loaded = localStorage.getItem('schooldoc_timetable_slots');
    if (loaded) {
      setSlots(JSON.parse(loaded));
    } else {
      // Mock data for initial view
      const mockSlots: TimetableSlot[] = [
        { day: 1, period: 1, subject: '국어', room: '6-1교실' },
        { day: 1, period: 2, subject: '수학', room: '수학실' },
        { day: 1, period: 5, subject: '체육', room: '운동장' },
        { day: 2, period: 1, subject: '영어', room: '영어실' },
        { day: 2, period: 3, subject: '과학', room: '과학실' },
        { day: 2, period: 4, subject: '사회', room: '6-1교실' },
        { day: 3, period: 2, subject: '음악', room: '음악실' },
        { day: 3, period: 3, subject: '수학', room: '수학실' },
        { day: 3, period: 6, subject: '창체', room: '6-1교실' },
        { day: 4, period: 1, subject: '국어', room: '6-1교실' },
        { day: 4, period: 2, subject: '과학', room: '과학실' },
        { day: 5, period: 3, subject: '미술', room: '미술실' },
        { day: 5, period: 4, subject: '영어', room: '영어실' },
      ];
      setSlots(mockSlots);
      localStorage.setItem('schooldoc_timetable_slots', JSON.stringify(mockSlots));
    }
  }, []);

  const handleCellClick = (dayIdx: number, period: number) => {
    const day = dayIdx + 1;
    const existing = slots.find(s => s.day === day && s.period === period);
    setSubjectInput(existing?.subject || '');
    setRoomInput(existing?.room || '');
    setEditingSlot({ day, period });
  };

  const handleSaveSlot = () => {
    if (!editingSlot) return;
    const { day, period } = editingSlot;

    let updatedSlots = [...slots];
    // Remove if empty
    if (!subjectInput.trim()) {
      updatedSlots = slots.filter(s => !(s.day === day && s.period === period));
    } else {
      const idx = slots.findIndex(s => s.day === day && s.period === period);
      const newSlot: TimetableSlot = {
        day,
        period,
        subject: subjectInput.trim(),
        room: roomInput.trim() || '교실'
      };

      if (idx > -1) {
        updatedSlots[idx] = newSlot;
      } else {
        updatedSlots.push(newSlot);
      }
    }

    setSlots(updatedSlots);
    localStorage.setItem('schooldoc_timetable_slots', JSON.stringify(updatedSlots));
    setEditingSlot(null);
  };

  const handleClearAll = () => {
    if (window.confirm('정말 시간표를 초기화하시겠습니까?')) {
      setSlots([]);
      localStorage.setItem('schooldoc_timetable_slots', JSON.stringify([]));
    }
  };

  // Compile class hours statistics per subject
  const getSubjectStats = () => {
    const stats: Record<string, number> = {};
    slots.forEach(s => {
      stats[s.subject] = (stats[s.subject] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  };

  const stats = getSubjectStats();
  const totalHours = slots.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Timetable Grid */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg mb-1">학급 주간 시간표</h3>
              <p className="text-slate-400 text-xs font-semibold">
                원하는 교시 칸을 눌러 과목명과 장소를 쉽게 입력할 수 있습니다.
              </p>
            </div>
            
            <button
              onClick={handleClearAll}
              className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl font-bold border border-rose-100 transition-colors"
            >
              전체 초기화
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="p-3 w-16 text-xs text-slate-400 font-bold">교시</th>
                  {days.map((day, idx) => (
                    <th key={idx} className="p-3 text-xs text-slate-600 font-extrabold">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periods.map((period) => (
                  <tr key={period} className="h-20">
                    <td className="p-2 font-bold text-slate-400 text-xs bg-slate-50/50 rounded-lg">
                      {period}교시
                    </td>
                    {days.map((_, dayIdx) => {
                      const day = dayIdx + 1;
                      const slot = slots.find(s => s.day === day && s.period === period);
                      
                      return (
                        <td 
                          key={dayIdx} 
                          className="p-1"
                          onClick={() => handleCellClick(dayIdx, period)}
                        >
                          <div className={`w-full h-full border rounded-2xl p-2.5 cursor-pointer flex flex-col justify-center items-center transition-all shadow-sm ${getSubjectColor(slot?.subject || '')}`}>
                            {slot ? (
                              <>
                                <span className="text-sm font-extrabold">{slot.subject}</span>
                                <span className="text-[9px] font-bold opacity-60 mt-0.5">{slot.room}</span>
                              </>
                            ) : (
                              <span className="text-[10px] opacity-0 hover:opacity-100 font-bold text-slate-400 flex items-center gap-0.5">
                                <Plus className="w-3 h-3" /> 추가
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Statistics & Edit Pane */}
        <div className="space-y-6">
          {/* Editor Popup simulation */}
          {editingSlot && (
            <div className="bg-indigo-600 text-white rounded-3xl p-6 shadow-lg border border-indigo-700 animate-scale-up">
              <h4 className="font-extrabold text-sm mb-4">
                ✏️ {days[editingSlot.day - 1]} {editingSlot.period}교시 수정
              </h4>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] font-bold text-indigo-200 mb-1.5">과목명 (예: 수학, 과학)</label>
                  <input
                    type="text"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    className="w-full bg-indigo-700/50 border border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-white/20"
                    placeholder="비우면 삭제됩니다"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-indigo-200 mb-1.5">장소/실명 (예: 과학실)</label>
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    className="w-full bg-indigo-700/50 border border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-white/20"
                    placeholder="예: 과학실, 운동장"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleSaveSlot}
                  className="flex-1 bg-white text-indigo-600 hover:bg-indigo-50 font-extrabold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1 shadow"
                >
                  <Check className="w-3.5 h-3.5" /> 저장
                </button>
                <button
                  onClick={() => setEditingSlot(null)}
                  className="bg-indigo-700 hover:bg-indigo-800 text-indigo-100 font-bold text-xs px-4 py-2.5 rounded-xl transition"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* Statistics Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
            <h4 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
              <BarChart2 className="w-4.5 h-4.5 text-indigo-600" /> 주간 수업 시수 통계
            </h4>

            {totalHours > 0 ? (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl mb-4 text-center">
                  <div className="text-2xl font-black text-indigo-600">{totalHours}시간</div>
                  <div className="text-[10px] text-slate-400 font-bold mt-0.5">총 이수 주간 시수</div>
                </div>

                <div className="space-y-3">
                  {stats.map(([subject, count]) => {
                    const pct = Math.round((count / totalHours) * 100);
                    return (
                      <div key={subject}>
                        <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                          <span>{subject}</span>
                          <span className="text-slate-400">{count}시간 ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-xs leading-relaxed text-center py-10 font-semibold">
                시간표에 과목을 추가하시면 <br />
                주간 시수 통계가 집계됩니다.
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 flex items-start gap-3">
            <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] font-semibold text-slate-500 leading-relaxed">
              <strong>시수 관리 팁:</strong> 나이스 시간표 등록 기준에 맞춰 주간 시수가 15~20시간이 넘는 경우 교사의 수업 배분 조율에 참고할 수 있습니다.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
