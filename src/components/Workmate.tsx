import React, { useState, useEffect } from 'react';
import { Copy, Sparkles, FileText, CheckCircle2, Calculator, Check, AlertCircle } from 'lucide-react';

interface SavedRecord {
  id: string;
  name: string;
  subject: string;
  text: string;
  bytes: number;
  createdAt: string;
}

export const Workmate: React.FC = () => {
  const [subTab, setSubTab] = useState<'ai-desc' | 'eval-plan' | 'notice'>('ai-desc');

  // AI 생기부 States
  const [studentName, setStudentName] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('수학');
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [customKeywords, setCustomKeywords] = useState('');
  const [tone, setTone] = useState<'formal' | 'active' | 'growth'>('growth');
  const [generatedText, setGeneratedText] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [byteCount, setByteCount] = useState(0);
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  // Rubric States
  const [evalSubject, setEvalSubject] = useState('과학');
  const [evalGrade, setEvalGrade] = useState('6학년');
  const [evalActivity, setEvalActivity] = useState('태양계 행성 크기 비교 실험 보고서');
  const [rubricResult, setRubricResult] = useState<any>(null);

  // Notice States
  const [noticeType, setNoticeType] = useState('field-trip');
  const [noticeDate, setNoticeDate] = useState('2026년 10월 15일');
  const [noticeLocation, setNoticeLocation] = useState('서울 과학전시관');
  const [noticeText, setNoticeText] = useState('');

  const subjects = ['국어', '수학', '사회', '과학', '영어', '음악', '미술', '체육', '도덕'];
  
  const keywordOptions: Record<string, string[]> = {
    '국어': ['발표력이 뛰어남', '책을 많이 읽음', '경청하는 태도', '토론 시 논리적임', '시적 표현력 우수', '문장 구성 능력'],
    '수학': ['문제해결력 우수', '수리적 사고력', '논리적 추론', '도형에 대한 이해', '끈기가 돋보임', '연산이 정확함'],
    '사회': ['시사 이슈 관심', '역사의식 뚜렷', '지리 정보 분석', '모둠 협동 우수', '비판적 문제 제기', '지도 해석력'],
    '과학': ['탐구심이 왕성', '가설 설정 능력', '실험 설계력', '관찰이 치밀함', '과학적 분석력', '창의적 접근'],
    '영어': ['의사소통이 활발', '어휘력이 풍부', '영작문 우수', '독해력이 탁월', '자신감 있게 말함', '경청과 발음'],
    '일반/행발': ['자기주도성', '배려심이 깊음', '리더십이 뛰어남', '규칙을 잘 준수함', '성실하고 책임감 있음', '갈등 중재']
  };

  // Byte calculation logic (NEIS Standard: Hangul = 3 bytes, space/English/special = 1 byte)
  const calculateBytes = (str: string) => {
    let bytes = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code > 127) {
        bytes += 3; // Hangul
      } else {
        bytes += 1; // English/Number/Special/Space
      }
    }
    return bytes;
  };

  useEffect(() => {
    setCharCount(generatedText.length);
    setByteCount(calculateBytes(generatedText));
  }, [generatedText]);

  // Load Saved Records
  useEffect(() => {
    const loaded = localStorage.getItem('schooldoc_saved_records');
    if (loaded) {
      setSavedRecords(JSON.parse(loaded));
    }
  }, []);

  const handleKeywordToggle = (kw: string) => {
    if (selectedKeywords.includes(kw)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== kw));
    } else {
      setSelectedKeywords([...selectedKeywords, kw]);
    }
  };

  // Generate AI comment simulation
  const handleGenerateAI = () => {
    if (!studentName.trim()) {
      alert('학생 이름을 입력해 주세요.');
      return;
    }

    const allKeywords = [...selectedKeywords];
    if (customKeywords.trim()) {
      customKeywords.split(',').forEach(k => {
        const cleaned = k.trim();
        if (cleaned) allKeywords.push(cleaned);
      });
    }

    if (allKeywords.length === 0) {
      alert('최소 하나 이상의 키워드를 선택하거나 직접 입력해 주세요.');
      return;
    }

    // Mock AI text templates generator
    const sub = selectedSubject;
    const name = studentName;

    let result = '';
    if (tone === 'growth') {
      result = `${name} 학생은 ${sub} 수업에서 ${allKeywords[0] || '자기주도적인 태도'}로 뛰어난 학업 열의를 보여줌. `;
      if (allKeywords[1]) result += `특히 ${allKeywords[1]} 능력이 돋보여 어려운 과제 해결에 주도적인 역할을 수행함. `;
      if (allKeywords[2]) result += `학습 과정 중 ${allKeywords[2]} 측면에서 크게 성장하는 모습을 보였으며, `;
      result += `추후 실생활 연계 과제 해결에서도 큰 능력을 발휘할 잠재력이 기대됨.`;
    } else if (tone === 'active') {
      result = `${name} 학생은 평소 ${sub} 활동에 대단히 적극적으로 참여하며, ${allKeywords[0] || '자신감 넘치는 행동'}으로 반 분위기를 밝게 이끎. `;
      if (allKeywords[1]) result += `모둠 활동에서 ${allKeywords[1]} 역량을 발휘하여 동료들의 의견을 적극적으로 조율하고, `;
      if (allKeywords[2]) result += `${allKeywords[2]}을(를) 바탕으로 매 수업시간마다 창의적인 답변과 활발한 발표를 수행하여 학급 내 모범이 됨.`;
    } else {
      result = `${sub} 교과의 성취기준을 훌륭히 만족하며, 매사 차분하고 진지한 태도로 수업에 임하는 성실한 학생임. `;
      if (allKeywords[0]) result += `특히 과제 수행 중 ${allKeywords[0]}을(를) 바탕으로 꼼꼼한 결과물을 산출하였으며, `;
      if (allKeywords[1]) result += `${allKeywords[1]} 능력이 우수하여 학습 목표를 깊이 있게 체득함. `;
      if (allKeywords[2]) result += `앞으로도 ${allKeywords[2]} 특성을 더욱 신장시킨다면 훌륭한 인재로 성장할 가능성이 매우 큼.`;
    }

    setGeneratedText(result);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSaveRecord = () => {
    if (!generatedText) return;
    const newRecord: SavedRecord = {
      id: Date.now().toString(),
      name: studentName || '무명 학생',
      subject: selectedSubject,
      text: generatedText,
      bytes: byteCount,
      createdAt: new Date().toLocaleDateString('ko-KR')
    };

    const updated = [newRecord, ...savedRecords];
    setSavedRecords(updated);
    localStorage.setItem('schooldoc_saved_records', JSON.stringify(updated));
    alert('기록 보관함에 저장되었습니다.');
  };

  const handleDeleteRecord = (id: string) => {
    const updated = savedRecords.filter(r => r.id !== id);
    setSavedRecords(updated);
    localStorage.setItem('schooldoc_saved_records', JSON.stringify(updated));
  };

  // Generate Rubric Simulation
  const handleGenerateRubric = () => {
    const template = {
      subject: evalSubject,
      grade: evalGrade,
      activity: evalActivity,
      rubrics: [
        {
          criteria: '이해 및 개념 적용',
          high: '탐구 대상을 완벽히 파악하고 핵심 개념과 원리를 정확히 해석하여 설명함.',
          medium: '핵심 개념의 일부를 파악하고 있으며, 설명 과정에 소소한 오류가 있으나 의미가 통함.',
          low: '탐구 주제에 대한 전반적 개념 이해가 다소 미흡하여 추가적인 보충 학습이 필요함.'
        },
        {
          criteria: '실험 설계 및 도구 조작',
          high: '안전 수칙을 철저히 준수하며 도구를 능숙히 조작하고 필요한 조치를 자발적으로 수행함.',
          medium: '안전 수칙을 지키며 전반적 실험 과정을 수행하나 도구 사용의 조작이 미숙함.',
          low: '실험 도구의 올바른 사용법 숙지가 부족하여 교사의 직접적인 지도와 안전 지침이 요망됨.'
        },
        {
          criteria: '보고서 작성 및 태도',
          high: '모든 실험 과정을 명료하게 기록하고 관찰 결과를 논리적으로 추론하여 보고서 작성을 완수함.',
          medium: '실험 결과 기록의 누락은 없으나 도출 과정의 분석이 다소 단순함.',
          low: '결과 기록이 부실하거나 기한 내 보고서를 완성하는 과제 집착력이 아쉬움.'
        }
      ]
    };
    setRubricResult(template);
  };

  // Generate Notice Simulation
  const handleGenerateNotice = () => {
    let text = '';
    if (noticeType === 'field-trip') {
      text = `[가정통신문] 현장체험학습 참가 안내 및 동의서 신청\n\n학부모님 안녕하십니까,\n본교에서는 학생들의 시야를 넓히고 현장 중심의 배움 기회를 제공하고자 아래와 같이 현장체험학습을 실시하고자 합니다.\n\n▶ 일시: ${noticeDate}\n▶ 장소: ${noticeLocation}\n▶ 대상: 학급 학생 전원\n▶ 세부 프로그램: 과학 전시실 관람 및 우주 탐사선 가상 체험 VR 활동\n\n안전 교육 및 사전 안내를 철저히 이행하여 유익하고 안전한 체험이 되도록 지도하겠습니다. 뒷면의 참가 동의서를 작성하셔서 기한 내에 담임 교사에게 제출하여 주시기 바랍니다.`;
    } else if (noticeType === 'consult') {
      text = `[가정통신문] 학부모 개별 1:1 집중 상담 주간 운영 안내\n\n학부모님 안녕하십니까,\n자녀들의 학업 진도 및 교우관계, 학교 생활 적응에 관한 정보를 긴밀히 공유하고자 1학기 학부모 상담 주간을 실시합니다.\n\n▶ 기간: ${noticeDate}\n▶ 운영 방식: 대면 상담 또는 비대면 전화 상담 (택1)\n▶ 신청 마감: 이번 주 금요일까지\n\n선생님과의 편안한 소통을 위해 아래 설문 링크 또는 스쿨독 QR코드를 통해 희망 시간대를 입력해 주시기 바랍니다.`;
    } else {
      text = `[가정통신문] 환절기 감염병 예방 및 학교 위생 수칙 안내\n\n학부모님 안녕하십니까,\n최근 환절기를 맞이하여 급격한 온도 변화로 인한 인플루엔자 및 호흡기 감염병이 유행하고 있습니다.\n\n▶ 예방 수칙:\n 1. 등교 전 30초 이상 손 씻기 생활화\n 2. 발열 등 의심 증상 발현 시 선제적 의료기관 방문\n 3. 교내 적절한 수분 섭취 및 기침 예절 준수\n\n자녀들이 건강하고 활기차게 등교할 수 있도록 가정에서도 예방 수칙 준수에 협조 부탁드립니다.`;
    }
    setNoticeText(text);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 gap-6 mb-8 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSubTab('ai-desc')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'ai-desc' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" /> AI 생활기록부 작성기
        </button>
        <button
          onClick={() => setSubTab('eval-plan')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'eval-plan' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" /> 평가 계획 작성 도우미
        </button>
        <button
          onClick={() => setSubTab('notice')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'notice' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calculator className="w-4 h-4" /> 가정통신문 빌더
        </button>
      </div>

      {/* Contents based on Subtab */}
      {subTab === 'ai-desc' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Section */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-lg">AI 생기부 세부능력 및 특기사항 생성</h3>
              </div>

              {/* Name and Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">학생 성명</label>
                  <input
                    type="text"
                    placeholder="예: 홍길동"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">교과목</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      setSelectedKeywords([]);
                    }}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors font-semibold text-slate-700 bg-white"
                  >
                    {subjects.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    <option value="일반/행발">행동특성 및 종합의견 (행발)</option>
                  </select>
                </div>
              </div>

              {/* Keywords Select */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 mb-2.5">핵심 관찰 키워드 (최대 3개)</label>
                <div className="flex flex-wrap gap-2">
                  {(keywordOptions[selectedSubject] || keywordOptions['일반/행발']).map((kw) => {
                    const isSelected = selectedKeywords.includes(kw);
                    return (
                      <button
                        key={kw}
                        onClick={() => handleKeywordToggle(kw)}
                        className={`text-xs px-3.5 py-2 rounded-xl border transition-all font-semibold ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {kw}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Keywords */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 mb-2">수동 키워드 입력 (쉼표로 구분)</label>
                <input
                  type="text"
                  placeholder="예: 실험 열정적, 기하학적 감각, 동료 격려"
                  value={customKeywords}
                  onChange={(e) => setCustomKeywords(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors font-medium"
                />
              </div>

              {/* Tone Selection */}
              <div className="mb-8">
                <label className="block text-xs font-bold text-slate-500 mb-2.5">문장 어조 및 강점 방향</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'growth', label: '성장 가능성 강조', desc: '앞으로의 발전 지향' },
                    { id: 'active', label: '적극성 및 주도성', desc: '수업 참여도 특화' },
                    { id: 'formal', label: '정석적 성실형', desc: '모범성 및 차분함' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTone(t.id as any)}
                      className={`p-3 border rounded-2xl text-left transition-all flex flex-col ${
                        tone === t.id
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-extrabold text-slate-800">{t.label}</span>
                      <span className="text-[10px] text-slate-400 mt-1">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerateAI}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm py-4 rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 animate-spin-slow" /> AI 세특 문장 생성하기
            </button>
          </div>

          {/* Result Section */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative shadow-lg">
            <div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-bold text-indigo-400 tracking-wider">AI GENERATED RESULT</span>
                <span className="text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                  NEIS 실시간 바이트 계산
                </span>
              </div>

              {/* Text Area */}
              <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-4 min-h-[220px] mb-6">
                {generatedText ? (
                  <p className="text-sm font-medium leading-relaxed text-slate-100 whitespace-pre-line">{generatedText}</p>
                ) : (
                  <p className="text-xs font-medium text-slate-500 leading-loose flex items-center justify-center h-full min-h-[180px] text-center">
                    왼쪽 패널에 값을 설정하고 <br />
                    [AI 세특 문장 생성하기] 단추를 클릭하세요.
                  </p>
                )}
              </div>

              {/* Character and Byte Statistics */}
              <div className="grid grid-cols-2 gap-4 bg-slate-800/40 border border-slate-800 rounded-2xl p-4 text-center mb-6">
                <div>
                  <div className="text-xl font-extrabold text-indigo-400">{charCount}</div>
                  <div className="text-[10px] text-slate-500 font-bold mt-0.5">글자 수</div>
                </div>
                <div className="border-l border-slate-800">
                  <div className="text-xl font-extrabold text-indigo-400">{byteCount} / 1500</div>
                  <div className="text-[10px] text-slate-500 font-bold mt-0.5">나이스 바이트 수</div>
                </div>
              </div>

              {byteCount > 1500 && (
                <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl mb-4 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>글자 바이트 제한(1500Byte)을 초과했습니다. 축소 작성이 권장됩니다.</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {generatedText && (
              <div className="grid grid-cols-2 gap-3 mt-auto">
                <button
                  onClick={handleCopy}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? '복사됨' : '전체 복사'}</span>
                </button>
                <button
                  onClick={handleSaveRecord}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>보관함 저장</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved Records Section (Visible only in ai-desc tab) */}
      {subTab === 'ai-desc' && savedRecords.length > 0 && (
        <div className="mt-12 bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm">
          <h4 className="font-extrabold text-slate-800 mb-6 flex items-center gap-2">
            📂 담임교사 보관함 ({savedRecords.length}개)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedRecords.map((rec) => (
              <div key={rec.id} className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 hover:bg-white transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800">{rec.name}</span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md font-bold">{rec.subject}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">{rec.createdAt}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium mb-4">{rec.text}</p>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-3 text-[10px] font-bold">
                  <span className="text-slate-400">{rec.bytes} Bytes</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(rec.text);
                        alert('텍스트가 클립보드에 복사되었습니다.');
                      }}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      복사
                    </button>
                    <button
                      onClick={() => handleDeleteRecord(rec.id)}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluation Plan Assistant */}
      {subTab === 'eval-plan' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
          <div className="max-w-xl mb-8">
            <h3 className="font-extrabold text-slate-800 text-lg mb-2">교과별 수행평가 채점 기준 설정기</h3>
            <p className="text-slate-500 text-xs font-semibold leading-relaxed">
              성취기준을 선택하고 활동내역을 입력하면 객관적인 3단계(상, 중, 하) 채점 기준 매트릭스를 구성해 줍니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">교과목</label>
              <input
                type="text"
                value={evalSubject}
                onChange={(e) => setEvalSubject(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">적용 학년</label>
              <input
                type="text"
                value={evalGrade}
                onChange={(e) => setEvalGrade(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">수행 평가 과제 활동명</label>
              <input
                type="text"
                value={evalActivity}
                onChange={(e) => setEvalActivity(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateRubric}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm px-6 py-3 rounded-2xl shadow-sm transition-colors mb-8"
          >
            수행평가 채점 루브릭 작성
          </button>

          {/* Rubric Matrix Visual Output */}
          {rubricResult && (
            <div className="border border-slate-150 rounded-2xl overflow-hidden mt-6 shadow-sm">
              <div className="bg-slate-50 p-4 border-b border-slate-150">
                <h4 className="font-extrabold text-sm text-slate-800">
                  📋 [{rubricResult.grade}] {rubricResult.subject}과 수행평가 기준표 - &ldquo;{rubricResult.activity}&rdquo;
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-150">
                      <th className="p-4 w-1/5">평가 요소</th>
                      <th className="p-4 w-4/15 bg-emerald-50/50 text-emerald-800">상 (우수)</th>
                      <th className="p-4 w-4/15 bg-amber-50/50 text-amber-800">중 (보통)</th>
                      <th className="p-4 w-4/15 bg-rose-50/50 text-rose-800">하 (노력 요함)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {rubricResult.rubrics.map((r: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-4 font-bold text-slate-800 bg-slate-50/50">{r.criteria}</td>
                        <td className="p-4 leading-relaxed bg-emerald-50/10">{r.high}</td>
                        <td className="p-4 leading-relaxed bg-amber-50/10">{r.medium}</td>
                        <td className="p-4 leading-relaxed bg-rose-50/10">{r.low}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notice Builder */}
      {subTab === 'notice' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="font-extrabold text-slate-800 text-lg mb-2">가정통신문 및 안내서식 빌더</h3>
            <p className="text-slate-500 text-xs font-semibold leading-relaxed mb-6">
              자주 발송되는 가정통신문 탬플릿을 고르고 세부 요소를 입력하여 양식을 다운로드하세요.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 mb-2">통신문 테마</label>
              <div className="flex gap-2">
                {[
                  { id: 'field-trip', label: '체험학습' },
                  { id: 'consult', label: '학부모상담' },
                  { id: 'health', label: '보건/질병예방' }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setNoticeType(t.id)}
                    className={`text-xs px-4 py-2.5 rounded-xl font-bold border transition-colors ${
                      noticeType === t.id
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-600'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">일자 / 기간</label>
                <input
                  type="text"
                  value={noticeDate}
                  onChange={(e) => setNoticeDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">장소 및 상세정보</label>
                <input
                  type="text"
                  value={noticeLocation}
                  onChange={(e) => setNoticeLocation(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold"
                />
              </div>
            </div>

            <button
              onClick={handleGenerateNotice}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm px-6 py-3 rounded-2xl shadow-sm transition-colors"
            >
              통신문 텍스트 생성
            </button>
          </div>

          {/* Visual Sheet Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
                <span className="text-xs font-bold text-slate-500">인쇄 미리보기</span>
                <span className="text-[10px] bg-slate-200 font-bold px-2 py-0.5 rounded text-slate-600">A4 규격</span>
              </div>

              <div className="bg-white border border-slate-300 shadow-inner rounded-xl p-6 font-serif text-slate-800 text-xs min-h-[300px] leading-relaxed whitespace-pre-line">
                {noticeText || (
                  <div className="text-slate-400 text-center py-24 font-sans text-xs">
                    [통신문 텍스트 생성] 단추를 누르면 공문 양식 초안이 채워집니다.
                  </div>
                )}
              </div>
            </div>

            {noticeText && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(noticeText);
                  alert('클립보드에 복사 완료! 아래한글(HWP) 파일에 바로 붙여넣을 수 있습니다.');
                }}
                className="w-full mt-6 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" /> 한글 양식용 복사하기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
