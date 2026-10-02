import { registryPrintPlan } from '../../../supabase/functions/_shared/registryPrintLayout';
import { createRegistryPrintDocument } from './registryPrintDocument';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileSpreadsheet,
  ImageDown,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { qrImageFileName, saveQrImage } from '../../utils/qrImage';
import { useNavigate, useParams } from 'react-router-dom';
import { RegistryConfirmDialog } from './RegistryConfirmDialog';
import { isRegistryDemoMode } from './registryConfig';
import { getPublicAppOrigin } from '../../utils/publicAppOrigin';
import { RegistryPrintSheet } from './RegistryPrintSheet';
import { RegistryBrowserPrint } from './RegistryBrowserPrint';
import { RegistryPagination } from './RegistryPagination';
import {
  addParticipant,
  previewRegistryPurge,
  deleteRegistry,
  loadRegistryImages,
  rotateRegistryToken,
  issueVerificationCode,
  cleanupRegistryUploads,
  clearSignature,
  createRegistryPdf,
  removeParticipant,
  updateRegistry,
} from './registryService';
import { formatSignedAt } from './registryUtils';
import type { RegistryLayout, RegistryParticipant, RegistryPurgeCounts } from './types';
import { useRegistry } from './useRegistries';

type Filter = 'all' | 'signed' | 'pending';
type PendingAction = { kind: 'delete' | 'resign'; participantId: string; participantName: string };

const inputClass = 'min-h-[44px] w-full rounded-lg border border-[#DCE3EA] bg-white px-3.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]/15';

const fileName = (title: string, extension: string) => `${title.replace(/[\\/:*?"<>|]/g, '_') || '등록부'}.${extension}`;
const PARTICIPANTS_PER_PAGE = 50;
const waitForPaint = () => new Promise<void>((resolve) => {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
});

export function RegistryManagePage() {
  const { registryId } = useParams();
  const { data: registry, loading, error, refresh } = useRegistry(registryId);
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState('');
  const [savingQr, setSavingQr] = useState(false);
  const [qrError, setQrError] = useState('');
  const [isMutating, setIsMutating] = useState(false);
  const [participantPage, setParticipantPage] = useState(1);
  const [printPage, setPrintPage] = useState(1);
  const [renderAllPrintPages, setRenderAllPrintPages] = useState(false);
  const printHandlerRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => { const onKey=(event:KeyboardEvent)=>{if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='p' && printHandlerRef.current) {event.preventDefault();void printHandlerRef.current();}}; window.addEventListener('keydown',onKey); return()=>window.removeEventListener('keydown',onKey); }, []);
  const [images, setImages] = useState<Record<string, RegistryParticipant>>({});
  const [imageRetry, setImageRetry] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const imageCache = useRef(new Map<string, { participant: RegistryParticipant; until: number }>());
  const [sharePassword, setSharePassword] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [rotateConfirm, setRotateConfirm] = useState(false);
  const [purgeCounts, setPurgeCounts] = useState<RegistryPurgeCounts | null>(null);
  const plan = useMemo(() => registry ? registryPrintPlan(registry) : null, [registry]);
  printHandlerRef.current = null;
  const printPageCount = registry && plan ? Math.max(1,Math.ceil(registry.participants.length/plan.pageSize)) : 1;
  const safePrintPage = Math.min(printPage,printPageCount);
  const printRegistry = useMemo(() => registry ? { ...registry, participants:registry.participants.map((p) => {
    const loaded=images[p.id]; return loaded && loaded.signaturePath===p.signaturePath && p.signature ? { ...p, signature: loaded.signature, imageError:loaded.imageError } : p;
  }) } : null, [registry,images]);
  useEffect(() => {
    if (!registry || !plan || isRegistryDemoMode) return;
    let active = true;
    const requested = renderAllPrintPages ? registry.participants : registry.participants.slice((safePrintPage-1)*plan.pageSize,safePrintPage*plan.pageSize);
    const needed=requested.filter((p)=>p.signature && !imageCache.current.has(p.signaturePath ?? p.id));
    const expired=requested.filter((p)=>p.signature && (imageCache.current.get(p.signaturePath ?? p.id)?.until ?? Infinity)<=Date.now());
    for (const p of expired) imageCache.current.delete(p.signaturePath ?? p.id);
    const toLoad=[...needed,...expired];
    if (!toLoad.length) { setImages(Object.fromEntries(requested.flatMap((p)=>{const c=imageCache.current.get(p.signaturePath ?? p.id);return c?[[p.id,c.participant]]:[];}))); return; }
    setImageLoading(true);
    void loadRegistryImages(toLoad).then((loaded) => {
      if (!active) return;
      for (const p of loaded) imageCache.current.set(p.signaturePath ?? p.id,{participant:p,until:Date.now()+50*60*1000});
      setImages((current)=>({...current,...Object.fromEntries(loaded.map((p)=>[p.id,p]))}));
    }).catch(() => { if(active) setImages((current)=>({...current,...Object.fromEntries(toLoad.map((p)=>[p.id,{...p,imageError:true}]))})); })
      .finally(()=>{if(active) setImageLoading(false);});
    return ()=>{active=false;};
  }, [registry, safePrintPage, plan, renderAllPrintPages, imageRetry]);
  const retryImages = () => { imageCache.current.clear(); setImages({}); setImageRetry((n)=>n+1); };
  const markImageError = (id:string) => { imageCache.current.clear(); setImages((current)=>({...current,[id]:{...registry!.participants.find((p)=>p.id===id)!,imageError:true}})); };


  const filteredParticipants = useMemo(() => {
    if (!registry) return [];
    const keyword = query.trim().toLocaleLowerCase('ko-KR');
    return registry.participants.filter((participant) => {
      if (filter === 'signed' && !participant.signature) return false;
      if (filter === 'pending' && participant.signature) return false;
      if (!keyword) return true;
      return participant.name.toLocaleLowerCase('ko-KR').includes(keyword)
        || Object.values(participant.values).some((value) => value.toLocaleLowerCase('ko-KR').includes(keyword));
    });
  }, [filter, query, registry]);

  if (loading && !registry) {
    return (
      <div className="mx-auto max-w-3xl border-y border-[#DCE3EA] bg-white py-20 text-center">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#0F6CBD]" />
        <p className="mt-4 text-sm font-semibold text-[#526174]">등록부를 불러오고 있습니다.</p>
      </div>
    );
  }

  if (error && !registry) {
    return (
      <div className="mx-auto max-w-3xl border-y border-[#FECACA] bg-[#FEF2F2] px-6 py-16 text-center">
        <h1 className="text-xl font-extrabold text-[#B42318]">등록부를 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-[#7A271A]">{error}</p>
        <button type="button" onClick={() => void refresh()} className="mt-5 min-h-[44px] rounded-lg border border-[#FECACA] bg-white px-5 text-sm font-bold text-[#B42318]">다시 시도</button>
      </div>
    );
  }

  if (!registry) {
    return (
      <div className="mx-auto max-w-3xl border-y border-[#DCE3EA] bg-white py-20 text-center">
        <h1 className="text-xl font-extrabold text-[#0F172A]">등록부를 찾을 수 없습니다</h1>
        <button type="button" onClick={() => navigate('/tools/registry-sign')} className="mt-5 min-h-[44px] rounded-lg border border-[#DCE3EA] px-5 text-sm font-bold text-[#334155]">목록으로</button>
      </div>
    );
  }

  const signedCount = registry.participants.filter((participant) => participant.signature).length;
  const publicUrl = `${getPublicAppOrigin()}/s/registry/${registry.publicToken}`;
  const participantPageCount = Math.max(1, Math.ceil(filteredParticipants.length / PARTICIPANTS_PER_PAGE));
  const safeParticipantPage = Math.min(participantPage, participantPageCount);
  const visibleParticipants = filteredParticipants.slice(
    (safeParticipantPage - 1) * PARTICIPANTS_PER_PAGE,
    safeParticipantPage * PARTICIPANTS_PER_PAGE,
  );

  const copyPublicUrl = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleAddParticipant = async () => {
    if (!newName.trim()) return;
    setIsMutating(true);
    setActionError('');
    try {
      await addParticipant(registry.id, { name: newName.trim(), values: newValues });
      setNewName('');
      setNewValues({});
      setParticipantPage(Math.ceil((registry.participants.length + 1) / PARTICIPANTS_PER_PAGE));
    } catch (mutationError) {
      setActionError(mutationError instanceof Error ? mutationError.message : '참석자를 추가하지 못했습니다.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleUpdate = async (patch: Parameters<typeof updateRegistry>[1]) => {
    setIsMutating(true);
    setActionError('');
    try {
      await updateRegistry(registry.id, patch);
      return true;
    } catch (mutationError) {
      setActionError(mutationError instanceof Error ? mutationError.message : '등록부를 수정하지 못했습니다.');
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const handleParticipantAction = async () => {
    if (!pendingAction || isMutating) return;
    setIsMutating(true);
    setActionError('');
    try {
      if (pendingAction.kind === 'resign') await clearSignature(registry.id, pendingAction.participantId);
      else await removeParticipant(registry.id, pendingAction.participantId);
      setPendingAction(null);
    } catch (mutationError) {
      setActionError(mutationError instanceof Error ? mutationError.message : '요청을 처리하지 못했습니다.');
    } finally {
      setIsMutating(false);
    }
  };

  const downloadQrImage = async () => {
    if (savingQr) return;
    setSavingQr(true);
    setQrError('');
    try {
      await saveQrImage(qrRef.current, qrImageFileName(registry.title, '서명QR', '등록부'));
    } catch (error) {
      setQrError(error instanceof Error ? error.message : 'QR 이미지를 저장하지 못했습니다.');
    } finally {
      setSavingQr(false);
    }
  };

  const exportPdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setActionError('');
    try {
      if (!isRegistryDemoMode) {
        const blob = await createRegistryPdf(registry.id);
        if (!blob) throw new Error('PDF 파일을 받지 못했습니다.');
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName(registry.title, 'pdf');
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }

      setRenderAllPrintPages(true);
      await waitForPaint();
      const pages = Array.from(printRef.current?.querySelectorAll<HTMLElement>('.registry-print-page') ?? []);
      if (pages.length === 0) return;
      const standalone = await createRegistryPrintDocument(printRef.current!);
      try {
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'),import('jspdf')]);
        const pdf = new jsPDF({ orientation:'portrait',unit:'mm',format:'a4',compress:true });
        for (let index=0;index<standalone.pages.length;index++) {
          const page=standalone.pages[index];
          // 각 쪽을 문서 맨 위로 이동해 이전 쪽의 좌표/스크롤 영향을 제거한다.
          standalone.document.body.replaceChildren(page);
          const canvas=await html2canvas(page,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false,width:794,height:1123,windowWidth:794,windowHeight:1123,scrollX:0,scrollY:0});
          if (index) pdf.addPage('a4','portrait');
          pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,210,297,undefined,'FAST');
        }
        pdf.save(fileName(registry.title,'pdf'));
      } finally { standalone.dispose(); }
    } catch (exportError) {
      setActionError(exportError instanceof Error ? exportError.message : 'PDF를 만들지 못했습니다.');
    } finally {
      setRenderAllPrintPages(false);
      setIsExporting(false);
    }
  };

  const printAll = async () => {
    if (isExporting) return;
    setActionError(''); setIsExporting(true);
    try {
      const complete = { ...registry, participants: await loadRegistryImages(registry.participants) };
      if (complete.participants.some((p)=>p.signature && (!p.signature.dataUrl || p.imageError))) throw new Error('완료된 서명 이미지를 확인한 뒤 인쇄해 주세요.');
      setImages(Object.fromEntries(complete.participants.map((p)=>[p.id,p]))); setRenderAllPrintPages(true); await waitForPaint();
      const doc = await createRegistryPrintDocument(printRef.current!);
      const cleanup = () => doc.dispose();
      doc.frame.contentWindow!.addEventListener('afterprint',cleanup,{once:true});
      doc.frame.contentWindow!.print();
      window.setTimeout(cleanup,60000);
    } catch (error) { setActionError(error instanceof Error ? error.message : '인쇄 자료를 준비하지 못했습니다.'); }
    finally { setRenderAllPrintPages(false);setIsExporting(false); }
  };

  printHandlerRef.current = printAll;

  const exportExcel = async () => {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    const header = ['연번', '성명', ...registry.columns.map((column) => column.label), '서명 상태', '서명 시각'];
    const rows = registry.participants.map((participant) => [
      participant.rowNumber,
      participant.name,
      ...registry.columns.map((column) => participant.values[column.id] ?? ''),
      participant.signature ? '완료' : '미서명',
      participant.signature?.signedAt ?? '',
    ]);
    const sheetData = [
      header.map((value) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#EAF1F7' })),
      ...rows,
    ];
    await writeXlsxFile(sheetData).toFile(fileName(registry.title, 'xlsx'));
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-[1500px] space-y-6 overflow-x-clip pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EA] pb-4">
        <button type="button" onClick={() => navigate('/tools/registry-sign')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]">
          <ArrowLeft className="h-5 w-5" /> 등록부 목록
        </button>
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${registry.status === 'open' ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EEF1F4] text-[#526174]'}`}>{registry.status === 'open' ? '수합 중' : '종료'}</span>
          <button type="button" disabled={isMutating} onClick={() => void handleUpdate({ status: registry.status === 'open' ? 'closed' : 'open' })} className="min-h-[44px] rounded-lg border border-[#DCE3EA] bg-white px-3 text-xs font-bold text-[#334155] hover:bg-[#F6F8FB] disabled:opacity-50">
            {registry.status === 'open' ? '수합 종료' : '다시 열기'}
          </button>
        </div>
      </div>

      {error ? <p role="alert" className="text-sm text-[#B42318]">{error}<button type="button" onClick={()=>void refresh()} className="ml-3 min-h-[44px] rounded-lg border px-4">현황 다시 불러오기</button></p> : null}
      {actionError ? <p role="alert" className="border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]">{actionError}</p> : null}

      <div>
        <p className="text-xs font-bold text-[#0F6CBD]">등록부 관리</p>
        <h1 className="mt-1 max-w-4xl text-2xl font-extrabold leading-tight text-[#0F172A] sm:text-3xl">{registry.title}</h1>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#526174]">
          {registry.leftHeader ? <p className="whitespace-pre-line">{registry.leftHeader}</p> : null}
          {registry.rightHeader ? <p className="whitespace-pre-line">{registry.rightHeader}</p> : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#DCE3EA] bg-white p-4">
          <Users className="h-5 w-5 text-[#0F6CBD]" />
          <p className="mt-3 text-xs font-semibold text-[#526174]">전체 참석자</p>
          <p className="mt-1 text-2xl font-extrabold text-[#0F172A]">{registry.participants.length}<span className="ml-1 text-sm font-bold">명</span></p>
        </div>
        <div className="rounded-lg border border-[#DCE3EA] bg-white p-4">
          <UserCheck className="h-5 w-5 text-[#126B32]" />
          <p className="mt-3 text-xs font-semibold text-[#526174]">서명 완료</p>
          <p className="mt-1 text-2xl font-extrabold text-[#0F172A]">{signedCount}<span className="ml-1 text-sm font-bold">명</span></p>
        </div>
        <div className="rounded-lg border border-[#DCE3EA] bg-white p-4">
          <RefreshCw className="h-5 w-5 text-[#D97706]" />
          <p className="mt-3 text-xs font-semibold text-[#526174]">미서명</p>
          <p className="mt-1 text-2xl font-extrabold text-[#0F172A]">{registry.participants.length - signedCount}<span className="ml-1 text-sm font-bold">명</span></p>
        </div>
      </div>

      <section className="grid gap-6 border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-6 md:grid-cols-[230px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <div ref={qrRef} className="flex items-center justify-center rounded-lg bg-white p-3 ring-1 ring-[#DCE3EA]">
            <QRCodeSVG value={publicUrl} size={190} level="M" includeMargin aria-label="서명 QR 코드" />
          </div>
          <button type="button" disabled={savingQr} onClick={() => void downloadQrImage()} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD] hover:bg-[#EFF6FC] disabled:border-[#C8D0DA] disabled:text-[#94A3B8]">
            {savingQr ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
            {savingQr ? '저장 중' : 'QR 이미지 저장'}
          </button>
          {qrError ? <p role="alert" className="text-[11px] font-semibold text-[#B42318]">{qrError}</p> : null}
        </div>
        <div className="min-w-0 self-center">
          <h2 className="text-lg font-extrabold text-[#0F172A]">참석자 서명 링크</h2>
          <p className="mt-1 text-sm text-[#526174]">QR을 보여주거나 링크를 전송해 서명을 받으세요.</p>
          <div className="mt-5 flex min-w-0 gap-2">
            <input readOnly value={publicUrl} className={`${inputClass} min-w-0 flex-1 text-[#526174]`} aria-label="서명 링크 주소" />
            <button type="button" onClick={() => void copyPublicUrl()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#0F6CBD] text-white hover:bg-[#0B5B9F]" aria-label="서명 링크 복사" title="링크 복사">
              {copied ? <Check className="h-5 w-5" /> : <Clipboard className="h-5 w-5" />}
            </button>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#DCE3EA] text-[#334155] hover:bg-[#F6F8FB]" aria-label="서명 페이지 새 창에서 열기" title="서명 페이지 열기">
              <ExternalLink className="h-5 w-5" />
            </a>
          </div>
          <details className="mt-5 border-t border-[#DCE3EA] pt-4">
            <summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-bold text-[#334155]">공유·보관 설정</summary>
            <div className="mt-3 space-y-3">
            <label className="flex min-h-[44px] items-center gap-3 text-sm font-bold"><input type="checkbox" checked={registry.allowWalkIn} disabled={isMutating || registry.mode==='custom'} onChange={(event)=>void handleUpdate({allowWalkIn:event.target.checked})} />명단 외 참석자 추가 허용</label>
            <div className="flex flex-wrap gap-2"><input type="password" className={`${inputClass} max-w-sm`} value={sharePassword} onChange={(event)=>setSharePassword(event.target.value)} placeholder="새 비밀번호 (비우면 보호 해제)" aria-label="변경할 공개 비밀번호" /><button type="button" disabled={isMutating} onClick={()=>void handleUpdate({publicPassword:sharePassword}).then((saved)=>{ if(saved) setSharePassword(''); })} className="min-h-[44px] rounded-lg border px-4 text-sm font-bold">비밀번호 적용</button><button type="button" disabled={isMutating} onClick={()=>setRotateConfirm(true)} className="min-h-[44px] rounded-lg border px-4 text-sm font-bold">공개 링크 재발급</button></div>
            <label className="flex flex-wrap items-center gap-2 text-sm font-bold">종료 후 보관 기간<select className={`${inputClass} max-w-40`} value={registry.retentionMonths ?? ''} disabled={isMutating} onChange={(event)=>void handleUpdate({retentionMonths:Number(event.target.value)})}><option value="" disabled>기존 업무: 미설정</option>{Array.from(new Set([1,3,12,...(registry.retentionMonths ? [registry.retentionMonths] : [])])).sort((a,b)=>a-b).map((n)=><option key={n} value={n}>{n}개월</option>)}</select></label>
            <button type="button" onClick={()=>void cleanupRegistryUploads(registry.id).then((r)=>setShareNotice(`미참조 파일 ${r.removedCount}개를 정리했습니다. 24시간 이내 업로드는 보존합니다.`)).catch((error)=>setActionError(error instanceof Error ? error.message : '정리하지 못했습니다.'))} className="min-h-[44px] rounded-lg border px-4 text-xs font-bold">실패한 업로드 정리 재시도</button>
            {registry.status === 'closed' ? <button type="button" disabled={isMutating} onClick={() => void previewRegistryPurge(registry.id).then(setPurgeCounts).catch((error) => setActionError(error instanceof Error ? error.message : '파기 대상을 확인하지 못했습니다.'))} className="min-h-[44px] rounded-lg border border-[#FECACA] px-4 text-sm font-bold text-[#B42318]">파기 대상 확인</button> : null}
            {registry.purgeStartedAt ? <p role="alert" className="text-sm text-[#B42318]">파기가 진행 중입니다. 목록에서 대상 수량을 확인하고 파기를 재시도해 주세요.</p> : null}
            </div>
          </details>
          {shareNotice ? <p role="status" className="mt-3 text-sm text-[#126B32]">{shareNotice}</p> : null}
          {registry.publicPassword || registry.isPasswordProtected ? <p className="mt-3 text-xs font-semibold text-[#526174]">비밀번호 보호 사용 중</p> : null}
          {isRegistryDemoMode ? <p className="mt-2 text-xs font-bold text-[#B54708]">로컬 데모 링크는 현재 브라우저에서만 동작하며 다른 기기에는 공유할 수 없습니다.</p> : null}
        </div>
      </section>

      <section className="min-w-0 border-y border-[#DCE3EA] bg-white">
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[#0F172A]">참석자 명단</h2>
            <p className="mt-1 text-xs text-[#526174]">서명 상태를 확인하고 필요한 경우 재서명을 요청할 수 있습니다.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526174]" />
              <input className={`${inputClass} pl-9 sm:w-56`} value={query} onChange={(event) => { setQuery(event.target.value); setParticipantPage(1); }} placeholder="이름 또는 소속 검색" aria-label="참석자 이름 또는 소속 검색" />
            </label>
            <div className="grid grid-cols-3 rounded-lg border border-[#DCE3EA] bg-[#F6F8FB] p-1">
              {(['all', 'signed', 'pending'] as Filter[]).map((option) => (
                <button key={option} type="button" onClick={() => { setFilter(option); setParticipantPage(1); }} aria-pressed={filter === option} className={`min-h-[44px] rounded-md px-3 text-xs font-bold ${filter === option ? 'bg-white text-[#0F6CBD] shadow-sm' : 'text-[#526174]'}`}>
                  {{ all: '전체', signed: '완료', pending: '미서명' }[option]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full min-w-0 max-w-full overflow-x-auto border-t border-[#DCE3EA]">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-[#F6F8FB] text-xs font-bold text-[#334155]">
              <tr>
                <th className="w-16 px-4 py-3 text-center">연번</th>
                <th className="min-w-36 px-4 py-3 text-left">성명</th>
                {registry.columns.map((column) => <th key={column.id} className="min-w-40 px-4 py-3 text-left">{column.label}</th>)}
                <th className="w-28 px-4 py-3 text-center">상태</th>
                <th className="w-36 px-4 py-3 text-left">서명 시각</th>
                <th className="w-24 px-4 py-3 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {visibleParticipants.map((participant) => (
                <tr key={participant.id} className="border-t border-[#EEF1F4]">
                  <td className="px-4 py-3 text-center text-[#526174]">{participant.rowNumber}</td>
                  <td className="px-4 py-3 font-bold text-[#0F172A]">{participant.name}</td>
                  {registry.columns.map((column) => <td key={column.id} className="px-4 py-3 text-[#526174]">{participant.values[column.id] ?? ''}</td>)}
                  <td className="px-4 py-3 text-center"><span className={`rounded-md px-2 py-1 text-xs font-bold ${participant.signature ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EEF1F4] text-[#526174]'}`}>{participant.signature ? '완료' : '미서명'}</span></td>
                  <td className="px-4 py-3 text-xs text-[#526174]">{formatSignedAt(participant.signature?.signedAt) || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {!participant.signature && (participant.requiresCode || participant.verificationCode || registry.participants.some((other)=>other.id!==participant.id && other.name===participant.name)) ? <button type="button" disabled={isMutating} onClick={()=>void issueVerificationCode(registry.id,participant.id).then((code)=>setShareNotice(`${participant.name} 확인 코드: ${code} · 본인에게 직접 안내해 주세요.`)).catch((error)=>setActionError(error instanceof Error ? error.message : '코드를 발급하지 못했습니다.'))} className="min-h-[44px] rounded-lg border px-2 text-xs font-bold" aria-label={`${participant.name} 확인 코드 발급`}>확인 코드</button> : null}
                      {participant.signature ? (
                        <button type="button" onClick={() => setPendingAction({ kind: 'resign', participantId: participant.id, participantName: participant.name })} className="flex h-11 w-11 items-center justify-center rounded-lg text-[#526174] hover:bg-[#EFF6FC] hover:text-[#0F6CBD]" aria-label={`${participant.name} 재서명`} title="재서명">
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button type="button" onClick={() => setPendingAction({ kind: 'delete', participantId: participant.id, participantName: participant.name })} className="flex h-11 w-11 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#FEF2F2] hover:text-[#B42318]" aria-label={`${participant.name} 삭제`} title="참석자 삭제">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleParticipants.length === 0 ? <tr><td colSpan={registry.columns.length + 5} className="px-4 py-12 text-center text-sm text-[#526174]">조건에 맞는 참석자가 없습니다.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <RegistryPagination currentPage={safeParticipantPage} pageSize={PARTICIPANTS_PER_PAGE} totalItems={filteredParticipants.length} onPageChange={setParticipantPage} label="참석자 명단 페이지" />

        <div className="border-t border-[#DCE3EA] bg-[#F8FAFC] px-4 py-5 sm:px-6">
          <h3 className="text-sm font-bold text-[#334155]">참석자 추가</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(140px,1fr)_repeat(var(--registry-columns),minmax(140px,1fr))_auto]" style={{ '--registry-columns': Math.max(1, registry.columns.length) } as React.CSSProperties}>
            <input className={inputClass} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="성명" aria-label="추가할 참석자 성명" />
            {registry.columns.map((column) => <input key={column.id} className={inputClass} value={newValues[column.id] ?? ''} onChange={(event) => setNewValues((current) => ({ ...current, [column.id]: event.target.value }))} placeholder={column.label} aria-label={`추가할 참석자 ${column.label}`} />)}
            <button type="button" disabled={!newName.trim() || isMutating} onClick={() => void handleAddParticipant()} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#334155] px-5 text-sm font-bold text-white hover:bg-[#0F172A] disabled:bg-[#AAB7C4]"><Plus className="h-4 w-4" /> 추가</button>
          </div>
        </div>
      </section>

      <section className="border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[#0F172A]">인쇄 및 내보내기</h2>
            <p className="mt-1 text-xs text-[#526174]">서명 결과가 반영된 등록부를 PDF 또는 엑셀로 저장합니다.</p>
            <div className="mt-4 grid grid-cols-4 rounded-lg border border-[#DCE3EA] bg-[#F6F8FB] p-1">
              {([10, 15, 20, 30] as RegistryLayout[]).map((option) => (
                <button key={option} type="button" disabled={isMutating} onClick={() => { setPrintPage(1); void handleUpdate({ layout: option }); }} aria-pressed={registry.layout === option} className={`min-h-[44px] rounded-md px-3 text-xs font-bold disabled:opacity-50 ${registry.layout === option ? 'bg-white text-[#0F6CBD] shadow-sm' : 'text-[#526174]'}`}>{option <= 15 ? `1단 ${option}` : `2단 ${option}`}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void exportExcel()} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#DCE3EA] px-4 text-sm font-bold text-[#334155] hover:bg-[#F6F8FB]"><FileSpreadsheet className="h-4 w-4" /> 엑셀 다운로드</button>
            <button type="button" disabled={isExporting} onClick={() => void printAll()} className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#DCE3EA] px-4 text-sm font-bold">전체 인쇄</button>
            <button type="button" disabled={isExporting || !plan?.valid} onClick={() => void exportPdf()} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]"><Download className="h-4 w-4" /> {isExporting ? 'PDF 만드는 중' : 'PDF 다운로드'}</button>
          </div>
        </div>

        {plan?.adjusted ? <p className="mt-4 text-sm text-[#526174]">긴 항목을 모두 표시하기 위해 {plan.tableColumns}단 · 한 단 {plan.rowsPerColumn}명으로 배치했습니다.</p> : null}
        {imageLoading ? <p role="status" className="mt-4 text-sm">이 쪽의 서명 이미지를 불러오는 중입니다.</p> : null}
        {Object.values(images).some((p)=>p.imageError) ? <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#B42318]">서명 완료 상태는 유지됩니다. 이미지를 다시 확인해 주세요.<button type="button" onClick={retryImages} className="min-h-[44px] rounded-lg border px-4">서명 이미지 다시 불러오기</button></div> : null}
        <div tabIndex={0} role="region" aria-label="등록부 인쇄 미리보기" className="mt-6 overflow-x-auto rounded-lg bg-[#E8ECF1] p-5">
          {/* 축소 배율과 자리 크기를 registry-print-frame이 함께 정한다. index.css 참고 */}
          <div className={`registry-print-frame mx-auto${renderAllPrintPages ? ' is-exporting' : ''}`}>
            <div ref={printRef} className="registry-print-preview w-max">
              <RegistryPrintSheet onImageError={markImageError} registry={printRegistry ?? registry} pageIndex={renderAllPrintPages ? undefined : safePrintPage - 1} />
            </div>
          </div>
        </div>
        <RegistryPagination currentPage={safePrintPage} pageSize={1} totalItems={printPageCount} onPageChange={setPrintPage} label="인쇄 미리보기 페이지" itemLabel="쪽" showItemRange={false} />
      </section>

      <RegistryBrowserPrint registry={printRegistry ?? registry} />
      {purgeCounts ? <RegistryConfirmDialog title="등록부를 영구 파기할까요?" description={`참석자 ${purgeCounts.recordCount}명 · 서명 ${purgeCounts.signatureCount}건 · 서명 파일 ${purgeCounts.fileCount}개를 파기합니다. 되돌릴 수 없고 기존 링크와 QR도 사용할 수 없습니다.`} confirmLabel={isMutating ? '파기 중' : '영구 파기'} onCancel={() => { if (!isMutating) setPurgeCounts(null); }} onConfirm={() => { if (isMutating) return; setIsMutating(true); void deleteRegistry(registry.id, purgeCounts).then(() => navigate('/tools/registry-sign')).catch((error) => setActionError(error instanceof Error ? error.message : '파기하지 못했습니다.')).finally(() => setIsMutating(false)); }} /> : null}
      {rotateConfirm ? <RegistryConfirmDialog title="공개 링크를 재발급할까요?" description="기존 링크와 QR은 사용할 수 없게 됩니다. 새 링크와 QR을 다시 안내해 주세요." confirmLabel="링크 재발급" tone="primary" onCancel={()=>{if(!isMutating)setRotateConfirm(false);}} onConfirm={()=>{setIsMutating(true);void rotateRegistryToken(registry.id).then(()=>setRotateConfirm(false)).catch((error)=>setActionError(error instanceof Error ? error.message : '재발급하지 못했습니다.')).finally(()=>setIsMutating(false));}} /> : null}
      {pendingAction ? (
        <RegistryConfirmDialog
          title={pendingAction.kind === 'resign' ? '서명을 다시 받을까요?' : '참석자를 삭제할까요?'}
          description={pendingAction.kind === 'resign'
            ? `${pendingAction.participantName}님의 기존 서명이 삭제되고 공개 페이지에서 다시 서명할 수 있습니다.`
            : `${pendingAction.participantName}님의 정보와 서명이 명단에서 삭제됩니다.`}
          confirmLabel={isMutating ? '처리 중' : pendingAction.kind === 'resign' ? '재서명 요청' : '참석자 삭제'}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void handleParticipantAction()}
        />
      ) : null}
    </div>
  );
}
