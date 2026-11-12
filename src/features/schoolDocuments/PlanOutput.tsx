import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, LoaderCircle } from 'lucide-react';
import { runPlanDocument } from './planRhwp';
import { PLAN_BODY_FONT, PLAN_TITLE_FONT, planDocumentBlocks } from './planRhwpEngine';
import { downloadBlob } from '../../utils/qrImage';
import type { PlanDraft } from '../../../supabase/functions/_shared/schoolPlan';
import bodyUrl from './assets/fonts/NanumMyeongjo-Regular.otf?url';
import bodyBoldUrl from './assets/fonts/NanumMyeongjo-Bold.otf?url';
import titleUrl from './assets/fonts/NanumGothic-Bold.ttf?url';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50';
const field = 'mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]';
let fontCss: Promise<string> | undefined;
async function previewFontCss() {
  // The saved file names 휴먼명조/HY헤드라인M; the preview paints them with the OFL substitutes used for layout.
  const faces = [{ url: bodyUrl, family: PLAN_BODY_FONT, weight: 400, format: 'opentype' }, { url: bodyBoldUrl, family: PLAN_BODY_FONT, weight: 700, format: 'opentype' }, { url: titleUrl, family: PLAN_TITLE_FONT, weight: 400, format: 'truetype' }];
  fontCss ??= Promise.all(faces.map(async ({ url, family, weight, format }) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('미리보기 글꼴을 불러오지 못했습니다. 다시 시도해 주세요.');
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url('${data}') format('${format}');}`;
  })).then(styles => styles.join('')).catch(error => { fontCss = undefined; throw error; });
  return fontCss;
}
function pageUrl(svg: string, css: string) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('지면 미리보기를 읽지 못했습니다. 다시 시도해 주세요.');
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style'); style.textContent = css;
  document.documentElement.prepend(style);
  return URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(document)], { type: 'image/svg+xml' }));
}

export function PlanOutput({ draft, title, pages, current, onTitle, onPages, onBack }: {
  draft: PlanDraft; title: string; pages: 1 | 2; current: boolean;
  onTitle: (title: string) => void; onPages: (pages: 1 | 2) => void; onBack: () => void;
}) {
  const key = JSON.stringify({ draft, title, pages, current });
  const [preview, setPreview] = useState<{ key: string; urls: string[]; bytes: Uint8Array<ArrayBuffer> } | null>(null);
  const [failure, setFailure] = useState('');
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [saved, setSaved] = useState(false);
  const [selectedPage, setSelectedPage] = useState(0);
  const active = useRef<AbortController | null>(null);
  const ready = preview?.key === key && loaded === preview.urls.length;
  useEffect(() => {
    const c = new AbortController(); active.current = c;
    let urls: string[] = [];
    setPreview(null); setFailure(''); setLoaded(0); setSaved(false); setSelectedPage(0);
    if (!current || !title.trim()) return () => c.abort();
    const timer = setTimeout(async () => {
      try {
        const [result, css] = await Promise.all([runPlanDocument({ action: 'generate', draft, title, pages }, c.signal), previewFontCss()]);
        if (c.signal.aborted) return;
        urls = result.svgs.map(svg => pageUrl(svg, css));
        setPreview({ key, urls, bytes: result.bytes });
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
    {!current ? <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-4">학교 조건이 바뀌었습니다. 초안을 다시 작성해 주세요.</p> : failure ? <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900"><p className="leading-7">{failure}</p><button className={`${button} mt-3 border border-red-300 bg-white`} onClick={() => setRetry(n => n + 1)}>지면 다시 만들기</button></div> : !ready && title.trim() ? <div role="status" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-4"><LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true"/><span>저장할 지면을 만들고 있습니다.</span><button className={`${button} border border-slate-300 bg-white`} onClick={() => { active.current?.abort(); setFailure('지면 만들기를 취소했습니다. 입력과 초안은 유지됩니다.'); }}>취소</button></div> : null}
    {preview?.key === key && <div aria-label="한글 지면 미리보기" className="mt-6 rounded-xl bg-slate-100 p-3 sm:p-5">
      <div data-decision className="mb-4 max-w-48"><label htmlFor="plan-preview-page" className="text-sm font-bold text-slate-800">미리볼 쪽</label><select id="plan-preview-page" className={field} value={selectedPage} onChange={e => setSelectedPage(Number(e.target.value))}>{preview.urls.map((_, i) => <option key={i} value={i}>{i + 1} / {preview.urls.length}쪽</option>)}</select></div>
      {preview.urls.map((url, i) => <figure key={url} hidden={selectedPage !== i}><img src={url} alt={`운영계획서 ${i + 1}쪽 지면`} className="mx-auto block h-auto w-full max-w-[794px] bg-white shadow-sm" onLoad={() => setLoaded(n => n + 1)} onError={() => setFailure('지면 이미지를 표시하지 못했습니다. 다시 만들어 주세요.')}/></figure>)}
      <details className="mt-4 rounded-lg bg-white p-4"><summary className="cursor-pointer font-bold text-slate-800">문서 본문 읽기</summary><div className="mt-4 space-y-3 break-words text-base leading-7 text-slate-800">{planDocumentBlocks(draft, title).map((block, i) => block.kind === 'table' ? <ul key={i} className="space-y-3">{block.rows.slice(1).map((row, r) => <li key={r}>{row.map((text, c) => `${block.rows[0][c]}: ${text}`).join(' · ')}</li>)}</ul> : block.kind === 'body' ? <p key={i}>{block.text}</p> : <h3 key={i} className="font-bold">{block.text}</h3>)}</div></details>
    </div>}
    {saved && <p role="status" className="mt-5 rounded-lg bg-green-50 p-4 font-medium text-green-900">HWPX 저장을 시작했습니다. 다운로드 폴더에서 파일을 확인해 주세요.</p>}
    <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5"><button className={`${button} border border-slate-300 bg-white text-slate-700`} onClick={onBack}><ArrowLeft className="h-4 w-4" aria-hidden="true"/>초안 검토</button><button className={`${button} bg-[#0F6CBD] text-white hover:bg-[#0B5A9E]`} onClick={save} disabled={!ready || !!failure || !current}><Download className="h-4 w-4" aria-hidden="true"/>HWPX 저장</button></div>
  </>;
}
