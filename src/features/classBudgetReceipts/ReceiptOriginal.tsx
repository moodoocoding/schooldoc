import { useEffect, useState } from 'react';
import { FileText, ImageOff } from 'lucide-react';
import { getReceiptOriginal } from './receiptOriginalStore';
import type { ReceiptFile } from './types';

function useReceiptSource(ownerId: string, bookId: string, file: ReceiptFile, enabled = true) {
  const [source, setSource] = useState<{ id: string; url: string; error: string } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true; let objectUrl = '';
    void getReceiptOriginal(ownerId, bookId, file.id).then(original => {
      if (!active) return;
      const legacy = /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/.test(file.previewUrl) ? file.previewUrl : '';
      objectUrl = original ? URL.createObjectURL(original) : '';
      setSource({ id: file.id, url: objectUrl || legacy, error: objectUrl || legacy ? '' : '이전 버전에서 원본을 보관하지 않은 파일입니다. 원본을 다시 연결해 주세요.' });
    }).catch(() => { if (active) setSource({ id: file.id, url: '', error: '원본을 읽지 못했습니다. 브라우저 저장 공간을 확인해 주세요.' }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [ownerId, bookId, file.id, file.previewUrl, enabled]);
  return source?.id === file.id ? source : null;
}

export function ReceiptThumbnail({ ownerId, bookId, file }: { ownerId: string; bookId: string; file: ReceiptFile }) {
  const isPdf = file.mimeType === 'application/pdf';
  const source = useReceiptSource(ownerId, bookId, file, !isPdf);
  return <span aria-hidden="true" className="flex h-24 w-full items-center justify-center rounded-lg bg-[#F1F6FC]">
    {isPdf ? <span className="flex items-center gap-2 text-sm font-semibold text-[#526174]"><FileText className="h-7 w-7" />PDF</span>
      : source?.url ? <img src={source.url} alt="" loading="lazy" className="h-full w-full rounded-lg object-contain" />
      : source?.error ? <ImageOff className="h-6 w-6 text-[#526174]" /> : <span className="text-xs text-[#526174]">불러오는 중…</span>}
  </span>;
}

export function ReceiptOriginal({ ownerId, bookId, file, page, fitToViewport = false }: { ownerId: string; bookId: string; file: ReceiptFile; page?: number | null; fitToViewport?: boolean }) {
  const current = useReceiptSource(ownerId, bookId, file);
  const url = current?.url;
  return <section aria-label="영수증 원본" className="min-w-0 rounded-xl border border-[#DCE3EA] bg-[#F8FAFC] p-3">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="min-w-0 break-all text-sm font-bold">{file.originalName}</h3>{url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#0F6CBD]">크게 보기</a> : null}</div>
    {!current ? <p role="status">원본 불러오는 중…</p> : current.error ? <p className="text-sm text-[#B42318]">{current.error}</p> : file.mimeType === 'application/pdf'
      ? <iframe title="영수증 PDF 원본" src={`${url}#page=${page ?? 1}`} className={'w-full rounded-lg border-0 ' + (fitToViewport ? 'h-[55dvh] min-h-[260px]' : 'min-h-[360px] sm:min-h-[520px]')} />
      : <a href={url} target="_blank" rel="noreferrer" aria-label="영수증 이미지 확대"><img src={url} alt="등록한 영수증 원본" className={'mx-auto max-w-full object-contain ' + (fitToViewport ? 'max-h-[55dvh]' : 'max-h-[600px]')} /></a>}
  </section>;
}
