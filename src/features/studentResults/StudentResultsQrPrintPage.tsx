import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Download, ImageDown, LoaderCircle, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { qrImageFileName, saveQrImage } from '../../utils/qrImage';
import { getStudentResultsPublicOrigin } from './studentResultsConfig';
import { studentResultsQrPageSize } from './studentResultsQrLayout';
import { paginateStudentResultRecipients } from './studentResultsUtils';
import type { ResultRecipient } from './types';
import { useStudentResultEvent } from './useStudentResults';

const pdfFileName = (title: string) => `${title.replace(/[\\/:*?"<>|]/g, '_').trim() || '학생 결과 안내'}_개인QR.pdf`;

function SheetHeader({ title }: { title: string }) {
  return (
    <header className="mb-5 shrink-0 border-b-2 border-[#0F6CBD] pb-4">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-[#0F6CBD]">학생 결과 안내</p>
          <h2 className="mt-1 text-[21px] font-extrabold leading-[1.45] text-[#0F172A] [overflow-wrap:anywhere]">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[12px] font-bold text-[#526174]">
          <QrCode className="h-4 w-4" />개인 조회 QR
        </div>
      </div>
    </header>
  );
}

function RecipientQrCard({ recipient, link, measuring = false, savingQrId, onDownload }: {
  recipient: ResultRecipient;
  link: string;
  measuring?: boolean;
  savingQrId?: string;
  onDownload?: (recipient: ResultRecipient) => void;
}) {
  return (
    <article
      data-testid={measuring ? undefined : 'student-result-qr-card'}
      data-qr-measure-card={measuring ? true : undefined}
      className="flex flex-col items-center rounded-lg border border-[#C8D0DA] px-4 py-[10px] text-center"
    >
      <div className="w-full min-w-0 shrink-0 border-b border-[#E2E8F0] pb-2">
        <p data-testid={measuring ? undefined : 'student-result-qr-name'} className="max-w-full px-1 text-[17px] font-extrabold leading-[1.45] text-[#0F172A] [overflow-wrap:anywhere]">
          {recipient.name}
        </p>
        <p data-testid={measuring ? undefined : 'student-result-qr-key'} className="mt-0.5 max-w-full px-1 text-[10px] font-semibold leading-[1.45] text-[#526174] [overflow-wrap:anywhere]">
          {recipient.studentKey}
        </p>
      </div>
      <div className="relative mt-2 flex w-full shrink-0 justify-center">
        <div id={measuring ? undefined : `student-result-qr-${recipient.id}`} data-testid={measuring ? undefined : 'student-result-qr-code'} className="flex h-[116px] w-[116px] shrink-0 items-center justify-center bg-white">
          {measuring ? null : <QRCodeSVG value={link} size={116} level="M" includeMargin title={`${recipient.name} 학생 개인 결과 조회 QR`} />}
        </div>
        {!measuring && onDownload ? (
          <button
            type="button"
            disabled={Boolean(savingQrId)}
            onClick={() => onDownload(recipient)}
            aria-label={`${recipient.studentKey} ${recipient.name} 학생 QR 이미지 저장`}
            data-qr-screen-only
            className="absolute right-0 top-1/2 inline-flex min-h-[44px] w-[64px] -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-lg border border-[#C8D0DA] bg-white px-1 text-[11px] font-bold text-[#0F6CBD] hover:bg-[#EFF6FC] disabled:opacity-60 print:hidden"
          >
            {savingQrId === recipient.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
            {savingQrId === recipient.id ? '저장 중' : 'PNG 저장'}
          </button>
        ) : null}
      </div>
      <p className="mt-2 shrink-0 text-[11px] leading-[1.4] text-[#526174]">카메라로 스캔하여 결과를 확인하세요.</p>
    </article>
  );
}

export function StudentResultsQrPrintPage() {
  const navigate = useNavigate();
  const { resultId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: event, loading, refreshing, error } = useStudentResultEvent(resultId);
  const pagesRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [savingQrId, setSavingQrId] = useState('');
  const [exportError, setExportError] = useState('');
  const [pageSize, setPageSize] = useState(8);
  const [layoutReady, setLayoutReady] = useState(false);
  const [layoutError, setLayoutError] = useState('');
  const printableRecipients = useMemo(() => {
    const ids = new Set(searchParams.getAll('recipient'));
    return event?.recipients.filter((recipient) => ids.size === 0 || ids.has(recipient.id)) ?? [];
  }, [event, searchParams]);

  useEffect(() => {
    let active = true;
    setLayoutReady(false);
    setLayoutError('');
    void (async () => {
      await document.fonts?.ready;
      if (!active || !measureRef.current) return;
      const header = measureRef.current.querySelector('header');
      const cardElements = measureRef.current.querySelectorAll<HTMLElement>('[data-qr-measure-card]');
      if (!header || cardElements.length === 0) {
        setLayoutReady(true);
        return;
      }
      // A4 1123px - 위아래 여백 84px - 머리글/간격 - 쪽번호/간격.
      // 화면과 동일한 글꼴·폭에서 측정하여 긴 이름도 자르거나 QR을 줄이지 않는다.
      const availableHeight = 1123 - 84 - header.getBoundingClientRect().height - 20 - 15 - 16;
      const cardHeight = Math.max(...Array.from(cardElements, (card) => card.getBoundingClientRect().height));
      try {
        setPageSize(studentResultsQrPageSize(availableHeight, cardHeight));
        setLayoutReady(true);
      } catch (cause) {
        setLayoutError(cause instanceof Error ? cause.message : 'QR 배치를 확인해 주세요.');
      }
    })();
    return () => { active = false; };
  }, [event?.title, printableRecipients]);

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#526174]">QR 자료를 불러오는 중입니다.</div>;
  if (!event) {
    return <div className="py-20 text-center"><p className="font-bold">{error || '결과 안내를 찾을 수 없습니다.'}</p><button type="button" onClick={() => navigate('/tools/student-results')} className="mt-4 text-sm font-bold text-[#0F6CBD]">목록으로</button></div>;
  }

  const pages = printableRecipients.length > 0 ? paginateStudentResultRecipients(printableRecipients, pageSize) : [];
  const personalLink = (token: string) => `${getStudentResultsPublicOrigin()}/s/results/${event.publicToken}?recipient=${token}`;
  const downloadQr = async (recipient: ResultRecipient) => {
    if (savingQrId) return;
    setSavingQrId(recipient.id);
    setExportError('');
    try {
      await saveQrImage(
        document.getElementById(`student-result-qr-${recipient.id}`),
        qrImageFileName(`${recipient.studentKey.slice(0, 20)}_${recipient.name.slice(0, 30)}_${event.title}`, '개인QR_' + recipient.id, '학생 결과 안내'),
      );
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : 'QR 이미지를 만들지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setSavingQrId('');
    }
  };
  const downloadPdf = async () => {
    if (isExporting || !layoutReady || pages.length === 0) return;
    setIsExporting(true);
    setExportError('');
    try {
      const pageElements = Array.from(pagesRef.current?.querySelectorAll<HTMLElement>('[data-testid="student-result-qr-page"]') ?? []);
      if (pageElements.length === 0) throw new Error('PDF로 만들 QR 페이지가 없습니다.');
      await document.fonts?.ready;
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (const [index, pageElement] of pageElements.entries()) {
        const canvas = await html2canvas(pageElement, {
          scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
          width: 794, height: 1123, windowWidth: 794, windowHeight: 1123,
          onclone: (clonedDocument) => {
            clonedDocument.querySelectorAll('[data-qr-screen-only]').forEach((button) => button.remove());
            const clonedPages = Array.from(clonedDocument.querySelectorAll<HTMLElement>('.student-result-qr-print-page'));
            const selectedPage = clonedPages[index];
            if (!selectedPage) throw new Error('PDF 페이지를 복사하지 못했습니다.');
            clonedPages.forEach((page) => { if (page !== selectedPage) page.remove(); });
            clonedDocument.body.appendChild(selectedPage);
            clonedDocument.body.style.margin = '0';
            clonedDocument.body.style.padding = '0';
            selectedPage.style.position = 'absolute';
            selectedPage.style.left = '0';
            selectedPage.style.top = '0';
            selectedPage.style.margin = '0';
            selectedPage.style.boxShadow = 'none';
          },
        });
        if (index > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }
      pdf.save(pdfFileName(event.title));
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : 'PDF를 만들지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl pb-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EA] pb-4 print:hidden">
        <button type="button" onClick={() => navigate(`/tools/student-results/${event.id}`)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />학생 현황으로</button>
        <button type="button" disabled={isExporting || !layoutReady || pages.length === 0} onClick={() => void downloadPdf()} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5A9E] disabled:cursor-wait disabled:bg-[#AAB7C4]">{isExporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{isExporting ? 'PDF 만드는 중' : 'PDF 다운로드'}</button>
      </div>
      <div className="mb-5 print:hidden">
        <h1 className="text-2xl font-extrabold">개인 QR PDF</h1>
        <p className="mt-2 text-sm text-[#526174]">선택 {printableRecipients.length}명 · PDF A4 세로 · 페이지당 {pageSize}명 · 총 {pages.length}페이지</p>
        <p className="mt-1 text-xs text-[#526174]">개인 QR의 PNG 저장은 각 학생 카드에서 할 수 있습니다. 이름이 길면 잘리지 않도록 페이지당 인원을 줄입니다.</p>
        <p className="mt-1 text-xs text-[#526174]">각 QR은 해당 학생의 결과로 바로 연결됩니다. 학생 본인에게만 전달해 주세요.</p><p className="mt-2 text-xs text-[#526174] sm:hidden">A4 미리보기는 옆으로 밀어 오른쪽 학생도 확인할 수 있습니다.</p>
        {refreshing ? <p role="status" aria-live="polite" className="mt-1 text-xs font-semibold text-[#0F6CBD]">명단을 새로 받는 중입니다. 인쇄 준비는 그대로 이어집니다.</p> : null}
      </div>
      {exportError || layoutError ? <div role="alert" className="mb-5 flex items-start gap-2 border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318] print:hidden"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{exportError || layoutError}</div> : null}
      <div ref={measureRef} aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 invisible w-[794px] px-[48px] py-[42px] print:hidden">
        <SheetHeader title={event.title} />
        <div className="grid grid-cols-2 items-start gap-3">
          {printableRecipients.map((recipient) => <RecipientQrCard key={recipient.id} recipient={recipient} link="" measuring />)}
        </div>
      </div>
      {pages.length === 0 ? <p className="border-y border-[#DCE3EA] bg-white px-4 py-10 text-center text-sm font-semibold text-[#526174]">선택한 학생이 없습니다. 학생 현황에서 배부 대상을 다시 선택해 주세요.</p> : !layoutReady ? (layoutError ? null : <p role="status" className="py-10 text-center text-sm text-[#526174]">이름 길이에 맞춰 QR을 배치하고 있습니다.</p>) : (
        <div role="region" aria-label="개인 QR A4 미리보기" tabIndex={0} className="-mx-4 overflow-x-auto bg-[#E9EDF2] px-4 py-6 sm:mx-0 print:m-0 print:overflow-visible print:bg-white print:p-0">
          <div ref={pagesRef} className="student-result-qr-print-root mx-auto w-fit space-y-6 print:space-y-0">
            {pages.map((recipients, pageIndex) => (
              <section key={`page-${pageIndex}`} data-testid="student-result-qr-page" className="student-result-qr-print-page flex h-[1123px] w-[794px] shrink-0 flex-col bg-white px-[48px] py-[42px] shadow-[0_8px_28px_rgba(15,23,42,0.16)]">
                <SheetHeader title={event.title} />
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-3" style={{ gridTemplateRows: `repeat(${pageSize / 2}, minmax(0, 1fr))` }}>
                  {Array.from({ length: pageSize }, (_, slotIndex) => {
                    const recipient = recipients[slotIndex];
                    return recipient ? <RecipientQrCard key={recipient.id} recipient={recipient} link={personalLink(recipient.personalToken)} savingQrId={savingQrId} onDownload={(target) => void downloadQr(target)} /> : <div key={`empty-${slotIndex}`} aria-hidden="true" />;
                  })}
                </div>
                <footer className="mt-4 flex shrink-0 items-center justify-between text-[10px] leading-[15px] text-[#526174]"><span>SchoolDoc</span><span>{pageIndex + 1} / {pages.length}</span></footer>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
