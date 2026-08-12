import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LoaderCircle, LockKeyhole, PenLine, Search, UserPlus } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { SignatureDialog } from './SignatureDialog';
import {
  createPublicWalkIn,
  loadPublicRegistry,
  searchPublicParticipants,
  submitPublicSignature,
  unlockPublicRegistry,
} from './registryPublicApi';
import { maskName, maskValue } from './registryUtils';
import type { Registry, RegistryParticipant, SignatureSource } from './types';

const inputClass = 'min-h-[52px] w-full rounded-lg border border-[#DCE3EA] bg-white px-4 text-base text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]/15';

const imageDimensions = (dataUrl: string) => new Promise<{ width: number; height: number }>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
  image.onerror = () => reject(new Error('서명 이미지 크기를 확인하지 못했습니다.'));
  image.src = dataUrl;
});

export function RemotePublicRegistrySignPage() {
  const { token } = useParams();
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RegistryParticipant[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState<RegistryParticipant | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [walkInValues, setWalkInValues] = useState<Record<string, string>>({});
  const [addingWalkIn, setAddingWalkIn] = useState(false);
  const [successName, setSuccessName] = useState('');

  useEffect(() => {
    if (!token) {
      setPageError('등록부 링크가 올바르지 않습니다.');
      setLoading(false);
      return;
    }
    let active = true;
    void loadPublicRegistry(token).then((loaded) => {
      if (!active) return;
      setRegistry(loaded);
      setIsUnlocked(!loaded.isPasswordProtected);
    }).catch((error) => {
      if (active) setPageError(error instanceof Error ? error.message : '등록부를 불러오지 못했습니다.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!token || !registry || !isUnlocked || registry.mode !== 'fixed' || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError('');
      return;
    }
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchPublicParticipants(token, password, query.trim()).then((participants) => {
        if (!active) return;
        setResults(participants);
        setSearchError('');
      }).catch((error) => {
        if (active) setSearchError(error instanceof Error ? error.message : '참석자를 검색하지 못했습니다.');
      }).finally(() => {
        if (active) setSearching(false);
      });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isUnlocked, password, query, registry, token]);

  const canAddWalkIn = useMemo(() => (
    Boolean(registry && (registry.mode === 'custom' || registry.allowWalkIn))
  ), [registry]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-5">
        <div className="text-center"><LoaderCircle className="mx-auto h-9 w-9 animate-spin text-[#0F6CBD]" /><p className="mt-4 text-sm font-semibold text-[#526174]">등록부를 불러오고 있습니다.</p></div>
      </main>
    );
  }

  if (pageError || !registry || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-5">
        <div className="w-full max-w-md border-y border-[#DCE3EA] bg-white px-6 py-12 text-center">
          <PenLine className="mx-auto h-8 w-8 text-[#94A3B8]" />
          <h1 className="mt-4 text-xl font-extrabold text-[#0F172A]">등록부를 찾을 수 없습니다</h1>
          <p className="mt-2 text-sm leading-6 text-[#526174]">{pageError || '링크가 정확한지 담당자에게 확인해 주세요.'}</p>
        </div>
      </main>
    );
  }

  if (registry.isPasswordProtected && !isUnlocked) {
    const handleUnlock = async () => {
      setPasswordError('');
      try {
        await unlockPublicRegistry(token, password);
        setIsUnlocked(true);
      } catch (error) {
        setPasswordError(error instanceof Error ? error.message : '비밀번호를 확인하지 못했습니다.');
      }
    };
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-5">
        <form className="w-full max-w-md rounded-lg border border-[#DCE3EA] bg-white p-6 shadow-sm" onSubmit={(event) => { event.preventDefault(); void handleUnlock(); }}>
          <LockKeyhole className="h-7 w-7 text-[#0F6CBD]" />
          <h1 className="mt-4 text-xl font-extrabold text-[#0F172A]">비밀번호 입력</h1>
          <p className="mt-2 text-sm text-[#526174]">이 등록부는 비밀번호로 보호되어 있습니다.</p>
          <label className="mt-6 grid gap-2 text-sm font-bold text-[#334155]">공개 링크 비밀번호<input type="password" autoFocus className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {passwordError ? <p role="alert" className="mt-3 text-sm font-semibold text-[#B42318]">{passwordError}</p> : null}
          <button type="submit" className="mt-5 min-h-[52px] w-full rounded-lg bg-[#0F6CBD] text-base font-bold text-white hover:bg-[#0B5B9F]">확인</button>
        </form>
      </main>
    );
  }

  const handleAddWalkIn = async () => {
    if (!walkInName.trim()) return;
    setAddingWalkIn(true);
    setSearchError('');
    try {
      const participant = await createPublicWalkIn(token, password, walkInName.trim(), walkInValues);
      setSelected(participant);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : '참석 정보를 저장하지 못했습니다.');
    } finally {
      setAddingWalkIn(false);
    }
  };

  const handleSubmit = async (
    participant: RegistryParticipant,
    dataUrl: string,
    source: SignatureSource,
    values: Record<string, string>,
  ) => {
    const { width, height } = await imageDimensions(dataUrl);
    await submitPublicSignature(token, password, participant.id, dataUrl, source, values, width, height);
    setSuccessName(participant.name);
    setSelected(null);
    setQuery('');
    setResults([]);
    setWalkInName('');
    setWalkInValues({});
  };

  if (successName) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-5">
        <div className="w-full max-w-md rounded-lg border border-[#DCE3EA] bg-white px-6 py-10 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[#126B32]" />
          <h1 className="mt-5 text-2xl font-extrabold text-[#0F172A]">서명이 제출되었습니다</h1>
          <p className="mt-2 text-sm text-[#526174]">{successName}님의 서명을 반영했습니다.</p>
          <button type="button" onClick={() => setSuccessName('')} className="mt-7 min-h-[48px] w-full rounded-lg border border-[#DCE3EA] text-sm font-bold text-[#334155] hover:bg-[#F6F8FB]">다른 사람 서명하기</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F6F8FB]">
      <header className="border-b border-[#DCE3EA] bg-white">
        <div className="mx-auto max-w-xl px-5 py-6">
          <p className="text-xs font-bold text-[#0F6CBD]">온라인 등록부</p>
          <h1 className="mt-2 text-xl font-extrabold leading-snug text-[#0F172A] sm:text-2xl sm:leading-tight">{registry.title}</h1>
          <div className="mt-4 grid gap-1 text-sm leading-6 text-[#526174]">
            {registry.leftHeader ? <p className="whitespace-pre-line">{registry.leftHeader}</p> : null}
            {registry.rightHeader ? <p className="whitespace-pre-line">{registry.rightHeader}</p> : null}
          </div>
          {registry.status === 'closed' ? <div className="mt-5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-bold text-[#B42318]">서명 수합이 종료되었습니다.</div> : null}
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5 py-6">
        {registry.status === 'open' && registry.mode === 'fixed' ? (
          <section>
            <h2 className="text-lg font-extrabold text-[#0F172A]">내 이름 찾기</h2>
            <p className="mt-1 text-sm text-[#526174]">이름이나 소속을 두 글자 이상 입력해 주세요.</p>
            <label className="relative mt-5 block"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#526174]" /><input className={`${inputClass} pl-12`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 소속 검색" aria-label="이름 또는 소속 검색" autoComplete="off" /></label>
            {query.trim().length >= 2 ? (
              <div className="mt-4 divide-y divide-[#EEF1F4] border-y border-[#DCE3EA] bg-white">
                {searching ? <div className="flex items-center justify-center gap-2 px-4 py-7 text-sm text-[#526174]"><LoaderCircle className="h-4 w-4 animate-spin" />검색 중</div> : results.length > 0 ? results.map((participant) => (
                  <button key={participant.id} type="button" disabled={Boolean(participant.signature)} onClick={() => setSelected(participant)} className="flex min-h-[68px] w-full items-center justify-between gap-4 px-4 text-left hover:bg-[#F8FAFC] disabled:cursor-default disabled:bg-[#F8FAFC]">
                    <span><span className="block text-base font-bold text-[#0F172A]">{maskName(participant.name)}</span><span className="mt-1 block text-xs text-[#526174]">{registry.columns.map((column) => maskValue(participant.values[column.id] ?? '')).filter(Boolean).join(' · ') || '추가 정보 없음'}</span></span>
                    <span className={`shrink-0 text-xs font-bold ${participant.signature ? 'text-[#126B32]' : 'text-[#0F6CBD]'}`}>{participant.signature ? '서명 완료' : '선택'}</span>
                  </button>
                )) : <div className="px-4 py-7 text-center text-sm text-[#526174]">일치하는 참석자가 없습니다.</div>}
              </div>
            ) : null}
          </section>
        ) : null}

        {searchError ? <p role="alert" className="mt-4 text-sm font-semibold text-[#B42318]">{searchError}</p> : null}

        {registry.status === 'open' && canAddWalkIn ? (
          <section className={registry.mode === 'fixed' ? 'mt-8 border-t border-[#DCE3EA] pt-7' : ''}>
            <div className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-[#0F6CBD]" /><h2 className="text-lg font-extrabold text-[#0F172A]">{registry.mode === 'fixed' ? '명단에 이름이 없나요?' : '참석 정보 입력'}</h2></div>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-[#334155]">성명<input className={inputClass} value={walkInName} onChange={(event) => setWalkInName(event.target.value)} placeholder="성명을 입력해 주세요" /></label>
              {registry.columns.map((column) => <label key={column.id} className="grid gap-2 text-sm font-bold text-[#334155]">{column.label}<input className={inputClass} value={walkInValues[column.id] ?? ''} onChange={(event) => setWalkInValues((current) => ({ ...current, [column.id]: event.target.value }))} placeholder={`${column.label} 입력`} /></label>)}
              <button type="button" disabled={!walkInName.trim() || addingWalkIn} onClick={() => void handleAddWalkIn()} className="mt-1 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-base font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]">{addingWalkIn ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}{addingWalkIn ? '저장 중' : '정보 확인 후 서명하기'}</button>
            </div>
          </section>
        ) : null}
      </div>

      {selected && !selected.signature ? <SignatureDialog registry={registry} participant={selected} onClose={() => setSelected(null)} onSubmit={(dataUrl, source, values) => handleSubmit(selected, dataUrl, source, values)} /> : null}
    </main>
  );
}
