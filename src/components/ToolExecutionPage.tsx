import React, { useState } from 'react';
import { 
  ArrowLeft, Upload, Share2, CheckCircle2, Download, FileText
} from 'lucide-react';
import type { SchoolTool } from '../types/schooldoc';

interface ToolExecutionPageProps {
  tool: SchoolTool;
  onBack: () => void;
}

export const ToolExecutionPage: React.FC<ToolExecutionPageProps> = ({ tool, onBack }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Workflow steps based on tool category
  const stepsMap: Record<string, string[]> = {
    'notice-collect': ['1. 서식 만들기', '2. 전용 링크 공유', '3. 수합 진행 확인', '4. 결과 다운로드'],
    'registry-sign': ['1. 명단 생성', '2. 서명 수합 링크', '3. 서명 현황 확인', '4. PDF 결재 내보내기'],
    'data-collect': ['1. 제출 항목 생성', '2. 공유 링크 전송', '3. 실시간 응답 수합', '4. 엑셀 변환 저장'],
    'doc-sign': ['1. PDF 서명란 지정', '2. 대상자 서명 요청', '3. 비대면 서명 완료', '4. 서명문서 다운로드'],
    'cert-collect': ['1. 수합 공간 생성', '2. 이수증 전송 받기', '3. AI 이수시간 집계', '4. 연수대장 내보내기'],
    'receipt-auto': ['1. 영수증 이미지 업로드', '2. AI OCR 자동파싱', '3. 품의 내역 검토', '4. 엑셀품의서 저장'],
    'special-room': ['1. 특별실 선택', '2. 대여 일시 확인', '3. 신청 내역 입력', '4. 예약 확정 승인'],
    'lost-found': ['1. 습득 물품 등록', '2. 보관 위치 지정', '3. 학급 반환 공지', '4. 반환 완료 처리'],
    'item-rent': ['1. 교구/기자재 선택', '2. 대여 교사 등록', '3. 반납 예정일 지정', '4. 대여 완료'],
    'student-lookup': ['1. 성적 엑셀 업로드', '2. 개인 인증키 설정', '3. 안심 조회 링크 생성', '4. 학생 개별 안내'],
  };

  const currentSteps = stepsMap[tool.id] || ['1. 시작하기', '2. 정보 입력', '3. 진행 확인', '4. 완료'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between border-b border-[#DCE3EA] pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-[#334155] hover:text-[#0F6CBD] transition-colors p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] min-h-[44px]"
          aria-label="목록으로 돌아가기"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>목록으로 돌아가기</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 bg-[#EFF6FC] text-[#0F6CBD] rounded-md border border-[#0F6CBD]/20">
            {tool.name} 전용 작업실
          </span>
        </div>
      </div>

      {/* Workflow Step Progress Header */}
      <div className="bg-white rounded-xl p-6 border border-[#DCE3EA] shadow-xs">
        <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight mb-2">
          {tool.name}
        </h1>
        <p className="text-sm text-[#334155] font-normal mb-6">
          {tool.desc}
        </p>

        {/* 4 Steps Indicator Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {currentSteps.map((stepText, idx) => {
            const stepNum = idx + 1;
            const isCurrent = currentStep === stepNum;
            const isDone = currentStep > stepNum;
            return (
              <button
                key={idx}
                onClick={() => setCurrentStep(stepNum)}
                className={`p-3 rounded-lg text-xs font-bold text-left transition-all border ${
                  isCurrent
                    ? 'bg-[#0F6CBD] text-white border-[#0F6CBD] shadow-xs'
                    : isDone
                    ? 'bg-[#EFF6FC] text-[#0F6CBD] border-[#0F6CBD]/30'
                    : 'bg-[#F6F8FB] text-[#64748B] border-[#DCE3EA]'
                } focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]`}
              >
                {stepText}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Workspace Content Panel */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-[#DCE3EA] shadow-xs min-h-[380px] flex flex-col justify-between">
        
        {/* Step 1: Upload / Input */}
        {currentStep === 1 && (
          <div className="space-y-6 my-auto">
            <div className="text-center max-w-lg mx-auto space-y-2">
              <h2 className="text-lg font-bold text-[#0F172A]">
                1단계: 서류 및 자료 준비하기
              </h2>
              <p className="text-sm text-[#64748B]">
                컴퓨터에 보관된 HWP, PDF, XLSX 양식 파일을 올리거나 새로 서식을 작성하세요.
              </p>
            </div>

            <div className="max-w-md mx-auto border-2 border-dashed border-[#DCE3EA] hover:border-[#0F6CBD] rounded-xl p-8 text-center transition-colors bg-[#F6F8FB] space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#EFF6FC] text-[#0F6CBD] flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>

              {uploadedFileName ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#16803C] flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{uploadedFileName}</span>
                  </p>
                  <p className="text-xs text-[#64748B]">파일이 정상 업로드되었습니다.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#0F172A]">
                    파일을 여기에 드래그하거나 클릭하여 업로드하세요
                  </p>
                  <p className="text-xs text-[#64748B]">지원 형식: PDF, HWP, HWPX, XLSX, PNG (최대 20MB)</p>
                </div>
              )}

              <input
                type="file"
                id="file-upload-input"
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.hwp,.hwpx,.xlsx,.png,.jpg"
              />
              <label
                htmlFor="file-upload-input"
                className="inline-block bg-[#0F6CBD] hover:bg-[#0F5B9E] text-white font-semibold text-sm px-5 py-2.5 rounded-lg cursor-pointer transition shadow-xs"
              >
                파일 선택하기
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Share Link */}
        {currentStep === 2 && (
          <div className="space-y-6 my-auto text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#EFF6FC] text-[#0F6CBD] flex items-center justify-center mx-auto">
              <Share2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#0F172A]">
              2단계: 수합 & 서명 제출 전용 링크 생성 완료
            </h2>
            <p className="text-sm text-[#64748B]">
              아래 링크 또는 QR 코드를 학부모 알리미, 학생 단톡방, 교직원 메신저에 공유하세요.
            </p>

            <div className="bg-[#F6F8FB] p-4 rounded-xl border border-[#DCE3EA] flex items-center justify-between gap-3">
              <span className="text-xs font-mono font-semibold text-[#0F6CBD] truncate">
                https://schooldoc.kr/s/{tool.id}/form-7821
              </span>
              <button
                onClick={() => alert('공유 링크가 클립보드에 복사되었습니다.')}
                className="bg-[#0F6CBD] text-white text-xs font-semibold px-4 py-2 rounded-lg flex-shrink-0 hover:bg-[#0F5B9E] transition"
              >
                링크 복사
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Check Status */}
        {currentStep === 3 && (
          <div className="space-y-6 my-auto text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#EFF6FC] text-[#0F6CBD] flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#0F172A]">
              3단계: 실시간 응답 및 서명 상태 확인
            </h2>
            <div className="bg-[#F6F8FB] p-6 rounded-xl border border-[#DCE3EA] space-y-3 text-left">
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-[#334155]">수합 대상자</span>
                <span className="text-[#0F172A] font-bold">총 25명</span>
              </div>
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-[#16803C]">제출 완료</span>
                <span className="text-[#16803C] font-bold">23명 완료</span>
              </div>
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-[#A15C00]">미제출자</span>
                <span className="text-[#A15C00] font-bold">2명 (재독촉 가능)</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Download Results */}
        {currentStep === 4 && (
          <div className="space-y-6 my-auto text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#16803C] flex items-center justify-center mx-auto">
              <Download className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#0F172A]">
              4단계: 수합 종료 및 결과 내보내기
            </h2>
            <p className="text-sm text-[#64748B]">
              수합된 서명 및 개별 응답 데이터를 PDF 파일 및 엑셀 대장으로 내려받으세요.
            </p>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => alert('통합 PDF 파일이 다운로드됩니다.')}
                className="bg-[#0F6CBD] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#0F5B9E] transition shadow-xs"
              >
                PDF 문서 내보내기
              </button>
              <button
                onClick={() => alert('엑셀 데이터표가 다운로드됩니다.')}
                className="bg-[#16803C] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#136C33] transition shadow-xs"
              >
                엑셀 대장 내려받기
              </button>
            </div>
          </div>
        )}

        {/* Bottom Next/Prev Action Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-[#F6F8FB]">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-4 py-2 text-sm font-semibold text-[#64748B] hover:text-[#0F172A] disabled:opacity-40 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]"
          >
            이전 단계
          </button>

          <button
            onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
            disabled={currentStep === 4}
            className="px-6 py-2.5 text-sm font-semibold bg-[#0F6CBD] hover:bg-[#0F5B9E] text-white disabled:opacity-40 rounded-lg shadow-xs min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]"
          >
            다음 단계 이동
          </button>
        </div>

      </div>
    </div>
  );
};
