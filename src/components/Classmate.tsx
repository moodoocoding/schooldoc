import React, { useState, useEffect } from 'react';
import { Users, Shuffle, RefreshCw, Trophy, Vote, Trash } from 'lucide-react';
import type { StudentInfo } from '../types/schooldoc';

export const Classmate: React.FC = () => {
  const [subTab, setSubTab] = useState<'seating' | 'random' | 'vote'>('seating');

  // Student list state
  const students: StudentInfo[] = [
    { id: '1', name: '강민준', gender: 'M' },
    { id: '2', name: '김서윤', gender: 'F' },
    { id: '3', name: '김우진', gender: 'M' },
    { id: '4', name: '김지우', gender: 'F' },
    { id: '5', name: '박도현', gender: 'M' },
    { id: '6', name: '박하은', gender: 'F' },
    { id: '7', name: '서준우', gender: 'M' },
    { id: '8', name: '신아윤', gender: 'F' },
    { id: '9', name: '안예준', gender: 'M' },
    { id: '10', name: '양지안', gender: 'F' },
    { id: '11', name: '오유준', gender: 'M' },
    { id: '12', name: '이수아', gender: 'F' },
    { id: '13', name: '이준서', gender: 'M' },
    { id: '14', name: '이하윤', gender: 'F' },
    { id: '15', name: '장민서', gender: 'F' },
    { id: '16', name: '정예준', gender: 'M' },
    { id: '17', name: '조현우', gender: 'M' },
    { id: '18', name: '최윤서', gender: 'F' },
    { id: '19', name: '한지민', gender: 'F' },
    { id: '20', name: '황준영', gender: 'M' },
  ];

  // Seating States
  const [gridCols, setGridCols] = useState(4);
  const [seatingPlan, setSeatingPlan] = useState<StudentInfo[]>([]);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);

  // Random Picker States
  const [isPicking, setIsPicking] = useState(false);
  const [pickedName, setPickedName] = useState<string | null>(null);

  // Voting States
  const [voteTitle, setVoteTitle] = useState('올해 가을 소풍 희망 장소');
  const [voteOptions, setVoteOptions] = useState([
    { id: '1', text: '테마파크 (에버랜드)', votes: 0 },
    { id: '2', text: '경복궁 역사 탐방', votes: 0 },
    { id: '3', text: '직업 체험관 (키자니아)', votes: 0 }
  ]);
  const [newOptionText, setNewOptionText] = useState('');
  const [votingDone, setVotingDone] = useState(false);

  // Initialize Seating Plan
  useEffect(() => {
    setSeatingPlan([...students]);
  }, [students]);

  // Randomize seats
  const shuffleSeats = () => {
    const arr = [...seatingPlan];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setSeatingPlan(arr);
    setSelectedSeatIndex(null);
  };

  // Swap Seats logic
  const handleSeatClick = (idx: number) => {
    if (selectedSeatIndex === null) {
      setSelectedSeatIndex(idx);
    } else {
      const arr = [...seatingPlan];
      const temp = arr[selectedSeatIndex];
      arr[selectedSeatIndex] = arr[idx];
      arr[idx] = temp;
      setSeatingPlan(arr);
      setSelectedSeatIndex(null);
    }
  };

  // Random Picker simulation
  const startRandomPick = () => {
    if (students.length === 0) return;
    setIsPicking(true);
    setPickedName(null);

    let counter = 0;
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * students.length);
      setPickedName(students[randomIdx].name);
      counter++;
      if (counter > 15) {
        clearInterval(interval);
        setIsPicking(false);
      }
    }, 120);
  };

  // Add voting option
  const addVoteOption = () => {
    if (!newOptionText.trim()) return;
    setVoteOptions([
      ...voteOptions,
      { id: Date.now().toString(), text: newOptionText, votes: 0 }
    ]);
    setNewOptionText('');
  };

  // Delete voting option
  const deleteVoteOption = (id: string) => {
    setVoteOptions(voteOptions.filter(o => o.id !== id));
  };

  // Simulate Classroom Voting
  const runVoteSimulation = () => {
    setVotingDone(false);
    let totalVotes = students.length;
    const currentOptions = voteOptions.map(o => ({ ...o, votes: 0 }));

    // Distribute votes randomly
    for (let i = 0; i < totalVotes; i++) {
      const randomOptIdx = Math.floor(Math.random() * currentOptions.length);
      currentOptions[randomOptIdx].votes += 1;
    }

    setVoteOptions(currentOptions);
    setVotingDone(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 gap-6 mb-8 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSubTab('seating')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'seating' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" /> 칠판형 자리 배치표
        </button>
        <button
          onClick={() => setSubTab('random')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'random' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4" /> 발표자 럭키드로우
        </button>
        <button
          onClick={() => setSubTab('vote')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'vote' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Vote className="w-4 h-4" /> 실시간 학급 투표기
        </button>
      </div>

      {/* Seating Planner */}
      {subTab === 'seating' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg mb-1">인터랙티브 자리 배치기</h3>
              <p className="text-slate-400 text-xs font-semibold">
                학생들을 드래그하거나 두 개의 자리를 클릭해서 간편하게 스왑(교환)할 수 있습니다.
              </p>
            </div>
            
            <div className="flex gap-2">
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-1 bg-slate-50">
                <span className="text-xs font-bold text-slate-500">열 배치</span>
                <select
                  value={gridCols}
                  onChange={(e) => setGridCols(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none"
                >
                  <option value={3}>3열 종대</option>
                  <option value={4}>4열 종대</option>
                  <option value={5}>5열 종대</option>
                  <option value={6}>6열 종대</option>
                </select>
              </div>

              <button
                onClick={shuffleSeats}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                <Shuffle className="w-3.5 h-3.5" /> 랜덤 섞기
              </button>
            </div>
          </div>

          {/* Teacher Blackboard Desk Indicator */}
          <div className="w-full max-w-md mx-auto text-center py-2 bg-slate-800 text-white font-bold text-xs tracking-widest rounded-xl mb-12 shadow-sm border border-slate-700">
            [ 칠 판 / 교 탁 ]
          </div>

          {/* Grid Layout of Seats */}
          <div
            className="grid gap-4 max-w-4xl mx-auto"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`
            }}
          >
            {seatingPlan.map((student, idx) => {
              const isSelected = selectedSeatIndex === idx;
              return (
                <div
                  key={student.id}
                  onClick={() => handleSeatClick(idx)}
                  className={`border cursor-pointer p-4 rounded-2xl text-center transition-all flex flex-col justify-center min-h-[90px] shadow-sm relative ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 scale-[1.03]'
                      : student.gender === 'M'
                      ? 'border-blue-100 bg-blue-50/20 hover:bg-blue-50/50'
                      : 'border-rose-100 bg-rose-50/20 hover:bg-rose-50/50'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 font-extrabold absolute top-2 left-3">
                    {idx + 1}번 좌석
                  </span>
                  <span className="text-sm font-extrabold text-slate-800 mt-2">{student.name}</span>
                  <span className={`text-[9px] font-extrabold mt-1 inline-block mx-auto px-1.5 py-0.5 rounded-md ${
                    student.gender === 'M' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {student.gender === 'M' ? '남학생' : '여학생'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Random Picker */}
      {subTab === 'random' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm max-w-2xl mx-auto text-center">
          <h3 className="font-extrabold text-slate-800 text-lg mb-2">발표자 무작위 랜덤 추첨</h3>
          <p className="text-slate-400 text-xs font-semibold mb-8">
            수업 중 무작위 발표나 질문 대상을 고를 때 사용 가능한 귀여운 룰렛 애니메이션입니다.
          </p>

          <div className="w-64 h-64 mx-auto rounded-full bg-slate-50 border-4 border-dashed border-slate-200 flex items-center justify-center relative mb-8 shadow-inner overflow-hidden">
            {isPicking ? (
              <div className="text-3xl font-black text-indigo-600 animate-bounce">
                {pickedName}
              </div>
            ) : pickedName ? (
              <div className="text-center animate-scale-up">
                <div className="text-[10px] text-indigo-500 font-black tracking-widest uppercase mb-1">SELECTED STUDENT</div>
                <div className="text-4xl font-black text-slate-900 mb-1">{pickedName}</div>
                <div className="text-xs font-bold text-slate-400">당첨되었습니다! 🎉</div>
              </div>
            ) : (
              <div className="text-slate-400 font-bold text-sm">
                교탁 앞 대기 중
              </div>
            )}
          </div>

          <button
            onClick={startRandomPick}
            disabled={isPicking}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm px-8 py-3.5 rounded-2xl shadow-md transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
          >
            <Shuffle className="w-4 h-4" /> {isPicking ? '추첨 중...' : '추첨 시작'}
          </button>
        </div>
      )}

      {/* Secret Classroom Voting */}
      {subTab === 'vote' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Options Manager */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
            <h3 className="font-extrabold text-slate-800 text-lg mb-2">학급 안건 및 옵션 설정</h3>
            <p className="text-slate-400 text-xs font-semibold mb-6">
              투표 안건을 설정하고 임시 학생 투표 시뮬레이션 결과를 실시간 차트로 확인하세요.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">투표 주제</label>
                <input
                  type="text"
                  value={voteTitle}
                  onChange={(e) => setVoteTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">투표 후보 항목</label>
                <div className="space-y-2 mb-4">
                  {voteOptions.map((opt) => (
                    <div key={opt.id} className="flex gap-2 items-center">
                      <div className="flex-1 bg-slate-50 border border-slate-150 rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
                        {opt.text}
                      </div>
                      <button
                        onClick={() => deleteVoteOption(opt.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="새 후보지 추가..."
                    value={newOptionText}
                    onChange={(e) => setNewOptionText(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                  <button
                    onClick={addVoteOption}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl"
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={runVoteSimulation}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <Vote className="w-4 h-4" /> 학급 투표 시뮬레이션 개시
            </button>
          </div>

          {/* Voting Results */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-bold text-indigo-400 tracking-wider">LIVE VOTE RESULTS</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 font-bold border border-slate-700 px-2 py-0.5 rounded">
                  무기명 비밀투표
                </span>
              </div>

              <h4 className="font-extrabold text-slate-100 mb-6 text-sm">
                🗳️ Q. {voteTitle}
              </h4>

              {votingDone ? (
                <div className="space-y-6">
                  {voteOptions.map((opt) => {
                    const totalVotes = voteOptions.reduce((acc, o) => acc + o.votes, 0);
                    const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                    return (
                      <div key={opt.id}>
                        <div className="flex justify-between text-xs font-bold text-slate-200 mb-2">
                          <span>{opt.text}</span>
                          <span>{opt.votes}표 ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-700"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="text-right text-[10px] font-bold text-slate-500 mt-4">
                    총 참여 인원: {students.length}명
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-xs font-medium text-slate-500">
                  왼쪽의 [학급 투표 시뮬레이션 개시] 버튼을 눌러 <br />
                  학생들이 제출한 비밀 투표 집계 결과를 확인하세요.
                </div>
              )}
            </div>

            {votingDone && (
              <button
                onClick={() => setVotingDone(false)}
                className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-3 rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> 투표 리셋
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
