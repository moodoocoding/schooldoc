import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, FileCheck2, LockKeyhole, Send } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  authenticatePublicStudentResult,
  authenticatePublicStudentResultByToken,
  confirmPublicStudentResult,
  disputePublicStudentResult,
  loadPublicStudentResultMetadata,
  type StudentResultMetadata,
} from './studentResultsPublicApi';
import type { PublicStudentResult } from './types';

export function PublicStudentResultPage() {
  const { token = '' } = useParams();
  const [searchParams] = useSearchParams();
  const personalToken = searchParams.get('recipient');
  const [metadata, setMetadata] = useState<StudentResultMetadata | null>(null);
  const [result, setResult] = useState<PublicStudentResult | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [dispute, setDispute] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const loaded = await loadPublicStudentResultMetadata(token);
        if (!active) return;
        setMetadata(loaded);
        if (personalToken && loaded?.status === 'open') {
          const authenticated = await authenticatePublicStudentResultByToken(token, personalToken);
          if (!active) return;
          if (!authenticated) throw new Error('조회 링크가 만료되었거나 올바르지 않습니다.');
          setResult(authenticated.result);
          setSessionToken(authenticated.sessionToken);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : '결과 안내를 불러오지 못했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [personalToken, token]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const authenticated = await authenticatePublicStudentResult(token, name, code);
      if (!authenticated) throw new Error('입력한 정보를 확인해 주세요. 이름 또는 확인번호가 일치하지 않습니다.');
      setError('');
      setResult(authenticated.result);
      setSessionToken(authenticated.sessionToken);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '학생 정보를 확인하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirm = async () => {
    if (!result || !sessionToken) return;
    setSubmitting(true);
    try {
      const updated = await confirmPublicStudentResult(sessionToken, result.event.id, result.recipient.id);
      if (updated) setResult(updated.result);
      setError('');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '결과 확인을 처리하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDispute = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!result || !sessionToken || !dispute.trim()) return;
    setSubmitting(true);
    try {
      const updated = await disputePublicStudentResult(sessionToken, result.event.id, result.recipient.id, dispute);
      if (updated) setResult(updated.result);
      setDispute('');
      setError('');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '이의 내용을 제출하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#F6F8FB] px-4"><p className="text-sm font-semibold text-[#526174]">결과 안내를 불러오는 중입니다.</p></main>;
  if (!metadata) return <main className="grid min-h-screen place-items-center bg-[#F6F8FB] px-4"><div className="w-full max-w-md border-y border-[#DCE3EA] bg-white px-6 py-12 text-center"><AlertCircle className="mx-auto h-8 w-8 text-[#B42318]" /><h1 className="mt-4 text-xl font-extrabold">결과 안내를 찾을 수 없습니다</h1><p className="mt-2 text-sm text-[#526174]">{error || '선생님에게 올바른 링크를 다시 요청해 주세요.'}</p></div></main>;
  if (metadata.status === 'closed') return <main className="grid min-h-screen place-items-center bg-[#F6F8FB] px-4"><div className="w-full max-w-md border-y border-[#DCE3EA] bg-white px-6 py-12 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-[#64748B]" /><h1 className="mt-4 text-xl font-extrabold">종료된 결과 안내입니다</h1><p className="mt-2 text-sm text-[#526174]">추가 확인이 필요하면 선생님에게 문의해 주세요.</p></div></main>;

  if (!result) return (
    <main className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:py-16">
      <section className="mx-auto w-full max-w-md border-y border-[#DCE3EA] bg-white px-5 py-8 sm:px-7">
        <LockKeyhole className="h-9 w-9 text-[#0F6CBD]" />
        <p className="mt-5 text-xs font-bold text-[#0F6CBD]">학생 개별 조회</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#0F172A]">{metadata.title}</h1>
        {metadata.description ? <p className="mt-3 text-sm leading-6 text-[#526174]">{metadata.description}</p> : null}
        <form onSubmit={(event) => void login(event)} className="mt-7 space-y-4">
          <label className="block text-sm font-bold">성명<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 min-h-[48px] w-full rounded-lg border border-[#C8D0DA] px-3 font-normal" /></label>
          <label className="block text-sm font-bold">확인번호<input type="password" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} className="mt-2 min-h-[48px] w-full rounded-lg border border-[#C8D0DA] px-3 font-normal" /></label>
          {error ? <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p> : null}
          <button type="submit" disabled={submitting} className="min-h-[48px] w-full rounded-lg bg-[#0F6CBD] text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]">{submitting ? '확인 중' : '내 결과 조회'}</button>
        </form>
        <p className="mt-6 border-t border-[#EEF1F4] pt-4 text-xs leading-5 text-[#64748B]">전달받은 본인 확인번호만 사용하세요. 다른 학생의 결과는 조회할 수 없습니다.</p>
      </section>
    </main>
  );

  const total = result.event.columns.reduce((sum, column) => sum + (result.recipient.values[column.id] ?? 0), 0);
  const maxTotal = result.event.columns.reduce((sum, column) => sum + column.maxScore, 0);
  return (
    <main className="min-h-screen bg-[#F6F8FB] px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <header className="border-y border-[#DCE3EA] bg-white px-5 py-6 sm:px-7"><p className="text-xs font-bold text-[#0F6CBD]">개별 결과 안내</p><h1 className="mt-2 text-2xl font-extrabold">{result.event.title}</h1><p className="mt-2 text-sm text-[#526174]">{result.recipient.name} · {result.recipient.studentKey}</p></header>
        <section className="border-y border-[#DCE3EA] bg-white"><div className="flex items-center justify-between border-b border-[#DCE3EA] px-5 py-4"><h2 className="font-bold">결과 항목</h2><span className="text-lg font-extrabold text-[#0F6CBD]">{total} / {maxTotal}</span></div>{result.event.columns.map((column) => <div key={column.id} className="border-b border-[#EEF1F4] px-5 py-4 last:border-0"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-bold">{column.label}</h3>{column.description ? <p className="mt-1 text-xs text-[#64748B]">{column.description}</p> : null}</div><strong className="shrink-0 text-sm">{result.recipient.values[column.id]} / {column.maxScore}</strong></div></div>)}</section>
        {result.recipient.feedback ? <section className="border-y border-[#DCE3EA] bg-white px-5 py-5"><h2 className="text-sm font-bold">교사 의견</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#334155]">{result.recipient.feedback}</p></section> : null}
        {result.recipient.dispute?.teacherReply ? <section className="border-y border-[#B9D9F2] bg-[#EFF6FC] px-5 py-5"><h2 className="text-sm font-bold text-[#0F6CBD]">이의 제기 답변</h2><p className="mt-2 text-sm leading-6">{result.recipient.dispute.teacherReply}</p></section> : null}
        {error ? <p role="alert" className="border-y border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-sm font-semibold text-[#B42318]">{error}</p> : null}
        {result.recipient.status === 'confirmed' ? <div className="flex items-center gap-2 border-y border-[#A9D8B8] bg-[#E6F4EA] px-5 py-4 text-sm font-bold text-[#126B32]"><CheckCircle2 className="h-5 w-5" />결과 확인을 완료했습니다.</div> : result.recipient.status === 'disputed' ? <div className="border-y border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-sm font-semibold text-[#B42318]">이의 내용을 제출했습니다. 교사 답변을 기다려 주세요.</div> : <section className="border-y border-[#DCE3EA] bg-white px-5 py-5"><div className="grid gap-3 sm:grid-cols-2">{result.event.allowConfirmation ? <button type="button" disabled={submitting} onClick={() => void confirm()} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] text-sm font-bold text-white disabled:bg-[#AAB7C4]"><FileCheck2 className="h-5 w-5" />내용 확인 완료</button> : null}{result.event.allowDispute ? <form onSubmit={(event) => void submitDispute(event)} className="sm:col-span-2"><label className="text-sm font-bold">이의 내용<textarea value={dispute} onChange={(event) => setDispute(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-[#C8D0DA] p-3 font-normal" placeholder="확인이 필요한 내용을 구체적으로 적어 주세요." /></label><button type="submit" disabled={submitting || !dispute.trim()} className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#0F6CBD] px-4 text-sm font-bold text-[#0F6CBD] disabled:opacity-40"><Send className="h-4 w-4" />이의 제출</button></form> : null}</div></section>}
      </div>
    </main>
  );
}
