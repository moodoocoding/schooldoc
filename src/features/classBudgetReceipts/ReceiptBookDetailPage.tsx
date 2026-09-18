import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { classBudgetReceiptsOwnerId } from './classBudgetReceiptsConfig';
import { addReceiptEntry, discardReceiptFile, editReceiptEntry, restoreReceiptEntry, saveLocalReceiptFileAnalysis, trashReceiptEntry, uploadLocalReceiptFiles } from './receiptBookStore';
import { activeReceiptEntries, calculateReceiptBookSummary, formatWon, isReceiptEntryRestorable, localDateValue, trashedReceiptEntries } from './receiptBookUtils';
import { AI_FILE_LIMIT, analyzeReceiptWithAi, RECEIPT_ACCEPT } from './receiptAi';
import { deleteReceiptOriginal, getReceiptOriginal, putReceiptOriginal } from './receiptOriginalStore';
import { ReceiptOriginal, ReceiptThumbnail } from './ReceiptOriginal';
import { ReceiptViewer } from './ReceiptViewer';
import type { ReceiptEntry, ReceiptFile } from './types';
import { useReceiptBook } from './useReceiptBooks';

const candidates = (f: ReceiptFile) => f.analysisCandidates.length ? f.analysisCandidates : f.analysis ? [f.analysis] : [];
interface Form { spentAt: string; merchant: string; purpose: string; amount: string; }
interface Selection { fileId?: string; index?: number; entryId?: string; evidenceFileIds: string[]; }
const blank = (): Form => ({ spentAt: localDateValue(), merchant: '', purpose: '', amount: '' });
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] bg-white px-4 text-sm font-semibold disabled:opacity-50';
const primary = button.replace('border-[#C8D0DA]', 'border-[#0F6CBD]').replace('bg-white', 'bg-[#0F6CBD]') + ' text-white';
const field = 'mt-1 min-h-11 w-full rounded-lg border border-[#C8D0DA] bg-white px-3 py-2 text-sm';

export function ReceiptBookDetailPage() {
  const { bookId = '' } = useParams();
  const { user } = useTeacherAuth();
  const ownerId = classBudgetReceiptsOwnerId(user?.id);
  return <ReceiptBookDetail key={ownerId + ':' + bookId} ownerId={ownerId} bookId={bookId} />;
}

function ReceiptBookDetail({ ownerId, bookId }: { ownerId: string; bookId: string }) {
  const navigate = useNavigate();
  const { user, signIn } = useTeacherAuth();
  const book = useReceiptBook(ownerId, bookId);
  const [adding, setAdding] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [viewFileId, setViewFileId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ fileId: string; page?: number | null } | null>(null);
  const [visibleFileCount, setVisibleFileCount] = useState(6);
  const [originalVersion, setOriginalVersion] = useState(0);
  const version = useRef(0);
  const busyRef = useRef(false);
  const active = useRef(true);
  const requestController = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; version.current += 1; requestController.current?.abort(); };
  }, []);
  const fileInput = useRef<HTMLInputElement>(null);
  const replacementInput = useRef<HTMLInputElement>(null);
  const workArea = useRef<HTMLElement>(null);
  const draftKey = (s: Selection) => ['schooldoc-receipt-form', ownerId, bookId, s.entryId ?? (s.fileId ? s.fileId + ':' + (s.index ?? 0) : 'manual')].join(':');
  const focusWork = () => requestAnimationFrame(() => workArea.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const openForm = (s: Selection, values: Form) => {
    version.current += 1;
    let saved: Form | null = null;
    try {
      const parsed = JSON.parse(localStorage.getItem(draftKey(s)) ?? 'null');
      if (parsed && ['spentAt', 'merchant', 'purpose', 'amount'].every(k => typeof parsed[k] === 'string')) saved = parsed;
    } catch { /* corrupted draft must not block review */ }
    setSelection(s); setForm(saved ?? values); setViewFileId(s.fileId ?? s.evidenceFileIds[0] ?? null); setAdding(true); setError(''); focusWork();
  };
  const closeWork = () => { version.current += 1; setSelection(null); setViewFileId(null); setAdding(false); };
  const change = (key: keyof Form, value: string) => {
    const next = { ...form, [key]: value }; setForm(next);
    if (selection) try { localStorage.setItem(draftKey(selection), JSON.stringify(next)); } catch { setError('수정 내용을 임시 저장하지 못했습니다. 화면을 닫지 말고 저장 공간을 확인해 주세요.'); }
  };
  const remaining = (f: ReceiptFile) => {
    const rows = candidates(f);
    if (!rows.length) return f.linkedEntryIds.length ? [] : [0];
    const legacyCount = book?.entries.filter(e => f.linkedEntryIds.includes(e.id) && !e.analysisCandidateKey).length ?? 0;
    return rows.map((_, i) => i).filter(i => !book?.entries.some(e => e.analysisCandidateKey === f.id + ':' + i)
      && i >= legacyCount);
  };
  const review = (f: ReceiptFile, index = remaining(f)[0] ?? 0) => {
    const row = candidates(f)[index];
    openForm({ fileId: f.id, index, evidenceFileIds: [f.id] }, { spentAt: row?.spentAt ?? '', merchant: row?.merchant ?? '', amount: row?.amount ? String(row.amount) : '', purpose: '' });
  };
  const edit = (entry: ReceiptEntry) => openForm({ entryId: entry.id, evidenceFileIds: entry.evidenceFileIds }, { spentAt: entry.spentAt, merchant: entry.merchant, purpose: entry.purpose, amount: String(entry.amount) });
  const analyze = async (stored: ReceiptFile, file: File): Promise<ReceiptFile> => {
    try {
      requestController.current = new AbortController();
      const rows = await analyzeReceiptWithAi(file, requestController.current.signal);
      saveLocalReceiptFileAnalysis(ownerId, bookId, stored.id, rows);
      return { ...stored, analysisStatus: 'ready', analysis: rows[0], analysisCandidates: rows };
    } catch (e) {
      const message = e instanceof Error ? e.message : '자동 분석에 실패했습니다.';
      saveLocalReceiptFileAnalysis(ownerId, bookId, stored.id, null, message);
      throw new Error(message);
    }
  };
  const upload = async (files: File[]) => {
    if (!files.length || busyRef.current) return;
    if (!consent) { setError('OpenAI 전송 안내를 확인해 주세요.'); return; }
    if (files.length > 10 || files.some(f => f.size > AI_FILE_LIMIT || !RECEIPT_ACCEPT.split(',').includes(f.type))) { setError('JPG·PNG·WebP·PDF 파일을 한 번에 10개, 파일당 10MB까지 올릴 수 있습니다.'); return; }
    busyRef.current = true; setBusy(true); setError(''); const startVersion = version.current;
    try {
      const stored = await uploadLocalReceiptFiles(ownerId, bookId, files);
      let opened = false;
      for (const [i, item] of stored.entries()) {
        if (!active.current) break;
        setProgress('OpenAI 분석 중 ' + (i + 1) + '/' + stored.length);
        try {
          const result = await analyze(item, files[i]);
          if (active.current && !opened && startVersion === version.current) { review(result, 0); opened = true; }
        } catch (e) { setError(e instanceof Error ? e.message : '분석에 실패했습니다.'); }
      }
      setNotice('원본을 보관했습니다. 분석 결과를 확인해 장부에 반영해 주세요.');
    } catch (e) { setError(e instanceof Error ? e.message : '파일을 등록하지 못했습니다.'); }
    finally { busyRef.current = false; setBusy(false); setProgress(''); if (fileInput.current) fileInput.current.value = ''; }
  };
  const retry = async (f: ReceiptFile) => {
    if (busyRef.current) return;
    if (!consent) { setAdding(true); setError('재분석 전 OpenAI 전송 안내를 확인해 주세요.'); return; }
    busyRef.current = true; setBusy(true); setProgress('OpenAI 재분석 중'); const startVersion = version.current;
    try {
      let original = await getReceiptOriginal(ownerId, bookId, f.id);
      if (!original && /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/.test(f.previewUrl)) original = new File([await (await fetch(f.previewUrl)).blob()], f.originalName, { type: f.mimeType });
      if (!original) throw new Error('원본을 먼저 다시 연결해 주세요.');
      const result = await analyze(f, original);
      if (active.current && version.current === startVersion) review(result, 0);
    } catch (e) { setError(e instanceof Error ? e.message : '재분석하지 못했습니다.'); }
    finally { busyRef.current = false; setBusy(false); setProgress(''); }
  };
  const submitting = useRef(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!selection) return;
    if (submitting.current) return;
    submitting.current = true;
    try {
      const values = { spentAt: form.spentAt, merchant: form.merchant.trim(), purpose: form.purpose.trim(), amount: Number(form.amount), evidenceFileIds: selection.evidenceFileIds,
        ...(selection.fileId ? { analysisCandidateKey: selection.fileId + ':' + (selection.index ?? 0) } : {}) };
      const save = () => selection.entryId ? editReceiptEntry(ownerId, bookId, selection.entryId, values) : addReceiptEntry(ownerId, bookId, values);
      if (navigator.locks) await navigator.locks.request('receipt-write:' + ownerId + ':' + bookId, save); else save();
      try { localStorage.removeItem(draftKey(selection)); } catch { /* entry already saved */ }
      setNotice(selection.entryId ? '지출 내용을 수정했습니다.' : '지출을 장부에 반영했습니다.'); setError(''); closeWork();
    } catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했습니다.'); }
    finally { submitting.current = false; }
  };
  const attachOriginal = async (source?: File) => {
    if (!source || !viewFileId) return;
    try {
      const metadata = book?.files.find(f => f.id === viewFileId);
      if (!metadata || source.type !== metadata.mimeType || source.size > 20 * 1024 * 1024) throw new Error('기존과 같은 형식의 원본 파일을 선택해 주세요(20MB 이하).');
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await source.arrayBuffer()))).map(b => b.toString(16).padStart(2, '0')).join('');
      if (metadata.sha256 && hash !== metadata.sha256) throw new Error('등록했던 원본과 다른 파일입니다. 같은 파일을 선택해 주세요.');
      await putReceiptOriginal(ownerId, bookId, viewFileId, source); setOriginalVersion(v => v + 1); setNotice('원본을 다시 연결했습니다.'); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '원본을 연결하지 못했습니다.'); }
    finally { if (replacementInput.current) replacementInput.current.value = ''; }
  };
  const discard = async (f: ReceiptFile) => {
    try { discardReceiptFile(ownerId, bookId, f.id); await deleteReceiptOriginal(ownerId, bookId, f.id); if (viewFileId === f.id) closeWork(); }
    catch (e) { setError(e instanceof Error ? e.message : '삭제하지 못했습니다.'); }
  };
  if (!book || book.ownerId !== ownerId) return <p>장부를 찾을 수 없습니다. <button onClick={() => navigate('/tools/receipts')}>목록으로</button></p>;
  const entries = activeReceiptEntries(book).slice().reverse();
  const summary = calculateReceiptBookSummary(book);
  const pendingFiles = book.files.filter(f => remaining(f).length > 0);
  const shown = book.files.find(f => f.id === viewFileId);
  const selectedFile = book.files.find(f => f.id === selection?.fileId);
  const selectedAnalysis = selectedFile ? candidates(selectedFile)[selection?.index ?? 0] : undefined;
  const previewEntry = (entry: ReceiptEntry) => {
    const fileId = entry.evidenceFileIds[0];
    const file = book.files.find(f => f.id === fileId);
    const candidateIndex = entry.analysisCandidateKey?.startsWith(fileId + ':') ? Number(entry.analysisCandidateKey.slice(fileId.length + 1)) : 0;
    setViewer({ fileId, page: file ? candidates(file)[candidateIndex]?.page : 1 });
  };
  return <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
    <button className={button} onClick={() => navigate('/tools/receipts')}><ArrowLeft className="h-4 w-4" />장부 목록</button>
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-[#526174]">{book.schoolYear}학년도 · {book.classLabel}</p><h1 className="mt-1 break-words text-2xl font-bold">{book.title}</h1></div><button disabled={busy} className={primary} onClick={() => { setAdding(true); focusWork(); }}><Plus className="h-4 w-4" />영수증 등록</button></header>
    <p className="text-xs text-[#526174]">장부와 원본은 이 브라우저에 저장됩니다. 다른 기기와 동기화되지 않으며 브라우저 데이터를 지우면 사라집니다.</p>
    <section aria-label="예산 현황" className="grid grid-cols-1 divide-y rounded-xl border border-[#DCE3EA] bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">{[['전체 예산', book.totalBudget], ['사용 금액', summary.usedAmount], [summary.remainingAmount < 0 ? '초과 금액' : '남은 금액', Math.abs(summary.remainingAmount)]].map(([label, amount]) => <div key={label} className="px-5 py-4"><p className="text-sm text-[#526174]">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{formatWon(Number(amount))}</p></div>)}</section>
    {notice ? <p role="status" className="text-sm text-[#126B32]">{notice}</p> : null}
    {error ? <p role="alert" className="rounded-lg bg-[#FEF2F2] p-3 text-sm text-[#B42318]">{error}</p> : null}
    <section aria-labelledby="ledger-heading" className="rounded-xl border border-[#DCE3EA] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><h2 id="ledger-heading" className="text-lg font-bold">지출 내역 <span className="text-sm font-normal text-[#526174]">{entries.length}건</span></h2><button className={button} onClick={() => openForm({ evidenceFileIds: [] }, blank())}>직접 입력</button></div>
      <div tabIndex={0} role="region" aria-label="지출 내역 표 가로 스크롤" className="overflow-x-auto overflow-y-hidden"><table className="w-full min-w-[660px] text-left text-sm"><thead className="border-y border-[#DCE3EA] bg-[#F8FAFC]"><tr>{['번호', '날짜', '사용처', '사용 내용', '금액', '영수증'].map(h => <th key={h} scope="col" className={'px-4 py-3 font-semibold ' + (h === '금액' ? 'text-right' : '')}>{h}</th>)}</tr></thead><tbody>{entries.length ? entries.map((entry, i) => <tr key={entry.id} className="border-b border-[#EEF1F4] hover:bg-[#F8FAFC]"><td className="px-4 py-3">{i + 1}</td><td className="whitespace-nowrap px-4 py-3 tabular-nums">{entry.spentAt}</td><td className="max-w-52 break-words px-4"><button aria-label={entry.merchant + ' 지출 수정'} className="min-h-11 text-left font-semibold text-[#0F6CBD] underline-offset-4 hover:underline" onClick={() => edit(entry)}>{entry.merchant}</button></td><td className="max-w-64 break-words px-4 py-3">{entry.purpose}</td><td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{formatWon(entry.amount)}</td><td className="px-4 py-2">{entry.evidenceFileIds.length ? <button className={button} aria-label={entry.merchant + ' 영수증 미리보기'} onClick={() => previewEntry(entry)}>영수증 보기</button> : <span className="text-[#526174]">없음</span>}</td></tr>) : <tr><td colSpan={6} className="px-5 py-10 text-center text-[#526174]">등록한 지출이 없습니다. 영수증을 올리면 자동으로 분석합니다.</td></tr>}</tbody><tfoot><tr className="bg-[#F8FAFC]"><th colSpan={4} scope="row" className="px-4 py-4">합계</th><td className="whitespace-nowrap px-4 text-right font-bold tabular-nums">{formatWon(summary.usedAmount)}</td><td /></tr></tfoot></table></div>
    </section>
    {book.files.length ? <section aria-labelledby="receipt-gallery-heading" className="rounded-xl border border-[#DCE3EA] bg-white p-4 sm:p-5">
      <h2 id="receipt-gallery-heading" className="mb-3 text-lg font-bold">등록한 영수증 <span className="text-sm font-normal text-[#526174]">{book.files.length}개</span></h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{book.files.slice(0, visibleFileCount).map(f => <li key={f.id} className="min-w-0">
        <button type="button" aria-label={f.originalName + ' 원본 보기'} onClick={() => setViewer({ fileId: f.id })} className="w-full rounded-xl border border-[#DCE3EA] p-2 text-left hover:border-[#0F6CBD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD]">
          <ReceiptThumbnail ownerId={ownerId} bookId={bookId} file={f} />
          <span className="mt-2 block break-all text-xs font-semibold">{f.originalName}</span>
          <span className="mt-1 block text-xs text-[#0F6CBD]">원본 보기</span>
        </button>
      </li>)}</ul>
      {book.files.length > visibleFileCount ? <button type="button" className={button + ' mt-3'} onClick={() => setVisibleFileCount(count => count + 6)}>영수증 더 보기 ({book.files.length - visibleFileCount}개)</button> : null}
    </section> : null}
    {viewer ? <ReceiptViewer ownerId={ownerId} bookId={bookId} files={book.files} initialFileId={viewer.fileId} initialPage={viewer.page} onClose={() => setViewer(null)} /> : null}
    {adding || selection || shown || pendingFiles.length > 0 ? <section ref={workArea} aria-labelledby="receipt-work-heading" className="scroll-mt-6 rounded-xl border border-[#DCE3EA] bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 id="receipt-work-heading" className="text-lg font-bold">{selection?.entryId ? '지출 수정' : shown && !selection ? '등록한 영수증' : '영수증 등록·확인'}</h2><button className={button} onClick={closeWork}>닫기</button></div>
      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-2 text-sm text-[#526174]"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" />자동 분석을 위해 선택한 원본을 OpenAI로 전송하는 데 동의합니다. 불필요한 개인정보는 가려 주세요.</label>
        {!user ? <p className="text-sm">AI 분석은 관리자 로그인이 필요합니다. <button className="min-h-11 font-semibold text-[#0F6CBD]" onClick={() => void signIn()}>Google 로그인</button></p> : null}
        <input ref={fileInput} className="sr-only" type="file" multiple accept={RECEIPT_ACCEPT} aria-label="영수증 증빙 파일" onChange={e => void upload(Array.from(e.target.files ?? []))} />
        {!pendingFiles.length ? <button disabled={busy || !consent || !user} className={button} onClick={() => fileInput.current?.click()}>영수증 파일 선택</button> : null}
        <p className="text-xs text-[#526174]">JPG·PNG·WebP·PDF · 파일당 10MB · PDF 10쪽까지. AI 결과는 원본과 대조해 주세요.</p>
        {busy ? <p role="status" className="text-sm">{progress || '원본 보관 중'}</p> : null}
      </div>
      {pendingFiles.length ? <ul className="mt-4 divide-y border-y border-[#DCE3EA]">{pendingFiles.map(f => <li key={f.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold">{f.originalName}</p><p className="mt-1 text-xs text-[#526174]">{f.analysisStatus === 'ready' ? remaining(f).length + '건 확인 필요' : f.analysisStatus === 'failed' ? f.analysisErrorCode : busy ? '분석 대기 중' : '분석을 다시 시작해 주세요.'}</p></div><button className={button} disabled={busy && f.analysisStatus !== 'ready'} onClick={() => review(f)}>{f.analysisStatus === 'ready' ? '결과 확인·수정' : '직접 입력'}</button>{!f.linkedEntryIds.length ? <><button disabled={busy} className={button} onClick={() => void retry(f)}>재분석</button><button disabled={busy} className={button + ' text-[#B42318]'} onClick={() => void discard(f)}>삭제</button></> : null}</li>)}</ul> : null}
      {shown || selection ? <div className={'mt-5 grid min-w-0 gap-5 ' + (shown && selection ? 'lg:grid-cols-2' : '')}>
        {shown ? <div className="min-w-0"><ReceiptOriginal key={ownerId + bookId + shown.id + originalVersion} ownerId={ownerId} bookId={bookId} file={shown} page={selectedAnalysis?.page} /><input ref={replacementInput} type="file" accept={shown.mimeType} aria-label="기존 영수증 원본 다시 연결" className="sr-only" onChange={e => void attachOriginal(e.target.files?.[0])} /><button className="mt-2 min-h-11 text-xs text-[#526174] underline" onClick={() => replacementInput.current?.click()}>원본이 안 보이나요? 같은 파일 다시 연결</button></div> : null}
        {selection ? <form onSubmit={submit} className="min-w-0 space-y-4"><h3 className="font-bold">{selection.entryId ? '지출 내용 수정' : '분석 결과 확인·수정'}</h3>{selectedAnalysis ? <div className="rounded-lg bg-[#F1F6FC] p-3 text-sm"><p className="font-semibold">{selectedAnalysis.source === 'openai' ? 'OpenAI 분석 결과' : '이전 OCR 분석 결과'}</p>{selectedAnalysis.description ? <p className="mt-1">구매 내용: {selectedAnalysis.description}</p> : null}{selectedAnalysis.warnings.map((w, i) => <p key={i} className="mt-1 text-[#526174]">{w}</p>)}</div> : null}
          <label className="block text-sm font-semibold">사용 날짜<input required type="date" className={field} value={form.spentAt} onChange={e => change('spentAt', e.target.value)} /></label>
          <label className="block text-sm font-semibold">사용처<input required maxLength={120} className={field} value={form.merchant} onChange={e => change('merchant', e.target.value)} /></label>
          <label className="block text-sm font-semibold">사용 목적<input required maxLength={300} className={field} value={form.purpose} onChange={e => change('purpose', e.target.value)} placeholder="예: 학급 미술 활동 재료" /></label>
          <label className="block text-sm font-semibold">금액<input required inputMode="numeric" pattern="[0-9]+" className={field + ' tabular-nums'} value={form.amount} onChange={e => change('amount', e.target.value.replace(/\D/g, ''))} /></label>
          {selectedAnalysis?.amount != null && Number(form.amount) !== selectedAnalysis.amount ? <p className="text-xs text-[#526174]">AI 분석 금액: {formatWon(selectedAnalysis.amount)}. 수정한 금액으로 반영됩니다.</p> : null}
          {selection.evidenceFileIds.length > 1 ? <div className="flex flex-wrap gap-2">{selection.evidenceFileIds.map((id, i) => <button key={id} type="button" className={button} onClick={() => setViewFileId(id)}>영수증 {i + 1}</button>)}</div> : null}
          <div className="flex flex-wrap gap-2"><button type="submit" className={primary}>{selection.entryId ? '수정 저장' : '이 지출을 장부에 반영'}</button><button type="button" className={button} onClick={closeWork}>나중에 확인</button>{selection.entryId ? <button type="button" className={button + ' text-[#B42318]'} onClick={() => { try { trashReceiptEntry(ownerId, bookId, selection.entryId!); closeWork(); setNotice('지출을 휴지통으로 옮겼습니다. 아래에서 복원할 수 있습니다.'); } catch { setError('지출을 옮기지 못했습니다.'); } }}>휴지통으로 이동</button> : null}</div>
        </form> : null}
      </div> : null}
    </section> : null}
    {trashedReceiptEntries(book).length ? <details className="rounded-xl border border-[#DCE3EA] bg-white px-5"><summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold">휴지통 {trashedReceiptEntries(book).length}건</summary><ul>{trashedReceiptEntries(book).map(entry => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{entry.merchant} · {formatWon(entry.amount)}</span><button className={button} disabled={!isReceiptEntryRestorable(entry)} onClick={() => { try { restoreReceiptEntry(ownerId, bookId, entry.id); setNotice('지출을 복원했습니다.'); } catch { setError('복원하지 못했습니다.'); } }}>복원</button></li>)}</ul></details> : null}
  </div>;
}
