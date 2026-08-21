import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCopy, Download, ExternalLink, FilePenLine, ImageDown, PauseCircle, PlayCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPublicAppOrigin } from '../../utils/publicAppOrigin';
import { qrImageFileName, saveQrImage } from '../../utils/qrImage';
import { getDataCollection, subscribeDataCollections, updateDataCollectionStatus } from './dataCollectService';

export function DataCollectManagePage() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const [collection, setCollection] = useState<Awaited<ReturnType<typeof getDataCollection>>>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const [error, setError] = useState('');
  const qrRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => { try { setCollection(await getDataCollection(id)); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '자료 수합을 불러오지 못했습니다.'); } finally { if (active) setLoading(false); } };
    void refresh();
    const unsubscribe = subscribeDataCollections(() => void refresh());
    return () => { active = false; unsubscribe(); };
  }, [id]);
  const latestByTarget = useMemo(() => {
    const latest = new Map<string, NonNullable<typeof collection>['submissions'][number]>();
    for (const submission of collection?.submissions ?? []) latest.set(submission.targetId, submission);
    return latest;
  }, [collection]);

  if (loading) return <div className="mx-auto max-w-3xl py-20 text-center text-sm font-semibold text-[#526174]">자료 수합을 불러오는 중입니다.</div>;
  if (!collection) return <div className="mx-auto max-w-3xl border-y border-[#DCE3EA] bg-white py-20 text-center"><h1 className="text-xl font-bold">자료 수합을 찾을 수 없습니다</h1><button type="button" onClick={() => navigate('/tools/data-collect')} className="mt-5 text-sm font-bold text-[#0F6CBD]">목록으로 돌아가기</button></div>;
  const publicUrl = `${getPublicAppOrigin()}/s/data/${collection.publicToken}`;
  const confirmed = [...latestByTarget.values()].filter((submission) => submission.decision === 'confirmed').length;
  const corrected = [...latestByTarget.values()].filter((submission) => submission.decision === 'corrected' || submission.decision === 'submitted').length;

  const copyLink = async () => { await navigator.clipboard.writeText(publicUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
  const toggleStatus = async () => { try { setError(''); const updated = await updateDataCollectionStatus(collection.id, collection.status === 'open' ? 'closed' : 'open'); if (updated) setCollection(updated); } catch (statusError) { setError(statusError instanceof Error ? statusError.message : '상태를 바꾸지 못했습니다.'); } };
  const downloadQr = async () => { try { setSavingQr(true); setError(''); await saveQrImage(qrRef.current, qrImageFileName(collection.title, '자료수합_QR', '자료수합')); } catch (qrError) { setError(qrError instanceof Error ? qrError.message : 'QR 이미지를 저장하지 못했습니다.'); } finally { setSavingQr(false); } };

  return <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
    <div className="flex items-center justify-between border-b border-[#DCE3EA] pb-4"><button type="button" onClick={() => navigate('/tools/data-collect')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />자료 수합 목록</button><span className={`rounded-md px-3 py-1.5 text-xs font-bold ${collection.status === 'open' ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EEF1F4] text-[#526174]'}`}>{collection.status === 'open' ? '수합 중' : '종료'}</span></div>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-bold text-[#0F6CBD]">{collection.mode === 'custom' ? '명단 없음' : '명단 있음'}</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{collection.title}</h1><p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[#526174]">{collection.description || '별도 안내가 없습니다.'}</p></div><button type="button" onClick={() => void toggleStatus()} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] bg-white px-4 text-sm font-bold text-[#334155]">{collection.status === 'open' ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}{collection.status === 'open' ? '수합 종료' : '다시 열기'}</button></div>
    {error ? <p role="alert" className="border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]">{error}</p> : null}
    <section className="grid gap-px overflow-hidden rounded-lg border border-[#DCE3EA] bg-[#DCE3EA] sm:grid-cols-3"><div className="bg-white p-5"><p className="text-xs font-semibold text-[#526174]">전체 대상</p><p className="mt-2 text-2xl font-extrabold">{collection.targets.length}</p></div><div className="bg-white p-5"><p className="text-xs font-semibold text-[#526174]">이상 없음</p><p className="mt-2 text-2xl font-extrabold text-[#126B32]">{confirmed}</p></div><div className="bg-white p-5"><p className="text-xs font-semibold text-[#526174]">수정본 제출</p><p className="mt-2 text-2xl font-extrabold text-[#9A6700]">{corrected}</p></div></section>
    <section className="grid gap-5 rounded-lg border border-[#DCE3EA] bg-white p-5 sm:p-6 lg:grid-cols-[1fr_190px]"><div><h2 className="text-lg font-bold">공유 링크</h2><p className="mt-1 text-sm text-[#526174]">링크나 QR을 받은 사람은 본인을 찾고 파일을 확인한 뒤 회신합니다.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input readOnly value={publicUrl} aria-label="자료 수합 공개 링크" className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[#C8D0DA] bg-[#F8FAFC] px-3 text-sm" /><button type="button" onClick={() => void copyLink()} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#0F6CBD] px-4 text-sm font-bold text-[#0F6CBD]"><ClipboardCopy className="h-4 w-4" />{copied ? '복사됨' : '링크 복사'}</button><a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] px-4 text-sm font-bold text-[#334155]"><ExternalLink className="h-4 w-4" />열기</a></div>{collection.sourceFile ? <a href={collection.sourceFile.dataUrl} download={collection.sourceFile.originalName} className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#F1F5F9] px-4 text-sm font-bold text-[#334155]"><Download className="h-4 w-4" />배포 파일: {collection.sourceFile.originalName}</a> : <p className="mt-5 text-sm font-semibold text-[#526174]">배포 파일 없이 제출 파일만 받는 수합입니다.</p>}</div><div className="flex flex-col items-center justify-center border-t border-[#EEF1F4] pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"><div ref={qrRef} className="rounded-lg bg-white p-2"><QRCodeSVG value={publicUrl} size={144} level="M" /></div><button type="button" disabled={savingQr} onClick={() => void downloadQr()} className="mt-2 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-xs font-bold text-[#0F6CBD] disabled:opacity-60"><ImageDown className="h-4 w-4" />{savingQr ? '저장 중' : 'QR 이미지 저장'}</button></div></section>
    <section className="overflow-hidden rounded-lg border border-[#DCE3EA] bg-white"><div className="border-b border-[#DCE3EA] px-5 py-4"><h2 className="text-lg font-bold">회신 현황</h2><p className="mt-1 text-sm text-[#526174]">미확인·이상 없음·수정본 제출을 구분합니다. 이전 제출은 버전으로 남습니다.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[#F8FAFC] text-xs text-[#526174]"><tr><th className="px-4 py-3">번호</th><th className="px-4 py-3">제출 대상</th><th className="px-4 py-3">현재 상태</th><th className="px-4 py-3">최근 회신</th><th className="px-4 py-3">파일</th></tr></thead><tbody>{collection.targets.map((target) => { const latest = latestByTarget.get(target.id); return <tr key={target.id} className="border-t border-[#EEF1F4]"><td className="px-4 py-3 text-[#64748B]">{target.rowNumber}</td><td className="px-4 py-3 font-bold">{target.label}</td><td className="px-4 py-3">{!latest ? <span className="text-[#64748B]">미확인</span> : latest.decision === 'confirmed' ? <span className="inline-flex items-center gap-1 font-bold text-[#126B32]"><CheckCircle2 className="h-4 w-4" />이상 없음</span> : <span className="inline-flex items-center gap-1 font-bold text-[#9A6700]"><FilePenLine className="h-4 w-4" />수정본 제출</span>}</td><td className="px-4 py-3 text-[#526174]">{latest ? `${new Date(latest.uploadedAt).toLocaleString('ko-KR')} · ${latest.revision}차` : '-'}</td><td className="px-4 py-3">{latest?.file ? <a href={latest.file.dataUrl} download={latest.file.originalName} className="font-bold text-[#0F6CBD] hover:underline">{latest.file.originalName}</a> : '-'}</td></tr>; })}</tbody></table></div></section>
  </div>;
}
