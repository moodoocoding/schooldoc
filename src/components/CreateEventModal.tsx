import React, { useState, useRef } from 'react';
import { Plus, Trash2, Upload, AlertCircle, Download, X } from 'lucide-react';
import type { Criteria, EventData, StudentData } from '../types';
import { parseExcelFile, downloadTemplate } from '../utils/excelHelper';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newEvent: EventData) => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [criteria, setCriteria] = useState<Criteria[]>([
    { name: '기본 태도', maxScore: 10, desc: '수업에 임하는 자세 및 집중도' }
  ]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  
  // Mapping States
  const [idMapping, setIdMapping] = useState('');
  const [nameMapping, setNameMapping] = useState('');
  const [codeMapping, setCodeMapping] = useState('');
  const [feedbackMapping, setFeedbackMapping] = useState('');
  const [criteriaMappings, setCriteriaMappings] = useState<Record<string, string>>({});

  const [step, setStep] = useState(1); // Step 1: Info & Criteria, Step 2: Excel Import & Map, Step 3: Preview
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAddCriteria = () => {
    setCriteria([...criteria, { name: '', maxScore: 10, desc: '' }]);
  };

  const handleRemoveCriteria = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const handleCriteriaChange = (index: number, field: keyof Criteria, value: string | number) => {
    const updated = [...criteria];
    if (field === 'maxScore') {
      updated[index][field] = Number(value) || 0;
    } else {
      updated[index][field] = value as string;
    }
    setCriteria(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError('');

    try {
      const data = await parseExcelFile(file);
      if (data.length === 0) {
        setError('엑셀 파일에 데이터가 없습니다.');
        return;
      }
      setRawRows(data);
      const sheetHeaders = Object.keys(data[0]);
      setHeaders(sheetHeaders);

      // Simple auto-mapping heuristic
      const cleanHeaders = sheetHeaders.map(h => h.toLowerCase().trim().replace(/[^a-zA-Z가-힣0-9]/g, ''));
      
      const idIdx = cleanHeaders.findIndex(h => h.includes('학번') || h.includes('id') || h.includes('번호') || h.includes('학적'));
      const nameIdx = cleanHeaders.findIndex(h => h.includes('이름') || h.includes('성명') || h.includes('name'));
      const codeIdx = cleanHeaders.findIndex(h => h.includes('인증') || h.includes('비밀') || h.includes('코드') || h.includes('access'));
      const feedbackIdx = cleanHeaders.findIndex(h => h.includes('피드백') || h.includes('의견') || h.includes('feedback') || h.includes('종합'));

      if (idIdx !== -1) setIdMapping(sheetHeaders[idIdx]);
      if (nameIdx !== -1) setNameMapping(sheetHeaders[nameIdx]);
      if (codeIdx !== -1) setCodeMapping(sheetHeaders[codeIdx]);
      if (feedbackIdx !== -1) setFeedbackMapping(sheetHeaders[feedbackIdx]);

      // Initial criteria mapping
      const initialCritMap: Record<string, string> = {};
      criteria.forEach(c => {
        const matchingHeader = sheetHeaders.find(h => 
          h.toLowerCase().includes(c.name.toLowerCase()) || 
          c.name.toLowerCase().includes(h.toLowerCase())
        );
        if (matchingHeader) {
          initialCritMap[c.name] = matchingHeader;
        }
      });
      setCriteriaMappings(initialCritMap);
    } catch (err) {
      setError('엑셀 파일을 읽는 도중 오류가 발생했습니다.');
      console.error(err);
    }
  };

  const validateStep1 = () => {
    if (!title.trim()) {
      setError('이벤트 명칭을 입력해 주세요.');
      return false;
    }
    if (criteria.length === 0) {
      setError('최소 1개 이상의 평가 요소를 정의해야 합니다.');
      return false;
    }
    for (const c of criteria) {
      if (!c.name.trim()) {
        setError('평가 항목의 이름을 입력해 주세요.');
        return false;
      }
      if (c.maxScore <= 0) {
        setError('배점 기준은 0보다 커야 합니다.');
        return false;
      }
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (!idMapping || !nameMapping || !codeMapping) {
      setError('학번/ID, 이름, 인증코드는 필수 매핑 항목입니다.');
      return false;
    }
    setError('');
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setError('');
    setStep(prev => Math.max(1, prev - 1));
  };

  // Convert rawRows using current mapping configuration to StudentData
  const getMappedStudents = (): StudentData[] => {
    return rawRows.map((row, idx) => {
      const studentId = String(row[idMapping] || `std-${idx + 1}`).trim();
      const name = String(row[nameMapping] || `학생 ${idx + 1}`).trim();
      const accessCode = String(row[codeMapping] || '0000').trim();
      const feedback = String(row[feedbackMapping] || '').trim();

      const scores: Record<string, number> = {};
      criteria.forEach(c => {
        const mappedHeader = criteriaMappings[c.name];
        const scoreVal = Number(row[mappedHeader]) || 0;
        scores[c.name] = scoreVal;
      });

      return {
        id: studentId,
        name,
        accessCode,
        scores,
        feedback,
        status: 'unviewed'
      };
    });
  };

  const handleFinalize = () => {
    const students = getMappedStudents();
    const newEvent: EventData = {
      id: `evt-${Date.now()}`,
      title,
      createdAt: new Date().toISOString(),
      criteria,
      students
    };
    onSave(newEvent);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-brand-500 to-brand-orange text-white">
          <div>
            <h2 className="text-xl font-bold">새 조회 이벤트 만들기</h2>
            <p className="text-xs opacity-90 mt-0.5">평가 데이터를 안전하게 올리고 배포할 수 있는 공간을 만듭니다.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Steps Indicator */}
        <div className="flex border-b border-slate-100 bg-slate-50 text-sm">
          {[1, 2, 3].map(s => (
            <div 
              key={s} 
              className={`flex-1 text-center py-3 font-semibold transition-all border-b-2 ${
                step === s 
                  ? 'border-brand-500 text-brand-500 bg-white' 
                  : 'border-transparent text-slate-400'
              }`}
            >
              {s === 1 && '1. 평가 항목 정의'}
              {s === 2 && '2. 데이터 업로드 & 매핑'}
              {s === 3 && '3. 결과 데이터 최종 확인'}
            </div>
          ))}
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg flex items-start gap-2 text-sm border border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">이벤트 이름</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 5학년 실과 - 상황에 맞는 옷차림 수행평가"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-slate-700">평가 항목 및 배점 기준 정의</label>
                  <button 
                    type="button" 
                    onClick={handleAddCriteria}
                    className="flex items-center gap-1 text-xs font-semibold bg-brand-50 text-brand-500 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition"
                  >
                    <Plus className="w-4 h-4" /> 항목 추가
                  </button>
                </div>

                <div className="space-y-3">
                  {criteria.map((c, index) => (
                    <div key={index} className="flex gap-3 items-start bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex-1 space-y-3">
                        <div className="flex gap-3">
                          <input 
                            type="text" 
                            value={c.name} 
                            onChange={(e) => handleCriteriaChange(index, 'name', e.target.value)}
                            placeholder="평가 항목명 (예: 디자인 창의성)"
                            className="flex-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              value={c.maxScore} 
                              onChange={(e) => handleCriteriaChange(index, 'maxScore', e.target.value)}
                              placeholder="배점"
                              className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                            <span className="text-xs font-medium text-slate-500">점 만점</span>
                          </div>
                        </div>
                        <input 
                          type="text" 
                          value={c.desc} 
                          onChange={(e) => handleCriteriaChange(index, 'desc', e.target.value)}
                          placeholder="채점 요령 및 평가 기준 설명 (학생 조회 화면에 노출됨)"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveCriteria(index)}
                        className="p-2 text-slate-400 hover:text-red-500 transition mt-1"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* File Upload Zone */}
              <div className="border-2 border-dashed border-slate-200 hover:border-brand-300 rounded-2xl p-6 bg-slate-50 text-center transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".xlsx, .csv" 
                  className="hidden" 
                />
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                {fileName ? (
                  <div>
                    <p className="font-semibold text-brand-600">{fileName}</p>
                    <p className="text-xs text-slate-500 mt-1">클릭하여 다른 엑셀/CSV 파일로 변경할 수 있습니다.</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-slate-700">엑셀(.xlsx) 또는 CSV 파일을 업로드해 주세요</p>
                    <p className="text-xs text-slate-400 mt-1">파일의 첫 행은 제목 열(Header)로 인식됩니다.</p>
                  </div>
                )}
              </div>

              {/* Template Download Option */}
              <div className="flex justify-between items-center bg-brand-50 p-4 rounded-xl border border-brand-100">
                <div className="text-left">
                  <p className="text-sm font-semibold text-brand-900">맞춤형 엑셀 서식이 필요하신가요?</p>
                  <p className="text-xs text-brand-600">작성하신 평가 항목 구조에 최적화된 다운로드용 서식 파일입니다.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => downloadTemplate(criteria.map(c => c.name))}
                  className="flex items-center gap-1.5 text-xs font-bold bg-white text-brand-600 border border-brand-200 px-4 py-2 rounded-lg hover:bg-brand-100 transition shadow-sm"
                >
                  <Download className="w-4 h-4" /> 템플릿 받기
                </button>
              </div>

              {rawRows.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-700">열 매핑 설정 (Header Mapping)</h3>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">학번/ID (필수)</label>
                      <select value={idMapping} onChange={(e) => setIdMapping(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg">
                        <option value="">-- 선택 --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">이름 (필수)</label>
                      <select value={nameMapping} onChange={(e) => setNameMapping(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg">
                        <option value="">-- 선택 --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">인증번호/비밀번호 (필수)</label>
                      <select value={codeMapping} onChange={(e) => setCodeMapping(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg">
                        <option value="">-- 선택 --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">종합 피드백</label>
                      <select value={feedbackMapping} onChange={(e) => setFeedbackMapping(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg">
                        <option value="">-- 선택 안함 --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-700 mt-6">평가 항목 점수 매핑</h3>
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                    {criteria.map((c) => (
                      <div key={c.name} className="flex justify-between items-center gap-4">
                        <span className="font-semibold text-slate-700 w-1/3">{c.name} ({c.maxScore}점)</span>
                        <select 
                          value={criteriaMappings[c.name] || ''} 
                          onChange={(e) => setCriteriaMappings({...criteriaMappings, [c.name]: e.target.value})} 
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg"
                        >
                          <option value="">-- 매핑하지 않음 (0점 처리) --</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-700">매핑 완료된 임시 미리보기 (학생 수: {rawRows.length}명)</h3>
                <span className="text-xs text-brand-500 font-semibold bg-brand-50 px-2.5 py-1 rounded-full">
                  정합성 검토 완료 후 확정하세요
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-150">
                    <tr>
                      <th className="px-4 py-3">학번/ID</th>
                      <th className="px-4 py-3">이름</th>
                      <th className="px-4 py-3">인증번호</th>
                      {criteria.map(c => (
                        <th key={c.name} className="px-4 py-3 text-center">{c.name}</th>
                      ))}
                      <th className="px-4 py-3">종합 피드백</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getMappedStudents().slice(0, 10).map((std, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{std.id}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{std.name}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-500">{std.accessCode}</td>
                        {criteria.map(c => (
                          <td key={c.name} className="px-4 py-2.5 text-center font-bold text-brand-600">
                            {std.scores[c.name] ?? 0}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 max-w-xs truncate text-slate-500">{std.feedback || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rawRows.length > 10 && (
                <p className="text-center text-xs text-slate-400 mt-2">외에 {rawRows.length - 10}명의 데이터가 더 존재합니다.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <button 
            type="button" 
            onClick={handlePrevStep}
            disabled={step === 1}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
          >
            이전 단계
          </button>
          
          <div className="flex gap-2">
            {step < 3 ? (
              <button 
                type="button" 
                onClick={handleNextStep}
                disabled={step === 2 && rawRows.length === 0}
                className="px-5 py-2 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition disabled:opacity-40"
              >
                다음으로
              </button>
            ) : (
              <button 
                type="button" 
                onClick={handleFinalize}
                className="px-6 py-2 text-sm font-bold bg-gradient-to-r from-brand-500 to-brand-orange hover:shadow-lg text-white rounded-lg transition"
              >
                이벤트 생성 확정
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
