import { useMemo, useState } from 'react';
import { CheckCircle2, LockKeyhole, PenLine, Search, UserPlus } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { RegistryConfirmDialog } from './RegistryConfirmDialog';
import { SignatureDialog } from './SignatureDialog';
import { isRegistryDemoMode } from './registryConfig';
import { submitWalkInSignature, submitSignature } from './registryStore';
import { maskName, maskValue } from './registryUtils';
import type { RegistryParticipant, SignatureSource, SignatureVerification } from './types';
import { useRegistryByToken } from './useRegistries';
import { RemotePublicRegistrySignPage } from './RemotePublicRegistrySignPage';

const inputClass = 'min-h-[52px] w-full rounded-lg border border-[#DCE3EA] bg-white px-4 text-base text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]/15';

export function PublicRegistrySignPage() {
  return isRegistryDemoMode ? <DemoPublicRegistrySignPage /> : <RemotePublicRegistrySignPage />;
}

function DemoPublicRegistrySignPage() {
  const { token } = useParams();
  const registry = useRegistryByToken(token);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<RegistryParticipant | null>(null);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [walkInName, setWalkInName] = useState('');
  const [walkInValues, setWalkInValues] = useState<Record<string, string>>({});
  const [successName, setSuccessName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(() => (
    token ? sessionStorage.getItem(`registry-unlocked-${token}`) === 'true' : false
  ));

  const searchResults = useMemo(() => {
    if (!registry || registry.mode !== 'fixed' || searchedQuery.trim().length < 2) return [];
    const keyword = searchedQuery.trim().toLocaleLowerCase('ko-KR');
    return registry.participants.filter((participant) => (
      participant.name.toLocaleLowerCase('ko-KR').includes(keyword)
      && (!searchCode.trim() || participant.verificationCode === searchCode.trim())
    )).slice(0, 20);
  }, [searchedQuery, searchCode, registry]);

  if (!registry) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-5">
        <div className="w-full max-w-md border-y border-[#DCE3EA] bg-white px-6 py-12 text-center">
          <PenLine className="mx-auto h-8 w-8 text-[#94A3B8]" />
          <h1 className="mt-4 text-xl font-extrabold text-[#0F172A]">등록부를 찾을 수 없습니다</h1>
          <p className="mt-2 text-sm text-[#526174]">링크가 정확한지 담당자에게 확인해 주세요.</p>
        </div>
      </main>
    );
  }

  if (registry.publicPassword && !isUnlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-5">
        <form className="w-full max-w-md rounded-lg border border-[#DCE3EA] bg-white p-6 shadow-sm" onSubmit={(event) => {
          event.preventDefault();
          if (password !== registry.publicPassword) {
            setPasswordError('비밀번호가 맞지 않습니다.');
            return;
          }
          if (token) sessionStorage.setItem(`registry-unlocked-${token}`, 'true');
          setIsUnlocked(true);
        }}>
          <LockKeyhole className="h-7 w-7 text-[#0F6CBD]" />
          <h1 className="mt-4 text-xl font-extrabold text-[#0F172A]">비밀번호 입력</h1>
          <p className="mt-2 text-sm text-[#526174]">이 등록부는 비밀번호로 보호되어 있습니다.</p>
          <label className="mt-6 grid gap-2 text-sm font-bold text-[#334155]">
            공개 링크 비밀번호
            <input type="password" autoFocus className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {passwordError ? <p role="alert" className="mt-3 text-sm font-semibold text-[#B42318]">{passwordError}</p> : null}
          <button type="submit" className="mt-5 min-h-[52px] w-full rounded-lg bg-[#0F6CBD] text-base font-bold text-white hover:bg-[#0B5B9F]">확인</button>
        </form>
      </main>
    );
  }

  const selectedParticipant = selected;
  const canAddWalkIn = registry.mode === 'custom' || registry.allowWalkIn;

  const handleAddWalkIn = (confirmed = false) => {
    if (!walkInName.trim()) return;
    const count = registry.participants.filter((p) => p.name === walkInName.trim()).length;
    if (count && !confirmed) { setDuplicateCount(count); return; }
    setDuplicateCount(0);
    setSelected({ id: crypto.randomUUID(), rowNumber: 0, name: walkInName.trim(), values: walkInValues });
  };
  const handleSubmit = (participant: RegistryParticipant, dataUrl: string, source: SignatureSource, values: Record<string, string>, verification: SignatureVerification) => {
    if (participant.rowNumber > 0) {
      const target = registry.participants.find((p) => p.id === participant.id)!;
      const peers = registry.participants.filter((p) => p.name === target.name);
      if (peers.length > 1 || target.verificationCode) {
        const codeMatches = Boolean(target.verificationCode && verification.code === target.verificationCode);
        const matches = peers.filter((p) => p.name === verification.verifyName.trim() && registry.columns.length > 0 && registry.columns.every((c) => Boolean(verification.verificationValues[c.id]?.trim()) && p.values[c.id] === verification.verificationValues[c.id]?.trim()));
        if (!codeMatches && (target.verificationCode || matches.length !== 1 || matches[0].id !== target.id)) throw new Error('본인 확인 정보가 일치하지 않습니다. 담당자에게 확인 코드를 받아 주세요.');
      }
      submitSignature(registry.id, { participantId: participant.id, dataUrl, source, values });
    } else submitWalkInSignature(registry.id, participant, { participantId: participant.id, dataUrl, source, values });
    setSuccessName(participant.name); setSelected(null); setQuery(''); setSearchCode(''); setSearchedQuery(''); setWalkInName(''); setWalkInValues({});
  };
  const selectParticipant = (participant: RegistryParticipant) => setSelected({ ...participant, name: maskName(participant.name), values: Object.fromEntries(Object.entries(participant.values).map(([key, value]) => [key, maskValue(value)])), requiresIdentity: registry.participants.filter((p) => p.name === participant.name).length > 1, requiresCode: Boolean(participant.verificationCode) });

  if (successName) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-5">
        <div className="w-full max-w-md rounded-lg border border-[#DCE3EA] bg-white px-6 py-10 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[#126B32]" />
          <h1 className="mt-5 text-2xl font-extrabold text-[#0F172A]">서명이 제출되었습니다</h1>
          <p className="mt-2 text-sm text-[#526174]">{successName}님의 서명을 안전하게 반영했습니다.</p>
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
          {registry.status === 'closed' ? (
            <div className="mt-5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-bold text-[#B42318]">서명 수합이 종료되었습니다.</div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5 py-6">
        {registry.status === 'open' && registry.mode === 'fixed' ? (
          <section>
            <h2 className="text-lg font-extrabold text-[#0F172A]">내 이름 찾기</h2>
            <p className="mt-1 text-sm text-[#526174]">이름을 두 글자 이상 입력하고 검색해 주세요.</p>
            <label className="relative mt-5 block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#526174]" />
              <input className={`${inputClass} pl-12`} value={query} onChange={(event) => { setQuery(event.target.value); setSearchedQuery(''); }} onKeyDown={(event) => { if (event.key === 'Enter') setSearchedQuery(query); }} placeholder="이름 검색" aria-label="이름 검색" autoComplete="off" />
            </label>

            <div className="mt-3 flex gap-2"><input className={inputClass} value={searchCode} onChange={(event) => { setSearchCode(event.target.value); setSearchedQuery(''); }} placeholder="확인 코드 (있는 경우)" aria-label="검색 확인 코드" inputMode="numeric" /><button type="button" disabled={query.trim().length < 2} onClick={() => setSearchedQuery(query)} className="min-h-[52px] shrink-0 rounded-lg bg-[#0F6CBD] px-5 font-bold text-white disabled:bg-[#AAB7C4]">검색</button></div>
            {searchedQuery ? (
              <div className="mt-4 divide-y divide-[#EEF1F4] border-y border-[#DCE3EA] bg-white">
                {searchResults.length > 0 ? searchResults.map((participant) => (
                  <button
                    key={participant.id}
                    type="button"
                    disabled={Boolean(participant.signature)}
                    onClick={() => selectParticipant(participant)}
                    className="flex min-h-[68px] w-full items-center justify-between gap-4 px-4 text-left hover:bg-[#F8FAFC] disabled:cursor-default disabled:bg-[#F8FAFC]"
                  >
                    <span>
                      <span className="block text-base font-bold text-[#0F172A]">{maskName(participant.name)}</span>
                      <span className="mt-1 block text-xs text-[#526174]">{registry.columns.map((column) => maskValue(participant.values[column.id] ?? '')).filter(Boolean).join(' · ') || '추가 정보 없음'}</span>
                    </span>
                    <span className={`shrink-0 text-xs font-bold ${participant.signature ? 'text-[#126B32]' : 'text-[#0F6CBD]'}`}>{participant.signature ? '서명 완료' : '선택'}</span>
                  </button>
                )) : (
                  <div className="px-4 py-7 text-center text-sm text-[#526174]">일치하는 참석자가 없습니다.</div>
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {registry.status === 'open' && canAddWalkIn ? (
          <section className={`${registry.mode === 'fixed' ? 'mt-8 border-t border-[#DCE3EA] pt-7' : ''}`}>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#0F6CBD]" />
              <h2 className="text-lg font-extrabold text-[#0F172A]">{registry.mode === 'fixed' ? '명단에 이름이 없나요?' : '참석 정보 입력'}</h2>
            </div>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-[#334155]">
                성명
                <input className={inputClass} value={walkInName} onChange={(event) => setWalkInName(event.target.value)} placeholder="성명을 입력해 주세요" />
              </label>
              {registry.columns.map((column) => (
                <label key={column.id} className="grid gap-2 text-sm font-bold text-[#334155]">
                  {column.label}
                  <input className={inputClass} value={walkInValues[column.id] ?? ''} onChange={(event) => setWalkInValues((current) => ({ ...current, [column.id]: event.target.value }))} placeholder={`${column.label} 입력`} />
                </label>
              ))}
              <button type="button" disabled={!walkInName.trim()} onClick={() => handleAddWalkIn()} className="mt-1 min-h-[52px] rounded-lg bg-[#0F6CBD] px-5 text-base font-bold text-white hover:bg-[#0B5B9F] disabled:cursor-not-allowed disabled:bg-[#AAB7C4]">정보 확인 후 서명하기</button>
            </div>
          </section>
        ) : null}
      </div>

      {duplicateCount > 0 ? <RegistryConfirmDialog title="같은 이름이 이미 있습니다" description={`같은 이름 ${duplicateCount}명이 등록되어 있습니다. 이미 서명하셨다면 담당자에게 확인해 주세요.`} confirmLabel="동명이인으로 추가" tone="primary" onCancel={() => setDuplicateCount(0)} onConfirm={() => handleAddWalkIn(true)} /> : null}
      {selectedParticipant && !selectedParticipant.signature ? (
        <SignatureDialog registry={registry} participant={selectedParticipant} initialCode={searchCode} onClose={() => setSelected(null)} onSubmit={(dataUrl, source, values, verification) => handleSubmit(selectedParticipant, dataUrl, source, values, verification)} />
      ) : null}
    </main>
  );
}
