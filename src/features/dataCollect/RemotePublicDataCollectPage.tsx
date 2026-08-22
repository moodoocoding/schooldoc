import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FilePenLine, Search, Upload } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getRemoteDataCollectMetadata, searchRemoteDataCollectTargets, submitRemoteDataCollectReview, type DataCollectPublicMetadata, type DataCollectPublicTarget } from './dataCollectPublicApi';

export function RemotePublicDataCollectPage() {
  const { token = '' } = useParams();
  const [params] = useSearchParams();
  const [metadata, setMetadata] = useState<DataCollectPublicMetadata | null>(null);
  const [password, setPassword] = useState('');
  const [query, setQuery] = useState('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInToken, setWalkInToken] = useState('');
  const [targets, setTargets] = useState<DataCollectPublicTarget[]>([]);
  const [selected, setSelected] = useState<DataCollectPublicTarget | null>(null);
  const [decision, setDecision] = useState<'confirmed' | 'corrected' | 'submitted'>();
  const [file, setFile] = useState<File>();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [complete, setComplete] = useState(false);
  const personalToken = params.get('r') ?? '';

  useEffect(() => {
    let active = true;
    void getRemoteDataCollectMetadata(token).then((value) => {
      if (!active) return;
      setMetadata(value);
      setLoading(false);
    }).catch((loadError) => { if (active) { setError(loadError instanceof Error ? loadError.message : '자료 수합을 찾지 못했습니다.'); setLoading(false); } });
    return () => { active = false; };
  }, [token]);

  const search = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    try {
      setWorking(true); setError('');
      const found = await searchRemoteDataCollectTargets(token, query, password, personalToken);
      setTargets(found);
      if (personalToken && found.length === 1) setSelected(found[0]);
    } catch (searchError) { setError(searchError instanceof Error ? searchError.message : '제출 대상을 찾지 못했습니다.'); }
    finally { setWorking(false); }
  }, [password, personalToken, query, token]);
  useEffect(() => {
    if (metadata?.accessGranted && personalToken) void search();
  }, [metadata, personalToken, search]);
  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setWorking(true);
      setError('');
      const value = await getRemoteDataCollectMetadata(token, password);
      setMetadata(value);
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : '비밀번호를 확인하지 못했습니다.');
    } finally {
      setWorking(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!metadata?.accessGranted) { setError('먼저 공개 비밀번호를 확인해 주세요.'); return; }
    const effectiveDecision = metadata.hasTemplate ? decision : 'submitted';
    if ((!selected && metadata.mode !== 'custom') || (metadata.mode === 'custom' && !walkInName.trim())) { setError('제출자 이름을 입력해 주세요.'); return; }
    if (!effectiveDecision) { setError('회신 방법을 선택해 주세요.'); return; }
    try { setWorking(true); setError(''); const result = await submitRemoteDataCollectReview(token, selected?.token ?? walkInToken, effectiveDecision, password, file, note, walkInName); if (metadata.mode === 'custom' && result.personalToken) setWalkInToken(result.personalToken); setDecision(effectiveDecision); setComplete(true); }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : '회신을 제출하지 못했습니다.'); }
    finally { setWorking(false); }
  };

  if (loading) return <RemoteShell><p className="text-sm font-semibold text-[#526174]">자료 수합을 불러오는 중입니다.</p></RemoteShell>;
  if (!metadata) return <RemoteShell><h1 className="text-xl font-extrabold">자료 수합을 찾을 수 없습니다</h1><p className="mt-3 text-sm text-[#526174]">{error || '주소가 정확한지 보낸 분에게 확인해 주세요.'}</p></RemoteShell>;
  if (metadata.status !== 'open' || (metadata.dueAt && new Date(metadata.dueAt).getTime() < Date.now())) return <RemoteShell><h1 className="text-xl font-extrabold">자료 수합이 종료되었습니다</h1><p className="mt-3 text-sm text-[#526174]">추가 제출이 필요하면 보낸 분에게 문의해 주세요.</p></RemoteShell>;
  if (!metadata.accessGranted) return <RemoteShell><p className="text-xs font-bold text-[#0F6CBD]">보호된 자료</p><h1 className="mt-2 text-xl font-extrabold">{metadata.title}</h1><form onSubmit={unlock} className="mt-6"><label className="text-sm font-bold">공개 비밀번호<input type="password" autoFocus required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-[48px] w-full rounded-lg border border-[#C8D0DA] px-3 font-normal" /></label>{error ? <p role="alert" className="mt-3 text-sm font-semibold text-[#B42318]">{error}</p> : null}<button type="submit" disabled={working} className="mt-4 min-h-[48px] w-full rounded-lg bg-[#0F6CBD] text-sm font-bold text-white disabled:opacity-60">{working ? '확인하는 중' : '확인'}</button></form></RemoteShell>;
  if (complete) return <RemoteShell><CheckCircle2 className="h-10 w-10 text-[#16803C]" /><h1 className="mt-4 text-xl font-extrabold">회신을 제출했습니다</h1><p className="mt-3 text-sm text-[#526174]">{selected?.label ?? walkInName} · {decision === 'confirmed' ? '이상 없음' : '수정본 제출'}</p>{metadata.allowResubmit ? <button type="button" onClick={() => { setComplete(false); setDecision(undefined); setFile(undefined); setNote(''); }} className="mt-6 min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD]">다시 회신하기</button> : <p className="mt-5 text-sm font-semibold text-[#526174]">제출이 끝나 바꿀 수 없습니다.</p>}</RemoteShell>;

  return <RemoteShell><p className="text-xs font-bold text-[#0F6CBD]">자료 확인 및 제출</p><h1 className="mt-2 text-2xl font-extrabold">{metadata.title}</h1><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#526174]">{metadata.description}</p>
    {(!selected && metadata.mode !== 'custom') ? <section className="mt-7"><h2 className="font-bold">내 제출 대상 찾기</h2><form onSubmit={search} className="mt-3 flex gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3.5 h-5 w-5 text-[#94A3B8]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-[48px] w-full rounded-lg border border-[#C8D0DA] pl-11 pr-3" placeholder="제출 대상 이름 2글자 이상" /></div><button type="submit" disabled={working} className="min-h-[48px] rounded-lg bg-[#0F6CBD] px-4 text-sm font-bold text-white disabled:opacity-60">찾기</button></form><div className="mt-3 space-y-2">{targets.map((target) => <button key={target.token} type="button" onClick={() => setSelected(target)} className="flex min-h-[52px] w-full items-center justify-between rounded-lg border border-[#DCE3EA] px-4 text-left hover:border-[#0F6CBD]"><span className="font-bold">{target.label}</span><span className="text-sm text-[#526174]">{target.owner || '-'}</span></button>)}</div></section> : <form onSubmit={submit} className="mt-7 space-y-5"><div className="rounded-lg bg-[#F1F5F9] p-4"><p className="text-xs font-semibold text-[#526174]">{metadata.mode === 'custom' ? '제출자 정보' : '선택한 대상'}</p>{metadata.mode === 'custom' ? <input aria-label="제출자 이름" value={walkInName} onChange={(event) => setWalkInName(event.target.value)} className="mt-2 min-h-[48px] w-full rounded-lg border border-[#C8D0DA] bg-white px-3 font-bold" placeholder="이름을 입력해 주세요" /> : <p className="mt-1 font-bold">{selected?.label}{selected?.owner ? ` · ${selected.owner}` : ''}</p>}</div>{metadata.template ? <section><h2 className="font-bold">1. 배포 파일 확인</h2><a href={metadata.template.url} download={metadata.template.name} className="mt-3 flex min-h-[52px] items-center gap-3 rounded-lg border border-[#0F6CBD] bg-[#EFF6FC] px-4 font-bold text-[#0F6CBD]"><Download className="h-5 w-5" />{metadata.template.name} 내려받기</a><h2 className="mt-6 font-bold">2. 확인 결과</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><button type="button" aria-pressed={decision === 'confirmed'} onClick={() => { setDecision('confirmed'); setFile(undefined); }} className={`min-h-[64px] rounded-lg border px-4 text-sm font-bold ${decision === 'confirmed' ? 'border-[#16803C] bg-[#E6F4EA] text-[#126B32]' : 'border-[#DCE3EA]'}`}><CheckCircle2 className="mx-auto mb-1 h-5 w-5" />이상 없음</button><button type="button" aria-pressed={decision === 'corrected'} onClick={() => setDecision('corrected')} className={`min-h-[64px] rounded-lg border px-4 text-sm font-bold ${decision === 'corrected' ? 'border-[#B7791F] bg-[#FFFBEB] text-[#8A5A00]' : 'border-[#DCE3EA]'}`}><FilePenLine className="mx-auto mb-1 h-5 w-5" />수정본 제출</button></div></section> : <section><h2 className="font-bold">제출 파일</h2><p className="mt-1 text-sm text-[#526174]">요청받은 자료를 원본 형식 그대로 올려 주세요.</p></section>}{(decision === 'corrected' || !metadata.template) ? <label className="flex min-h-[88px] cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-[#94A3B8] bg-[#F8FAFC] px-4 text-sm font-bold"><Upload className="h-5 w-5 text-[#0F6CBD]" />{file ? file.name : '파일 선택'}<input type="file" className="sr-only" accept=".hwp,.hwpx,.docx,.xlsx,.pdf,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0])} /></label> : null}<label className="block text-sm font-bold">전달 사항 <span className="font-normal text-[#64748B]">(선택)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-[#C8D0DA] p-3 font-normal" placeholder="수정한 내용이나 확인 사항을 적어 주세요." /></label>{error ? <p role="alert" className="flex gap-2 text-sm font-semibold text-[#B42318]"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p> : null}<button type="submit" disabled={working} className="min-h-[52px] w-full rounded-lg bg-[#0F6CBD] text-sm font-bold text-white disabled:opacity-50">{working ? '제출하는 중' : '회신 제출'}</button>{metadata.mode !== 'custom' ? <button type="button" onClick={() => setSelected(null)} className="min-h-[44px] w-full text-sm font-bold text-[#526174]">다른 대상 선택</button> : null}</form>}
  </RemoteShell>;
}

function RemoteShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#F6F8FB] px-4 py-8 text-[#0F172A]"><section className="mx-auto max-w-xl rounded-xl border border-[#DCE3EA] bg-white p-5 shadow-sm sm:p-8">{children}</section></main>;
}
