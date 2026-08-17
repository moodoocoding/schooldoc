import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Download, LoaderCircle, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getConsentPublicOrigin, isConsentFormsDemoMode } from './consentFormsConfig';
import { getConsentLocalDraft } from './consentFormsLocalStore';
import { getRemoteConsentForm } from './consentFormsRepository';
import { isRecipientsUnavailable, listConsentRecipients } from './consentRecipientsApi';
import { RECIPIENTS_PER_SHEET, consentPersonalLink, consentQrSheetFileName, paginateRecipients, sheetRecipients, sheetTitle } from './consentRecipientSheet';
import type { ConsentSheetTarget } from './consentRecipientSheet';
import type { ConsentLocalDraft, ConsentRecipientRecord } from './types';


export function ConsentQrPrintPage() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const pagesRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<ConsentLocalDraft | null>(() => isConsentFormsDemoMode ? getConsentLocalDraft(id) : null);
  const [recipients, setRecipients] = useState<ConsentRecipientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  // 미제출자에게 다시 배부하는 것이 이 화면의 주된 두 번째 쓰임이다.
  const target: ConsentSheetTarget = searchParams.get('target') === 'pending' ? 'pending' : 'all';

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!isConsentFormsDemoMode) {
          const form = await getRemoteConsentForm(id);
          if (!active) return;
          setDraft(form);
          setRecipients(await listConsentRecipients(id));
        }
      } catch (loadError) {
        if (active) {
          setError(isRecipientsUnavailable(loadError)
            ? '명단 기능이 아직 준비되지 않아 개인 QR을 만들 수 없습니다.'
            : loadError instanceof Error ? loadError.message : '명단을 불러오지 못했습니다.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#526174]">개인 QR 자료를 불러오고 있습니다.</div>;
  if (!draft) return <div className="py-20 text-center"><p className="font-bold">{error || '가정통신문을 찾을 수 없습니다.'}</p><button type="button" onClick={() => navigate('/tools/consent-forms')} className="mt-4 text-sm font-bold text-[#0F6CBD]">목록으로</button></div>;

  const personalLink = (token: string) => consentPersonalLink(getConsentPublicOrigin(), draft.publicToken, token);
  const printable = sheetRecipients(recipients, target);
  const pages = paginateRecipients(printable);
  const pendingCount = sheetRecipients(recipients, 'pending').length;
  const targetLabel = target === 'pending' ? '미제출자' : '전체';

  const downloadPdf = async () => {
    if (exporting) return;
    setExporting(true);
    setError('');
    try {
      const sheets = Array.from(pagesRef.current?.querySelectorAll<HTMLElement>('.consent-qr-print-page') ?? []);
      if (!sheets.length) throw new Error('내보낼 QR 자료가 없습니다.');
      await document.fonts?.ready;
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (let index = 0; index < sheets.length; index += 1) {
        const canvas = await html2canvas(sheets[index], {
          scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
          width: 794, height: 1123, windowWidth: 794, windowHeight: 1123,
        });
        if (index > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }
      pdf.save(consentQrSheetFileName(sheetTitle(draft.title, target)));
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'PDF를 만들지 못했습니다.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl pb-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EA] pb-4 print:hidden">
        <button type="button" onClick={() => navigate(`/tools/consent-forms/${draft.id}`)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />수합 관리로</button>
        <button type="button" disabled={exporting || printable.length === 0} onClick={() => void downloadPdf()} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white disabled:bg-[#AAB7C4]">{exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{exporting ? 'PDF 만드는 중' : 'PDF 다운로드'}</button>
      </div>

      <div className="mb-5 print:hidden">
        <h1 className="text-2xl font-extrabold">개인 QR 배부 자료</h1>
        <p className="mt-2 text-sm text-[#526174]">{targetLabel} {printable.length}명 · A4 세로 · 쪽당 {RECIPIENTS_PER_SHEET}명 · 총 {pages.length}쪽</p>
        <p className="mt-1 text-xs text-[#64748B]">각 QR은 해당 보호자의 응답 화면으로 바로 연결됩니다. 잘라서 개별로 전달해 주세요.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="배부 대상">
          {([['all', `전체 ${recipients.length}명`], ['pending', `미제출자 ${pendingCount}명`]] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={target === value} onClick={() => setSearchParams(value === 'pending' ? { target: 'pending' } : {})} className={`min-h-[40px] rounded-lg border px-3 text-xs font-bold ${target === value ? 'border-[#0F6CBD] bg-[#EFF6FC] text-[#0F6CBD]' : 'border-[#C8D0DA] text-[#334155]'}`}>{label}</button>
          ))}
        </div>
      </div>

      {error ? <div role="alert" className="mb-5 flex items-start gap-2 border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318] print:hidden"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}

      {printable.length === 0
        ? <section className="border-y border-[#DCE3EA] bg-white py-20 text-center print:hidden"><QrCode className="mx-auto h-9 w-9 text-[#94A3B8]" /><h2 className="mt-4 text-lg font-bold">{target === 'pending' ? '미제출자가 없습니다' : '배부할 명단이 없습니다'}</h2><p className="mt-2 text-sm text-[#526174]">{target === 'pending' ? '명단의 보호자가 모두 제출했습니다.' : '명단 있는 수합으로 만들면 보호자별 QR을 만들 수 있습니다.'}</p></section>
        : <div className="-mx-4 overflow-x-auto bg-[#E9EDF2] px-4 py-6 sm:mx-0 print:m-0 print:overflow-visible print:bg-white print:p-0">
          <div ref={pagesRef} className="mx-auto w-fit space-y-6 print:space-y-0">
            {pages.map((pageRecipients, pageIndex) => (
              <section key={pageIndex} data-testid="consent-qr-page" className="consent-qr-print-page flex h-[1123px] w-[794px] shrink-0 flex-col bg-white px-[48px] py-[42px] shadow-[0_8px_28px_rgba(15,23,42,0.16)]">
                <header className="mb-5 border-b-2 border-[#0F6CBD] pb-4">
                  <div className="flex items-center justify-between gap-5">
                    <div className="min-w-0"><p className="text-[12px] font-bold text-[#0F6CBD]">가정통신문 수합{target === 'pending' ? ' · 미제출자 재배부' : ''}</p><h2 className="mt-1 truncate text-[21px] font-extrabold text-[#0F172A]">{draft.title}</h2></div>
                    <div className="flex shrink-0 items-center gap-2 text-[12px] font-bold text-[#526174]"><QrCode className="h-4 w-4" />개인 응답 QR</div>
                  </div>
                </header>
                <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-4 gap-3">
                  {Array.from({ length: RECIPIENTS_PER_SHEET }, (_, slot) => {
                    const recipient = pageRecipients[slot];
                    if (!recipient) return <div key={`empty-${slot}`} aria-hidden="true" />;
                    return (
                      <div key={recipient.id} className="flex items-center gap-3 border border-dashed border-[#C8D0DA] px-3 py-2">
                        <div className="shrink-0 border border-[#DCE3EA] bg-white p-1"><QRCodeSVG value={personalLink(recipient.token)} size={104} level="M" includeMargin={false} aria-label={`${recipient.name} 응답 QR 코드`} /></div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-extrabold text-[#0F172A]">{recipient.name}</p>
                          {recipient.studentKey ? <p className="mt-0.5 truncate text-[12px] font-semibold text-[#526174]">{recipient.studentKey}</p> : null}
                          <p className="mt-2 text-[11px] leading-4 text-[#64748B]">QR을 찍어 가정통신문을 작성해 주세요.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <footer className="mt-4 flex items-center justify-between border-t border-[#EEF1F4] pt-3 text-[11px] text-[#64748B]"><span>개인 링크가 담겨 있으니 해당 보호자에게만 전달해 주세요.</span><span className="tabular-nums">{pageIndex + 1} / {pages.length}</span></footer>
              </section>
            ))}
          </div>
        </div>}
    </div>
  );
}
