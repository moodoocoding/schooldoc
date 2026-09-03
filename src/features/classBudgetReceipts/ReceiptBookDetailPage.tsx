import { useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  CircleDollarSign,
  ExternalLink,
  FileText,
  FileUp,
  LoaderCircle,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  ScanLine,
  Trash2,
  TriangleAlert,
  WalletCards,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { analyzeReceiptFile } from './receiptOcr';
import { classBudgetReceiptsOwnerId } from './classBudgetReceiptsConfig';
import {
  addReceiptEntry,
  discardReceiptFile,
  editReceiptEntry,
  restoreReceiptEntry,
  saveLocalReceiptFileAnalysis,
  trashReceiptEntry,
  uploadLocalReceiptFiles,
} from './receiptBookStore';
import {
  activeReceiptEntries,
  calculateReceiptBookSummary,
  formatWon,
  isReceiptEntryRestorable,
  localDateValue,
  receiptEntryRestoreLabel,
  trashedReceiptEntries,
} from './receiptBookUtils';
import type { ReceiptEntry, ReceiptFile } from './types';
import { useReceiptBook } from './useReceiptBooks';

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const digitsOnly = (value: string) => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
const fileSize = (bytes: number) => bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1000))}KB`;
const spentAtLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('ko-KR');

export function ReceiptBookDetailPage() {
  const navigate = useNavigate();
  const { bookId = '' } = useParams();
  const { user } = useTeacherAuth();
  const ownerId = classBudgetReceiptsOwnerId(user?.id);
  const book = useReceiptBook(ownerId, bookId);
  const entrySectionRef = useRef<HTMLElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const merchantInputRef = useRef<HTMLInputElement>(null);
  const purposeInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [spentAt, setSpentAt] = useState(localDateValue);
  const [merchant, setMerchant] = useState('');
  const [purpose, setPurpose] = useState('');
  const [amountText, setAmountText] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [reviewingFileId, setReviewingFileId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lastTrashedId, setLastTrashedId] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<Record<string, string>>({});
  const [reanalyzeFileId, setReanalyzeFileId] = useState<string | null>(null);

  if (!book) return <div className="mx-auto max-w-xl border-y border-[#DCE3EA] bg-white py-20 text-center"><h1 className="text-xl font-bold">학급 운영비 장부를 찾을 수 없습니다</h1><button type="button" onClick={() => navigate('/tools/receipts')} className="mt-5 min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD]">장부 목록으로</button></div>;

  const summary = calculateReceiptBookSummary(book);
  const entries = activeReceiptEntries(book);
  const trashedEntries = trashedReceiptEntries(book);
  const availableFiles = book.files.filter((file) => file.status === 'uploaded');
  const unlinkedFiles = availableFiles.filter((file) => file.linkedEntryIds.length === 0);
  const reviewingFile = availableFiles.find((file) => file.id === reviewingFileId) ?? null;

  const resetForm = () => {
    setSpentAt(localDateValue()); setMerchant(''); setPurpose(''); setAmountText('');
    setSelectedFileIds([]); setReviewingFileId(null); setEditingId(null);
  };

  const reviewFile = (file: ReceiptFile) => {
    setSelectedFileIds([file.id]); setReviewingFileId(file.id); setEditingId(null);
    setSpentAt(file.analysis?.spentAt ?? ''); setMerchant(file.analysis?.merchant ?? '');
    setAmountText(file.analysis?.amount ? String(file.analysis.amount) : ''); setPurpose('');
    setError(''); setNotice(file.analysis ? '자동 분석값을 불러왔습니다. 원본과 비교한 뒤 사용 목적을 입력해 주세요.' : '원본 영수증을 보며 값을 입력해 주세요.');
    requestAnimationFrame(() => {
      entrySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const target = !file.analysis?.spentAt ? dateInputRef.current : !file.analysis.merchant ? merchantInputRef.current : !file.analysis.amount ? amountInputRef.current : purposeInputRef.current;
      target?.focus({ preventScroll: true });
    });
  };

  const analyze = async (storedFile: ReceiptFile, sourceFile: File) => {
    setAnalysisProgress((current) => ({ ...current, [storedFile.id]: '자동 분석 준비 중' }));
    try {
      const draft = await analyzeReceiptFile(sourceFile, (progress) => setAnalysisProgress((current) => ({ ...current, [storedFile.id]: progress.label })));
      saveLocalReceiptFileAnalysis(ownerId, book.id, storedFile.id, draft);
      const analyzed = { ...storedFile, analysisStatus: 'ready' as const, analysis: draft };
      reviewFile(analyzed);
      return analyzed;
    } catch {
      saveLocalReceiptFileAnalysis(ownerId, book.id, storedFile.id, null);
      setError(`${storedFile.originalName}을 자동으로 읽지 못했습니다. 원본을 보며 직접 입력할 수 있습니다.`);
      const failed = { ...storedFile, analysisStatus: 'failed' as const, analysis: null };
      reviewFile(failed);
      return failed;
    } finally {
      setAnalysisProgress((current) => { const next = { ...current }; delete next[storedFile.id]; return next; });
    }
  };

  const handleFiles = async (files: File[]) => {
    if (!files.length || uploading) return;
    setUploading(true); setError(''); setNotice('');
    try {
      if (reanalyzeFileId) {
        const stored = availableFiles.find((file) => file.id === reanalyzeFileId);
        setReanalyzeFileId(null);
        if (stored) await analyze(stored, files[0]);
        return;
      }
      if (files.length > 10 || files.some((file) => file.size > 20 * 1024 * 1024 || !ACCEPT.includes(file.type))) throw new Error('JPG·PNG·WebP·PDF 파일을 한 번에 10개, 파일당 20MB까지 올릴 수 있습니다.');
      const storedFiles = await uploadLocalReceiptFiles(ownerId, book.id, files);
      setNotice('파일을 올렸습니다. 자동 분석하고 있습니다.');
      for (const [index, stored] of storedFiles.entries()) await analyze(stored, files[index]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '영수증 파일을 처리하지 못했습니다.');
    } finally {
      setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const submitEntry = (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (!spentAt) { setError('사용 날짜를 선택해 주세요.'); dateInputRef.current?.focus(); return; }
    if (!merchant.trim()) { setError('사용처를 입력해 주세요.'); merchantInputRef.current?.focus(); return; }
    if (!purpose.trim()) { setError('사용 목적을 입력해 주세요.'); purposeInputRef.current?.focus(); return; }
    if (Number(amountText) < 1) { setError('금액을 1원 이상 입력해 주세요.'); amountInputRef.current?.focus(); return; }
    const input = { spentAt, merchant: merchant.trim(), purpose: purpose.trim(), amount: Number(amountText), evidenceFileIds: selectedFileIds };
    if (editingId) { editReceiptEntry(ownerId, book.id, editingId, input); setNotice('지출 내용을 수정했습니다.'); }
    else { addReceiptEntry(ownerId, book.id, input); setNotice('지출 1건을 장부에 반영했습니다.'); }
    setLastTrashedId(null); resetForm();
  };

  const startEdit = (entry: ReceiptEntry) => {
    setSpentAt(entry.spentAt); setMerchant(entry.merchant); setPurpose(entry.purpose); setAmountText(String(entry.amount));
    setSelectedFileIds(entry.evidenceFileIds); setReviewingFileId(null); setEditingId(entry.id); setError('');
    entrySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const moveToTrash = (entry: ReceiptEntry) => {
    trashReceiptEntry(ownerId, book.id, entry.id); setLastTrashedId(entry.id);
    setNotice(`${entry.merchant} ${formatWon(entry.amount)} 지출을 휴지통으로 옮겼습니다.`);
  };

  return <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
    <div className="flex items-center justify-between gap-3 border-b border-[#DCE3EA] pb-4"><button type="button" onClick={() => navigate('/tools/receipts')} className="inline-flex min-h-[44px] items-center gap-2 px-2 text-sm font-semibold text-[#334155]"><ArrowLeft className="h-5 w-5" />장부 목록</button><span className="rounded-md border border-[#DCE3EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#526174]">개발용 브라우저 임시 저장</span></div>
    <header><p className="text-xs font-bold text-[#0F6CBD]">{book.schoolYear}학년도 · {book.classLabel}</p><h1 className="mt-1 break-words text-2xl font-extrabold sm:text-3xl">{book.title}</h1></header>
    <section aria-label="예산 현황" className="grid grid-cols-2 border-y border-[#DCE3EA] bg-white sm:grid-cols-4">
      {[['전체 예산', book.totalBudget], ['사용 금액', summary.usedAmount], [summary.remainingAmount < 0 ? '초과 금액' : '남은 금액', Math.abs(summary.remainingAmount)], ['지출 건수', summary.entryCount]].map(([label, value], index) => <div key={String(label)} className="border-b border-r border-[#EEF1F4] px-4 py-5 sm:border-b-0"><p className="text-xs font-semibold text-[#64748B]">{label}</p><p className={`mt-1 text-lg font-extrabold tabular-nums ${index === 2 ? 'text-[#126B32]' : ''}`}>{index === 3 ? `${value}건` : formatWon(Number(value))}</p></div>)}
    </section>
    {notice ? <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-[#16803C] bg-[#E6F4EA] px-4 py-3 text-sm font-semibold text-[#126B32]"><span>{notice}</span>{lastTrashedId ? <button type="button" onClick={() => { restoreReceiptEntry(ownerId, book.id, lastTrashedId); setLastTrashedId(null); setNotice('지출을 복원했습니다.'); }} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#16803C] bg-white px-3 text-xs font-bold"><RotateCcw className="h-3.5 w-3.5" />실행 취소</button> : null}</div> : null}
    {error ? <p role="alert" className="border-l-2 border-[#B42318] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]">{error}</p> : null}

    <section aria-labelledby="receipt-files-heading" className="border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#0F6CBD]" /><div><h2 id="receipt-files-heading" className="text-lg font-bold">영수증 파일 올리기</h2><p className="mt-1 text-xs leading-5 text-[#526174]">파일을 올리면 날짜·사용처·결제금액을 바로 읽습니다.</p></div></div>
        <input ref={fileInputRef} type="file" multiple={!reanalyzeFileId} accept={ACCEPT} aria-label="영수증 증빙 파일" className="sr-only" onChange={(event) => void handleFiles(Array.from(event.target.files ?? []))} />
        {unlinkedFiles.length === 0 ? <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border border-[#0F6CBD] px-4 text-sm font-bold text-[#0F6CBD] disabled:text-[#64748B]">{uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}{uploading ? '자동 분석 중' : '영수증 파일 선택'}</button> : null}
      </div>
      {book.files.length === 0 ? <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-5 flex min-h-32 w-full flex-col items-center justify-center border-y border-dashed border-[#C8D0DA] bg-[#F8FAFC] text-sm font-bold text-[#0F6CBD]"><FileUp className="mb-2 h-6 w-6" />사진 또는 PDF 선택</button> : <ul className="mt-5 divide-y divide-[#EEF1F4] border-y border-[#DCE3EA]">{book.files.map((file) => {
        const progress = analysisProgress[file.id];
        const analysisIsPlausible = Boolean(file.analysis)
          && (file.analysis?.amount === null || file.analysis!.amount <= Math.max(book.totalBudget * 2, 5_000_000));
        const selectForAnalysis = () => { setReanalyzeFileId(file.id); requestAnimationFrame(() => fileInputRef.current?.click()); };
        return <li key={file.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="break-words text-sm font-bold">{file.originalName}</p><p className="mt-1 text-xs text-[#64748B]">{fileSize(file.sizeBytes)} · {progress ?? (analysisIsPlausible ? '자동 분석 완료' : file.analysis ? '자동 분석값 재확인 필요' : file.analysisStatus === 'failed' ? '자동 분석 실패' : file.analysisStatus === 'analyzing' ? '자동 분석 중' : '분석 전')}</p>{analysisIsPlausible && file.analysis ? <p className="mt-1 text-xs font-semibold text-[#126B32]">{file.analysis.spentAt || '날짜 미확인'} · {file.analysis.merchant || '사용처 미확인'} · {file.analysis.amount ? formatWon(file.analysis.amount) : '금액 미확인'}</p> : null}</div><div className="flex shrink-0 flex-wrap items-center gap-2">{file.previewUrl ? <a href={file.previewUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-bold text-[#0F6CBD]"><ExternalLink className="h-3.5 w-3.5" />원본 보기</a> : null}{!progress && file.linkedEntryIds.length === 0 ? analysisIsPlausible ? <button type="button" onClick={() => reviewFile(file)} className="min-h-[40px] rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD]">결과 수정</button> : <button type="button" onClick={selectForAnalysis} className="min-h-[40px] rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD]">원본 다시 선택해 분석</button> : null}<button type="button" disabled={file.linkedEntryIds.length > 0 || uploading} onClick={() => discardReceiptFile(ownerId, book.id, file.id)} className="min-h-[40px] px-3 text-xs font-bold text-[#B42318] disabled:text-[#94A3B8]">삭제</button></div></li>;
      })}</ul>}
    </section>

    {reviewingFileId || editingId || unlinkedFiles.length === 0 ? <section ref={entrySectionRef} aria-labelledby="entry-heading" className="scroll-mt-6 border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-6">
      <div className="flex items-start gap-3"><CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-[#0F6CBD]" /><div><h2 id="entry-heading" className="text-lg font-bold">{editingId ? '지출 내용 수정' : '분석 결과 확인·수정'}</h2><p className="mt-1 text-xs text-[#526174]">자동 입력값을 원본과 비교하고 사용 목적을 적어 주세요.</p></div></div>
      {reviewingFile?.analysis ? <div className="mt-4 flex items-start gap-2 border-l-2 border-[#16803C] bg-[#E6F4EA] px-4 py-3 text-xs text-[#126B32]"><ScanLine className="h-4 w-4 shrink-0" /><span><strong>자동 분석 완료 · 신뢰도 {Math.round(reviewingFile.analysis.confidence * 100)}%</strong>{reviewingFile.analysis.warnings.length ? ` · ${reviewingFile.analysis.warnings.join(' ')}` : ''}</span></div> : reviewingFile?.analysisStatus === 'failed' ? <p className="mt-4 flex items-start gap-2 border-l-2 border-[#E6A700] bg-[#FFF9ED] px-4 py-3 text-xs text-[#76520E]"><TriangleAlert className="h-4 w-4 shrink-0" />자동으로 읽지 못했습니다. 직접 입력해 주세요.</p> : null}
      <form noValidate onSubmit={submitEntry} className="mt-5 grid gap-4 md:grid-cols-[170px_1fr_1.4fr_180px]">
        <label><span className="mb-2 block text-xs font-bold">사용 날짜</span><input ref={dateInputRef} type="date" value={spentAt} onChange={(event) => setSpentAt(event.target.value)} className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3" /></label>
        <label><span className="mb-2 block text-xs font-bold">사용처</span><input ref={merchantInputRef} value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="예: 중앙문구" className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3" /></label>
        <label><span className="mb-2 block text-xs font-bold">사용 목적</span><input ref={purposeInputRef} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="예: 미술 활동 재료" className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3" /></label>
        <label><span className="mb-2 block text-xs font-bold">금액</span><span className="flex items-center rounded-lg border border-[#C8D0DA]"><input ref={amountInputRef} inputMode="numeric" value={amountText} onChange={(event) => setAmountText(digitsOnly(event.target.value))} className="min-h-[42px] min-w-0 flex-1 px-3 text-right font-bold outline-none" /><span className="pr-3 text-xs font-bold text-[#526174]">원</span></span></label>
        {availableFiles.length ? <fieldset className="md:col-span-4"><legend className="text-xs font-bold">증빙 파일 <span className="font-normal text-[#64748B]">({selectedFileIds.length}개 선택)</span></legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{availableFiles.map((file) => <label key={file.id} className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-lg border border-[#DCE3EA] px-3 text-xs font-semibold"><input type="checkbox" checked={selectedFileIds.includes(file.id)} onChange={(event) => setSelectedFileIds((current) => event.target.checked ? [...new Set([...current, file.id])] : current.filter((id) => id !== file.id))} /><Paperclip className="h-3.5 w-3.5 shrink-0 text-[#0F6CBD]" /><span className="truncate">{file.originalName}</span></label>)}</div></fieldset> : null}
        <div className="flex justify-end gap-2 md:col-span-4">{editingId ? <button type="button" onClick={resetForm} className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-4 text-sm font-bold">수정 취소</button> : null}<button type="submit" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white"><Plus className="h-4 w-4" />{editingId ? '지출 수정 완료' : '이 지출을 장부에 반영'}</button></div>
      </form>
    </section> : null}

    <section aria-labelledby="entries-heading"><div className="flex items-end justify-between"><h2 id="entries-heading" className="text-lg font-bold">장부에 반영된 지출</h2><span className="text-xs font-bold text-[#526174]">전체 {entries.length}건</span></div>{entries.length === 0 ? <div className="mt-4 border-y border-[#DCE3EA] bg-white py-14 text-center"><WalletCards className="mx-auto h-8 w-8 text-[#94A3B8]" /><p className="mt-3 text-sm font-bold">아직 반영된 지출이 없습니다</p></div> : <ul className="mt-4 divide-y divide-[#EEF1F4] border-y border-[#DCE3EA] bg-white">{entries.map((entry) => <li key={entry.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-bold">{entry.merchant}</p><p className="mt-1 text-xs text-[#526174]">{spentAtLabel(entry.spentAt)} · {entry.purpose}{entry.evidenceFileIds.length ? ` · 증빙 ${entry.evidenceFileIds.length}개` : ''}</p></div><p className="font-extrabold tabular-nums">{formatWon(entry.amount)}</p><div className="flex gap-1"><button type="button" onClick={() => startEdit(entry)} aria-label={`${entry.merchant} ${formatWon(entry.amount)} 지출 수정`} className="flex h-10 w-10 items-center justify-center"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => moveToTrash(entry)} aria-label={`${entry.merchant} ${formatWon(entry.amount)} 지출을 휴지통으로 이동`} className="flex h-10 w-10 items-center justify-center text-[#B42318]"><Trash2 className="h-4 w-4" /></button></div></li>)}</ul>}</section>

    {summary.trashedCount ? <section className="border-y border-[#DCE3EA] bg-[#F8FAFC] px-4 py-5"><button type="button" onClick={() => setShowTrash((value) => !value)} className="text-sm font-bold">휴지통 {summary.trashedCount}건</button>{showTrash ? <ul className="mt-3 divide-y">{trashedEntries.map((entry) => <li key={entry.id} className="flex items-center justify-between py-3 text-sm"><span>{entry.merchant} · {formatWon(entry.amount)} · {receiptEntryRestoreLabel(entry)}까지</span><button type="button" disabled={!isReceiptEntryRestorable(entry)} onClick={() => restoreReceiptEntry(ownerId, book.id, entry.id)} className="min-h-[40px] rounded-lg border px-3 font-bold">복원</button></li>)}</ul> : null}</section> : null}
  </div>;
}
