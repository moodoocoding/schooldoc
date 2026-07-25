import React, { useState } from 'react';
import { ExternalLink, Download, FileText, Search, BookOpen, X } from 'lucide-react';
import type { DocTemplate } from '../types/schooldoc';

export const Infomate: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'admin' | 'class' | 'lesson'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<DocTemplate | null>(null);

  const officialLinks = [
    { title: '나이스 (NEIS)', url: 'https://www.neis.go.kr', desc: '교육행정 정보시스템 (성적, 출결, 생기부 마감)', category: '행정' },
    { title: '에듀넷 티클리어', url: 'https://www.edunet.net', desc: '초중등 교육과정 정보 및 수업·평가 자료 지원', category: '수업' },
    { title: 'KEDI 한국교육개발원', url: 'https://www.kedi.re.kr', desc: '주요 교육 통계, 정책 연구 자료 보고서', category: '연구' },
    { title: '학교안전정보센터', url: 'https://www.schoolsafe.kr', desc: '학교안전교육 7대 표준안 및 관련 수업 서식 자료', category: '수업' },
  ];

  const templates: DocTemplate[] = [
    { id: '1', title: '개인 현장체험학습 신청서 및 보고서 양식', description: '학생들이 개별 현장체험학습을 신청하고 결과를 보고할 때 제출하는 규정 공문입니다.', category: '행정', fileSize: '18 KB', fileType: 'HWP' },
    { id: '2', title: '학부모 상담 일지 및 결과 기록 대장', description: '학기 초/말 학부모 상담 시 상담 내용 및 추후 지도 사항을 꼼꼼하게 정리 보관하는 서식입니다.', category: '학급경영', fileSize: '24 KB', fileType: 'XLSX' },
    { id: '3', title: '질병 결석 사유서 및 진단 증빙 제출서', description: '질병으로 결석한 학생의 사유를 나이스 출결 마감용 증빙 문서와 매핑하여 제출하는 표준 서식입니다.', category: '행정', fileSize: '14 KB', fileType: 'HWP' },
    { id: '4', title: '수업 참여도 자기평가 피드백 루브릭 시트', description: '학생들이 자기 스스로의 교과 수업 성찰 및 모둠 기여도를 채점할 수 있는 평가 보조 양식입니다.', category: '수업', fileSize: '42 KB', fileType: 'PDF' },
    { id: '5', title: '체험학습 참가 신청 및 학부모 동의서', description: '학급 및 단체 수학여행, 수련활동 시 사전에 신청을 확인하고 비상 연락망을 수합하는 통신 서식입니다.', category: '가정통신', fileSize: '16 KB', fileType: 'HWP' },
  ];

  const getTemplateContent = (t: DocTemplate) => {
    return `[${t.fileType} 문서 내용 미리보기]\n\n제목: ${t.title}\n분류: ${t.category}\n용량: ${t.fileSize}\n\n[서식 구성 정보]\n------------------------------------------------\n1. 신청인(학생 인적사항) 및 대상 기간\n2. 사유 또는 목적지 상세 경로\n3. 보호자(학부모) 서명 및 비상 연락처 입력란\n4. 학교장/교과 담임 최종 결재 라인\n------------------------------------------------\n\n* 이 서식은 교육부 고시 표준 가이드라인에 맞춰 제작된 양식입니다. 다운로드 버튼을 눌러 실제 PC에 저장한 후 작성하세요.`;
  };

  const filteredTemplates = templates.filter(temp => {
    const matchesSearch = temp.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          temp.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeCategory === 'all') return matchesSearch;
    if (activeCategory === 'admin') return matchesSearch && temp.category === '행정';
    if (activeCategory === 'class') return matchesSearch && temp.category === '학급경영';
    if (activeCategory === 'lesson') return matchesSearch && temp.category === '수업';
    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Search and Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg mb-1">인포메이트 자료실</h3>
          <p className="text-slate-400 text-xs font-semibold">
            현직 교무실에서 빈번하게 요구하는 행정 공문서식과 필독 사이트 링크집을 한곳에서 확인하세요.
          </p>
        </div>

        <div className="relative w-full md:w-80 group">
          <input
            type="text"
            placeholder="자료실 내 서식 명칭 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Categories and Official Links Sidebar */}
        <div className="space-y-6">
          {/* Categories select */}
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-1.5">
            <h4 className="text-xs font-bold text-slate-400 mb-3 px-2">서식 분류</h4>
            {[
              { id: 'all', label: '🗂️ 전체 양식 자료' },
              { id: 'admin', label: '💼 필수 행정/공문 양식' },
              { id: 'class', label: '🏫 학급 경영/기록부 서식' },
              { id: 'lesson', label: '📚 수업/평가 안내지' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`w-full text-left text-xs font-bold px-3 py-2.5 rounded-xl transition ${
                  activeCategory === cat.id
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Official Educational Links */}
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 mb-4 px-2">교사 필수 공식 링크</h4>
            <div className="space-y-3">
              {officialLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 border border-slate-100 hover:border-indigo-100 rounded-2xl hover:bg-indigo-50/10 transition group"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1 group-hover:text-indigo-600">
                    <span>{link.title}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-500" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">{link.desc}</p>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Template List Container */}
        <div className="lg:col-span-3 space-y-4">
          {filteredTemplates.length > 0 ? (
            filteredTemplates.map((temp) => (
              <div 
                key={temp.id}
                className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 flex-shrink-0 text-slate-500">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-800 leading-snug">{temp.title}</span>
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">{temp.fileType}</span>
                      <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold">{temp.category}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xl">{temp.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setPreviewTemplate(temp)}
                    className="text-xs border border-slate-200 text-slate-600 font-bold px-3.5 py-2 rounded-xl hover:bg-slate-50 transition"
                  >
                    미리보기
                  </button>
                  <button
                    onClick={() => alert(`${temp.title}.${temp.fileType.toLowerCase()} 서식 파일 다운로드를 시작합니다 (모사)`)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 shadow-sm shadow-indigo-100"
                  >
                    <Download className="w-3.5 h-3.5" /> 다운 ({temp.fileSize})
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center text-slate-400 text-xs font-semibold leading-loose">
              검색 조건에 맞는 행정 문서 서식이 없습니다. <br />
              다른 키워드나 분류를 설정해 주세요.
            </div>
          )}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl overflow-hidden animate-scale-up">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-150 flex justify-between items-center">
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" /> 서식 미리보기
              </h4>
              <button 
                onClick={() => setPreviewTemplate(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-[10px] font-bold text-indigo-600 mb-2">
                {previewTemplate.category} &bull; {previewTemplate.fileType} 서식
              </p>
              <h5 className="font-bold text-slate-900 text-base mb-4">{previewTemplate.title}</h5>
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-[10px] leading-relaxed text-slate-600 whitespace-pre-line max-h-64 overflow-y-auto">
                {getTemplateContent(previewTemplate)}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-xs text-slate-500 hover:text-slate-700 font-bold px-4 py-2"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  alert('서식 파일 다운로드를 시작합니다 (모사)');
                  setPreviewTemplate(null);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> 다운로드
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
