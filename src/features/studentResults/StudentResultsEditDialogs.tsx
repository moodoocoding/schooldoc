import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { ResultColumn, ResultRecipient, StudentResultEvent, StudentResultEventSettings } from './types';
import { isTotalResultColumn } from './studentResultsUtils';

function EditDialogFrame({ title, onClose, saving, children }: {
  title: string;
  onClose: () => void;
  saving: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const savingRef = useRef(saving);
  onCloseRef.current = onClose;
  savingRef.current = saving;
  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingRef.current) onCloseRef.current();
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)') ?? []);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); returnFocus?.focus(); };
  }, []);

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0F172A]/50 p-3 sm:p-5">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto overflow-x-hidden rounded-xl border border-[#DCE3EA] bg-white p-5 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><h2 className="text-xl font-extrabold">{title}</h2><button type="button" disabled={saving} onClick={onClose} aria-label="수정 창 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#526174] hover:bg-[#F6F8FB]"><X className="h-5 w-5" /></button></div>
      {children}
    </div>
  </div>;
}

export function StudentResultSettingsDialog({ event, onSave, onClose }: {
  event: StudentResultEvent;
  onSave: (settings: StudentResultEventSettings) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [allowConfirmation, setAllowConfirmation] = useState(event.allowConfirmation);
  const [allowDispute, setAllowDispute] = useState(event.allowDispute);
  const [columns, setColumns] = useState<(Omit<ResultColumn, 'maxScore'> & { maxScore: number | '' })[]>(event.columns);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!title.trim()) { setError('제목을 입력해 주세요.'); return; }
    if (columns.some((column) => !column.label.trim() || column.maxScore === '' || !Number.isFinite(column.maxScore) || column.maxScore <= 0
      || event.recipients.some((recipient) => recipient.values[column.id] > Number(column.maxScore)))) {
      setError('항목명·배점을 확인해 주세요. 배점은 학생 점수보다 낮출 수 없습니다.');
      return;
    }
    setSaving(true);
    setError('');
    try { await onSave({ title, description, allowConfirmation, allowDispute, columns: columns.map((column) => ({ ...column, maxScore: Number(column.maxScore) })) }); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : '안내를 수정하지 못했습니다.'); }
    finally { setSaving(false); }
  };
  return <EditDialogFrame title="안내 정보 수정" onClose={onClose} saving={saving}>
    <p className="mt-2 text-sm leading-6 text-[#526174]">기존 학생 링크와 응답을 유지한 채 제목·안내·배점·운영 방식을 수정합니다.</p>
    <form onSubmit={(event) => void save(event)} className="mt-5 space-y-5">
      <label className="block text-sm font-bold">제목<input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 font-normal" /></label>
      <label className="block text-sm font-bold">학생 안내 문구<textarea value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-[#C8D0DA] p-3 font-normal" /></label>
      <div className="flex flex-wrap gap-5 text-sm font-semibold"><label className="inline-flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={allowConfirmation} onChange={(event) => setAllowConfirmation(event.target.checked)} />결과 확인 받기</label><label className="inline-flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={allowDispute} onChange={(event) => setAllowDispute(event.target.checked)} />이의 제기 받기</label></div>
      <fieldset className="space-y-3"><legend className="text-sm font-bold">결과 항목과 배점</legend>{columns.map((column, index) => <div key={column.id} className="grid gap-2 rounded-lg border border-[#DCE3EA] p-3 sm:grid-cols-[minmax(0,1fr)_100px_110px]">
        <label className="text-xs font-bold text-[#526174]">{index + 1}번 항목명<input value={column.label} maxLength={100} onChange={(event) => setColumns((current) => current.map((item) => item.id === column.id ? { ...item, label: event.target.value } : item))} className="mt-1 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-2 text-sm font-normal text-[#0F172A]" /></label>
        <label className="text-xs font-bold text-[#526174]">배점<input type="number" min={1} max={1000000} value={column.maxScore} onChange={(event) => setColumns((current) => current.map((item) => item.id === column.id ? { ...item, maxScore: event.target.value === '' ? '' : Number(event.target.value) } : item))} className="mt-1 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-2 text-sm font-normal text-[#0F172A]" /></label>
        <label className="text-xs font-bold text-[#526174]">종류<select value={isTotalResultColumn({ ...column, maxScore: Number(column.maxScore) }) ? 'total' : 'score'} onChange={(event) => setColumns((current) => current.map((item) => ({ ...item, kind: item.id === column.id ? event.target.value as 'score' | 'total' : event.target.value === 'total' ? 'score' : item.kind })))} className="mt-1 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] bg-white px-2 text-sm font-normal text-[#0F172A]"><option value="score">개별 점수</option><option value="total">총점</option></select></label>
        <label className="text-xs font-bold text-[#526174] sm:col-span-3">설명 (선택)<input value={column.description} maxLength={1000} onChange={(event) => setColumns((current) => current.map((item) => item.id === column.id ? { ...item, description: event.target.value } : item))} className="mt-1 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-2 text-sm font-normal text-[#0F172A]" /></label>
      </div>)}</fieldset>
      {error ? <p role="alert" className="flex gap-2 text-sm font-semibold text-[#B42318]"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p> : null}
      <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={onClose} className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-4 text-sm font-bold">취소</button><button type="submit" disabled={saving} className="min-h-[44px] rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white disabled:opacity-50">{saving ? '저장 중' : '변경 저장'}</button></div>
    </form>
  </EditDialogFrame>;
}

export function StudentResultRecipientDialog({ event, recipient, onSave, onClose }: {
  event: StudentResultEvent;
  recipient: ResultRecipient;
  onSave: (values: Record<string, number>, feedback: string, reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, number | ''>>(recipient.values);
  const [feedback, setFeedback] = useState(recipient.feedback);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!reason.trim() || event.columns.some((column) => values[column.id] === '' || !Number.isFinite(values[column.id]) || Number(values[column.id]) < 0 || Number(values[column.id]) > column.maxScore)) {
      setError('수정 사유를 입력하고 점수가 배점 범위에 있는지 확인해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try { await onSave(Object.fromEntries(Object.entries(values).map(([id, value]) => [id, Number(value)])), feedback, reason); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : '학생 결과를 수정하지 못했습니다.'); }
    finally { setSaving(false); }
  };
  return <EditDialogFrame title={`${recipient.name} 학생 결과 수정`} onClose={onClose} saving={saving}>
    <p className="mt-2 text-sm leading-6 text-[#526174]">{recipient.studentKey} · 학생이 이미 확인했다면 변경 후 재확인 필요로 표시합니다.</p>
    <form onSubmit={(event) => void save(event)} className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">{event.columns.map((column) => <label key={column.id} className="text-sm font-bold">{column.label} / {column.maxScore}<input type="number" min={0} max={column.maxScore} value={values[column.id] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [column.id]: event.target.value === '' ? '' : Number(event.target.value) }))} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 font-normal" /></label>)}</div>
      <label className="block text-sm font-bold">교사 의견<textarea value={feedback} maxLength={10000} onChange={(event) => setFeedback(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-[#C8D0DA] p-3 font-normal" /></label>
      <label className="block text-sm font-bold">수정 사유<input value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} placeholder="예: 채점표 대조 후 국어 점수 정정" className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 font-normal" /></label>
      {recipient.revisions?.length ? <details className="border-t border-[#DCE3EA] pt-4 text-sm"><summary className="cursor-pointer font-bold">이전 수정 기록 {recipient.revisions.length}건</summary><ol className="mt-3 space-y-3">{recipient.revisions.toReversed().map((revision, index) => <li key={`${revision.changedAt}-${index}`} className="rounded-lg bg-[#F6F8FB] p-3"><p className="font-semibold">{new Date(revision.changedAt).toLocaleString('ko-KR')} · {revision.reason}</p><p className="mt-1 text-xs text-[#526174]">{event.columns.map((column) => `${column.label} ${revision.before.values[column.id]}→${revision.after.values[column.id]}`).join(' · ')}</p></li>)}</ol></details> : null}
      {error ? <p role="alert" className="flex gap-2 text-sm font-semibold text-[#B42318]"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p> : null}
      <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={onClose} className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-4 text-sm font-bold">취소</button><button type="submit" disabled={saving} className="min-h-[44px] rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white disabled:opacity-50">{saving ? '저장 중' : '결과 정정 저장'}</button></div>
    </form>
  </EditDialogFrame>;
}
