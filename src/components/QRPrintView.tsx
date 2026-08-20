import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, ImageDown, LoaderCircle, Printer } from 'lucide-react';
import { qrImageFileName, saveQrImage } from '../utils/qrImage';
import type { EventData } from '../types';

interface QRPrintViewProps {
  event: EventData;
  onBack: () => void;
}

export const QRPrintView: React.FC<QRPrintViewProps> = ({ event, onBack }) => {
  // QR을 그리는 화면에는 이미지 저장이 함께 있어야 한다. 제품 원칙이며
  // tests/unit/qrScreensHaveImageSave.test.ts가 지킨다.
  const [savingQrId, setSavingQrId] = useState('');
  const [qrError, setQrError] = useState('');

  const downloadQrImage = async (studentId: string, name: string) => {
    if (savingQrId) return;
    setSavingQrId(studentId);
    setQrError('');
    try {
      await saveQrImage(document.getElementById(`student-qr-${studentId}`), qrImageFileName(`${event.title}_${name}`, '개인QR', '평가 결과'));
    } catch (error) {
      setQrError(error instanceof Error ? error.message : 'QR 이미지를 저장하지 못했습니다.');
    } finally {
      setSavingQrId('');
    }
  };

  const getStudentPortalLink = (studentId: string, accessCode: string) => {
    const base = window.location.origin + window.location.pathname;
    return `${base}?eventId=${event.id}&studentId=${studentId}&code=${accessCode}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Control panel - hidden during print */}
      <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-500 transition"
        >
          <ArrowLeft className="w-5 h-5" /> 평가 상세 화면으로
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-md transition"
        >
          <Printer className="w-4 h-4" /> 일괄 인쇄하기 (A4용지 최적화)
        </button>
      </div>

      {qrError ? (
        <p role="alert" className="print:hidden text-sm font-semibold text-red-700">{qrError}</p>
      ) : null}

      {/* Printable Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 print:p-0">
        {event.students.map((student) => {
          const studentUrl = getStudentPortalLink(student.id, student.accessCode);

          return (
            <div
              key={student.id}
              className="bg-white border-2 border-slate-350 rounded-2xl p-6 flex flex-col justify-between h-[280px] relative overflow-hidden print:h-[260px] print:shadow-none print:border-slate-300 break-inside-avoid"
            >
              {/* Card Header */}
              <div className="border-b-2 border-slate-100 pb-3 flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wide bg-brand-50 px-2 py-0.5 rounded-full">
                    개별 데이터 안심 조회
                  </span>
                  <h3 className="text-xs font-bold text-slate-700 mt-1 line-clamp-1 max-w-[220px]">
                    {event.title}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-slate-900">{student.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono block">({student.id})</span>
                </div>
              </div>

              {/* Card Body */}
              <div className="flex gap-4 items-center flex-1 my-3">
                {/* QR Code */}
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <div id={`student-qr-${student.id}`} className="p-2 border border-slate-200 rounded-xl bg-slate-50">
                    <QRCodeSVG
                      value={studentUrl}
                      size={110}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingQrId !== ''}
                    onClick={() => void downloadQrImage(student.id, student.name)}
                    aria-label={`${student.name} QR 이미지 저장`}
                    className="print:hidden inline-flex min-h-[24px] items-center gap-1 rounded-md px-1.5 text-[10px] font-bold text-brand-500 hover:bg-slate-50 disabled:text-slate-400"
                  >
                    {savingQrId === student.id ? <LoaderCircle className="w-3 h-3 animate-spin" /> : <ImageDown className="w-3 h-3" />}
                    {savingQrId === student.id ? '저장 중' : '이미지 저장'}
                  </button>
                </div>

                {/* Instructions */}
                <div className="space-y-2 text-xs flex-1">
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    스마트폰 카메라로 왼쪽 QR코드를 스캔하면 본인의 상세 평가 결과 페이지로 즉시 자동 접속됩니다.
                  </p>
                  
                  <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg text-[10px]">
                    <div className="flex justify-between border-b border-slate-200/50 pb-1">
                      <span className="text-slate-400 font-medium">조회 URL 번호:</span>
                      <span className="font-mono font-bold text-slate-700 truncate max-w-[120px]">{event.id}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400 font-medium">인증코드:</span>
                      <span className="font-mono font-bold text-brand-600">{student.accessCode}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="text-[9px] text-slate-400 border-t border-slate-100 pt-2 flex justify-between font-medium">
                <span>* 본 안내 카드는 타인에게 노출되지 않도록 보관에 주의하세요.</span>
                <span className="font-mono">safelookup v1.0</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
