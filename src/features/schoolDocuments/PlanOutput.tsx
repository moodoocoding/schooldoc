import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Copy, Download, LoaderCircle } from 'lucide-react';
import { downloadBlob } from '../../utils/qrImage';
import type { PlanConditions, PlanDraft } from '../../../supabase/functions/_shared/schoolPlan';
import { layoutOfficialDocument } from '../officialDocument/format';
import { pageVolumeIssues } from '../officialDocument/lint';
import { officialPageUrl, officialPreviewFontCss } from '../officialDocument/previewFonts';
import type { PageVolume } from '../officialDocument/rhwpWriter';
import { runRhwp } from '../officialDocument/rhwpClient';
import { checkedPlanDocument, planDraftBody } from './planDocument';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50';
const field = 'mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]';

export function PlanOutput({ draft, title, pages, current, conditions, related, onTitle, onPages, onBack }: {
  draft: PlanDraft; title: string; pages: 1 | 2; current: boolean;
  /** 기안 본문의 운영 시기·예산 출처. related는 공문을 바탕으로 작성했는지(관련 공문 줄). */
  conditions: PlanConditions; related: boolean;
  onTitle: (title: string) => void; onPages: (pages: 1 | 2) => void; onBack: () => void;
}) {
  const key = JSON.stringify({ draft, title, pages, current });
  const [preview, setPreview] = useState<{ key: string; urls: string[]; bytes: Uint8Array<ArrayBuffer>; volume?: PageVolume } | null>(null);
  const [failure, setFailure] = useState('');
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [saved, setSaved] = useState(false);
  const [selectedPage, setSelectedPage] = useState(0);
  const active = useRef<AbortController | null>(null);
  const ready = preview?.key === key && loaded === preview.urls.length;
  // 제목 오류는 지면 생성 오류로 안내하므로 점검 결과는 비워 둔다.
  const checked = useMemo(() => { try { return checkedPlanDocument(draft, title, pages); } catch { return null; } }, [draft, title, pages]);
  const draftBody = useMemo(() => title.trim() ? planDraftBody(draft, title, conditions, related) : '', [draft, title, conditions, related]);
  const [copy, setCopy] = useState<{ body: string; ok: boolean } | null>(null);
  const copyDraftBody = async () => {
    try { await navigator.clipboard.writeText(draftBody); setCopy({ body: draftBody, ok: true }); }
    catch { setCopy({ body: draftBody, ok: false }); }
  };
  // 분량 점검은 실제 지면을 만든 뒤에 더한다.
  const issues = checked ? [...checked.issues, ...(preview?.key === key ? pageVolumeIssues(preview.volume) : [])] : [];
  useEffect(() => {
    const c = new AbortController(); active.current = c;
    let urls: string[] = [];
    setPreview(null); setFailure(''); setLoaded(0); setSaved(false); setSelectedPage(0);
    if (!current || !title.trim()) return () => c.abort();
    const timer = setTimeout(async () => {
      try {
        const { document } = checkedPlanDocument(draft, title, pages);
        const [result, css] = await Promise.all([runRhwp({ action: 'render', document, maxPages: pages }, c.signal), officialPreviewFontCss()]);
        if (c.signal.aborted) return;
        urls = result.svgs.map(svg => officialPageUrl(svg, css));
        setPreview({ key, urls, bytes: result.bytes, volume: result.volume });
      } catch (error) {
        if (!c.signal.aborted) setFailure(error instanceof Error ? error.message : '지면을 만들지 못했습니다. 다시 시도해 주세요.');
      }
    }, 300);
    return () => { clearTimeout(timer); c.abort(); urls.forEach(URL.revokeObjectURL); };
  }, [key, draft, title, pages, current, retry]);
  const save = () => {
    if (!ready || !preview || failure) return;
    downloadBlob(new Blob([preview.bytes], { type: 'application/hwp+zip' }), `${title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || '운영계획서'}_초안.hwpx`);
    setSaved(true);
  };
  return <>
    <p className="mb-6 leading-7 text-slate-600">저장할 한글 문서의 지면을 확인합니다. 일정·예산은 한글에서 수정할 수 있는 표로 담습니다.</p>
    <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
      <div data-decision><label htmlFor="plan-output-title" className="text-sm font-bold text-slate-800">문서 제목</label><input id="plan-output-title" className={field} maxLength={100} value={title} onChange={e => onTitle(e.target.value)}/></div>
      <div data-decision><label htmlFor="plan-output-pages" className="text-sm font-bold text-slate-800">출력 분량</label><select id="plan-output-pages" className={field} value={pages} onChange={e => onPages(Number(e.target.value) as 1 | 2)}><option value={1}>1쪽</option><option value={2}>2쪽</option></select></div>
    </div>
    <p className="mt-3 text-sm leading-6 text-slate-600">공문 서식(본문 휴먼명조 13pt·장평 100%·자간 0%·줄간격 160%, 제목 HY헤드라인M)으로 저장합니다. 미리보기는 비슷한 무료 글꼴(나눔명조·나눔고딕)로 그려서 한글에서 열면 줄바꿈이 조금 다를 수 있습니다. 내용과 글자 크기는 자동으로 줄이지 않습니다.</p>
    {current && checked && <section aria-labelledby="plan-official-check" className={`mt-5 rounded-lg border p-4 ${issues.some(i => !i.fixed) ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
      <h3 id="plan-official-check" className="font-bold">공문 표기 점검</h3>
      {issues.length === 0 ? <p className="mt-1 text-sm leading-6">항목 기호·날짜·시각·금액 표기와 분량에서 고칠 점을 찾지 못했습니다.</p> : <ul className="mt-2 space-y-1 text-sm leading-6">{issues.map((issue, i) => <li key={i}><span className="font-bold">{issue.fixed ? '자동 정리' : '확인 필요'}</span> · {issue.where}: {issue.message}</li>)}</ul>}
    </section>}
    {!current ? <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-4">학교 조건이 바뀌었습니다. 초안을 다시 작성해 주세요.</p> : failure ? <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900"><p className="leading-7">{failure}</p><button className={`${button} mt-3 border border-red-300 bg-white`} onClick={() => setRetry(n => n + 1)}>지면 다시 만들기</button></div> : !ready && title.trim() ? <div role="status" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-4"><LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true"/><span>저장할 지면을 만들고 있습니다.</span><button className={`${button} border border-slate-300 bg-white`} onClick={() => { active.current?.abort(); setFailure('지면 만들기를 취소했습니다. 입력과 초안은 유지됩니다.'); }}>취소</button></div> : null}
    {preview?.key === key && <div aria-label="한글 지면 미리보기" className="mt-6 rounded-xl bg-slate-100 p-3 sm:p-5">
      <div data-decision className="mb-4 max-w-48"><label htmlFor="plan-preview-page" className="text-sm font-bold text-slate-800">미리볼 쪽</label><select id="plan-preview-page" className={field} value={selectedPage} onChange={e => setSelectedPage(Number(e.target.value))}>{preview.urls.map((_, i) => <option key={i} value={i}>{i + 1} / {preview.urls.length}쪽</option>)}</select></div>
      {preview.urls.map((url, i) => <figure key={url} hidden={selectedPage !== i}><img src={url} alt={`운영계획서 ${i + 1}쪽 지면`} className="mx-auto block h-auto w-full max-w-[794px] bg-white shadow-sm" onLoad={() => setLoaded(n => n + 1)} onError={() => setFailure('지면 이미지를 표시하지 못했습니다. 다시 만들어 주세요.')}/></figure>)}
      <details className="mt-4 rounded-lg bg-white p-4"><summary className="cursor-pointer font-bold text-slate-800">문서 본문 읽기</summary><div className="mt-4 space-y-3 break-words text-base leading-7 text-slate-800">{(checked ? layoutOfficialDocument(checked.document) : []).map((line, i) => line.kind === 'table' ? <ul key={i} className="space-y-3">{line.rows.map((row, r) => <li key={r}>{row.map((text, c) => `${line.columns[c].label}: ${text}`).join(' · ')}</li>)}</ul> : line.kind === 'item' || line.kind === 'note' ? line.heading ? <h3 key={i} className="font-bold">{line.text}</h3> : <p key={i}>{line.text}</p> : null)}</div></details>
    </div>}
    {current && draftBody && <section aria-labelledby="plan-draft-body" className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h3 id="plan-draft-body" className="font-bold text-slate-900">K-에듀파인 기안 본문</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">운영계획서 HWPX를 붙임으로 올리고, 아래 본문을 기안문 본문 칸에 붙여 넣습니다. 수신·제목·결재란은 K-에듀파인에서 입력합니다.{related && ' ○ 표시는 관련 공문의 문서 번호와 날짜로 바꿔 주세요.'}</p>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-mono text-sm leading-6 text-slate-800">{draftBody}</pre>
      <button type="button" className={`${button} mt-3 border border-slate-300 bg-white text-slate-700`} onClick={() => void copyDraftBody()}><Copy className="h-4 w-4" aria-hidden="true"/>기안 본문 복사</button>
      {copy?.body === draftBody && (copy.ok ? <p role="status" className="mt-2 text-sm font-medium text-green-800">기안 본문을 복사했습니다.</p> : <p role="alert" className="mt-2 text-sm text-red-800">복사하지 못했습니다. 위 본문을 직접 선택해 복사해 주세요.</p>)}
    </section>}
    {saved && <p role="status" className="mt-5 rounded-lg bg-green-50 p-4 font-medium text-green-900">HWPX 저장을 시작했습니다. 다운로드 폴더에서 파일을 확인해 주세요.</p>}
    <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5"><button className={`${button} border border-slate-300 bg-white text-slate-700`} onClick={onBack}><ArrowLeft className="h-4 w-4" aria-hidden="true"/>초안 검토</button><button className={`${button} bg-[#0F6CBD] text-white hover:bg-[#0B5A9E]`} onClick={save} disabled={!ready || !!failure || !current}><Download className="h-4 w-4" aria-hidden="true"/>HWPX 저장</button></div>
  </>;
}
