import { useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Download, ImageDown, LoaderCircle, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { qrImageFileName, saveQrImage } from '../../utils/qrImage';
import { getStudentResultsPublicOrigin } from './studentResultsConfig';
import { paginateStudentResultRecipients } from './studentResultsUtils';
import { useStudentResultEvent } from './useStudentResults';

const STUDENTS_PER_PAGE = 8;
const pdfFileName = (title: string) => `${title.replace(/[\\/:*?"<>|]/g, '_').trim() || '학생 결과 안내'}_개인QR.pdf`;

export function StudentResultsQrPrintPage() {
  const navigate = useNavigate();
  const { resultId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: event, loading, refreshing, error } = useStudentResultEvent(resultId);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [savingQrId, setSavingQrId] = useState('');

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#526174]">QR 자료를 불러오는 중입니다.</div>;
  if (!event) {
    return (
      <div className="py-20 text-center">
        <p className="font-bold">{error || '결과 안내를 찾을 수 없습니다.'}</p>
        <button type="button" onClick={() => navigate('/tools/student-results')} className="mt-4 text-sm font-bold text-[#0F6CBD]">목록으로</button>
      </div>
    );
  }

  const requestedRecipientIds = searchParams.getAll('recipient');
  const printableRecipients = requestedRecipientIds.length > 0
    ? event.recipients.filter((recipient) => requestedRecipientIds.includes(recipient.id))
    : event.recipients;
  const pages = paginateStudentResultRecipients(printableRecipients, STUDENTS_PER_PAGE);
  const personalLink = (token: string) => `${getStudentResultsPublicOrigin()}/s/results/${event.publicToken}?recipient=${token}`;
  /** 개인 QR 하나만 이미지로 저장한다. 학생 한 명에게만 따로 보낼 때 쓴다. */
  const downloadQrImage = async (recipientId: string, name: string) => {
    if (savingQrId) return;
    setSavingQrId(recipientId);
    setExportError('');
    try {
      await saveQrImage(document.getElementById(`student-result-qr-${recipientId}`), qrImageFileName(`${event.title}_${name}`, '개인QR', '학생 결과 안내'));
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'QR 이미지를 저장하지 못했습니다.');
    } finally {
      setSavingQrId('');
    }
  };

  const downloadPdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError('');
    try {
      const pageElements = Array.from(
        pagesRef.current?.querySelectorAll<HTMLElement>('[data-testid="student-result-qr-page"]') ?? [],
      );
      if (pageElements.length === 0) throw new Error('PDF로 만들 QR 페이지가 없습니다.');

      await document.fonts?.ready;
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

      for (const [index, pageElement] of pageElements.entries()) {
        const canvas = await html2canvas(pageElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          width: 794,
          height: 1123,
          windowWidth: 794,
          windowHeight: 1123,
          onclone: (clonedDocument) => {
            clonedDocument.querySelectorAll<HTMLElement>('.student-result-qr-print-page').forEach((page) => {
              page.style.boxShadow = 'none';
            });
            // 저장 버튼은 화면에만 둔다. PDF에 찍히면 배부물이 지저분해진다.
            clonedDocument.querySelectorAll<HTMLElement>('.qr-save-button').forEach((button) => button.remove());
          },
        });
        if (index > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }

      pdf.save(pdfFileName(event.title));
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'PDF를 만들지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl pb-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EA] pb-4 print:hidden">
        <button type="button" onClick={() => navigate(`/tools/student-results/${event.id}`)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]">
          <ArrowLeft className="h-5 w-5" />학생 현황으로
        </button>
        <button type="button" disabled={isExporting} onClick={() => void downloadPdf()} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5A9E] disabled:cursor-wait disabled:bg-[#AAB7C4]">
          {isExporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isExporting ? 'PDF 만드는 중' : 'PDF 다운로드'}
        </button>
      </div>

      <div className="mb-5 print:hidden">
        <h1 className="text-2xl font-extrabold">개인 QR PDF</h1>
        <p className="mt-2 text-sm text-[#526174]">선택 {printableRecipients.length}명 · PDF A4 세로 · 페이지당 8명 · 총 {pages.length}페이지</p>
        <p className="mt-1 text-xs text-[#64748B]">각 QR은 해당 학생의 결과로 바로 연결됩니다. 학생 본인에게만 전달해 주세요.</p>
        {refreshing ? <p role="status" aria-live="polite" className="mt-1 text-xs font-semibold text-[#0F6CBD]">명단을 새로 받는 중입니다. 인쇄 준비는 그대로 이어집니다.</p> : null}
      </div>

      {exportError ? (
        <div role="alert" className="mb-5 flex items-start gap-2 border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{exportError}
        </div>
      ) : null}

      <div className="-mx-4 overflow-x-auto bg-[#E9EDF2] px-4 py-6 sm:mx-0 print:m-0 print:overflow-visible print:bg-white print:p-0">
        <div ref={pagesRef} className="student-result-qr-print-root mx-auto w-fit space-y-6 print:space-y-0">
          {pages.map((recipients, pageIndex) => (
            <section
              key={`page-${pageIndex}`}
              data-testid="student-result-qr-page"
              className="student-result-qr-print-page flex h-[1123px] w-[794px] shrink-0 flex-col bg-white px-[48px] py-[42px] shadow-[0_8px_28px_rgba(15,23,42,0.16)]"
            >
              <header className="mb-5 border-b-2 border-[#0F6CBD] pb-4">
                <div className="flex items-center justify-between gap-5">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-[#0F6CBD]">학생 결과 안내</p>
                    <h2 className="mt-1 truncate text-[21px] font-extrabold text-[#0F172A]">{event.title}</h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[12px] font-bold text-[#526174]">
                    <QrCode className="h-4 w-4" />개인 조회 QR
                  </div>
                </div>
              </header>

              <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-4 gap-3">
                {Array.from({ length: STUDENTS_PER_PAGE }, (_, slotIndex) => {
                  const recipient = recipients[slotIndex];
                  if (!recipient) return <div key={`empty-${slotIndex}`} aria-hidden="true" />;

                  return (
                    <article key={recipient.id} data-testid="student-result-qr-card" className="flex min-h-0 flex-col items-center rounded-lg border border-[#C8D0DA] px-4 py-3 text-center">
                      <div className="w-full min-w-0 border-b border-[#E2E8F0] pb-2">
                        <p className="truncate text-[17px] font-extrabold text-[#0F172A]">{recipient.name}</p>
                        <p className="mt-0.5 truncate text-[10px] font-semibold text-[#64748B]">{recipient.studentKey}</p>
                      </div>
                      <div id={`student-result-qr-${recipient.id}`} className="mt-2 flex h-[116px] w-[116px] items-center justify-center bg-white">
                        <QRCodeSVG
                          value={personalLink(recipient.personalToken)}
                          size={116}
                          level="M"
                          title={`${recipient.name} 학생 개인 결과 조회 QR`}
                        />
                      </div>
                      <p className="mt-2 text-[9px] leading-[1.4] text-[#526174]">카메라로 스캔하여 결과를 확인하세요.</p>
                      <button
                        type="button"
                        disabled={savingQrId !== ''}
                        onClick={() => void downloadQrImage(recipient.id, recipient.name)}
                        aria-label={`${recipient.name} 학생 QR 이미지 저장`}
                        className="qr-save-button mt-1 inline-flex min-h-[28px] items-center gap-1 rounded-md px-2 text-[10px] font-bold text-[#0F6CBD] hover:bg-[#EFF6FC] disabled:text-[#94A3B8] print:hidden"
                      >
                        {savingQrId === recipient.id ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <ImageDown className="h-3 w-3" />}
                        {savingQrId === recipient.id ? '저장 중' : '이미지 저장'}
                      </button>
                    </article>
                  );
                })}
              </div>

              <footer className="mt-4 flex items-center justify-between text-[10px] text-[#64748B]">
                <span>SchoolDoc</span>
                <span>{pageIndex + 1} / {pages.length}</span>
              </footer>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
