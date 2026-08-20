import { useState } from 'react';
import { AlertCircle, ArrowLeft, FileUp, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { dataCollectOwnerId } from './dataCollectConfig';
import { createDataCollection } from './dataCollectService';
import { DATA_COLLECTION_KIND_LABELS, DATA_COLLECTION_TARGET_LABELS, validateCollectionFile } from './dataCollectUtils';
import type { DataCollectionKind } from './types';

export function DataCollectCreatePage() {
  const navigate = useNavigate();
  const { user } = useTeacherAuth();
  const [kind, setKind] = useState<DataCollectionKind>('worksheet');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceFile, setSourceFile] = useState<File>();
  const [targets, setTargets] = useState([{ label: '', owner: '' }]);
  const [dueAt, setDueAt] = useState('');
  const [password, setPassword] = useState('');
  const [allowResubmit, setAllowResubmit] = useState(true);
  const [retentionMonths, setRetentionMonths] = useState(12);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [labelHeader, ownerHeader] = DATA_COLLECTION_TARGET_LABELS[kind];

  const chooseSource = async (file?: File) => {
    if (!file) return;
    try { await validateCollectionFile(file); setSourceFile(file); setError(''); }
    catch (fileError) { setSourceFile(undefined); setError(fileError instanceof Error ? fileError.message : '파일을 확인하지 못했습니다.'); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ownerId = dataCollectOwnerId(user?.id);
    const cleanedTargets = targets.filter((target) => target.label.trim());
    if (!title.trim()) { setError('수합 제목을 입력해 주세요.'); return; }
    if (cleanedTargets.length === 0) { setError(`${labelHeader}을(를) 한 명 이상 입력해 주세요.`); return; }
    if (new Set(cleanedTargets.map((target) => `${target.label.trim()}\u0000${target.owner.trim()}`)).size !== cleanedTargets.length) { setError('같은 제출 대상과 담당자를 중복해 넣을 수 없습니다.'); return; }
    try {
      setSaving(true); setError('');
      const created = await createDataCollection(ownerId, { title, description, kind, targets: cleanedTargets, dueAt, password, allowResubmit, retentionMonths }, sourceFile);
      navigate(`/tools/data-collect/${created.id}`);
    } catch (creationError) { setError(creationError instanceof Error ? creationError.message : '자료 수합을 만들지 못했습니다.'); }
    finally { setSaving(false); }
  };

  return <form onSubmit={submit} className="mx-auto w-full max-w-5xl space-y-6 pb-12">
    <div className="border-b border-[#DCE3EA] pb-4"><button type="button" onClick={() => navigate('/tools/data-collect')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />자료 수합 목록</button></div>
    <div><p className="text-xs font-bold text-[#0F6CBD]">새 업무</p><h1 className="mt-1 text-2xl font-extrabold">자료 수합 만들기</h1><p className="mt-2 text-sm text-[#526174]">파일을 배포하면 받는 선생님은 이상 없음 또는 수정본으로 회신합니다.</p></div>
    {error ? <div role="alert" className="flex gap-2 border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div> : null}
    <section className="rounded-lg border border-[#DCE3EA] bg-white p-5 sm:p-6"><h2 className="text-lg font-bold">1. 종류와 안내</h2><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{(Object.keys(DATA_COLLECTION_KIND_LABELS) as DataCollectionKind[]).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={`min-h-[44px] rounded-lg border px-3 text-sm font-bold ${kind === value ? 'border-[#0F6CBD] bg-[#EFF6FC] text-[#0F6CBD]' : 'border-[#DCE3EA] text-[#334155]'}`}>{DATA_COLLECTION_KIND_LABELS[value]}</button>)}</div><label className="mt-5 block text-sm font-bold">제목<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 font-normal" placeholder="예: 2학기 평가 문항 검토" /></label><label className="mt-4 block text-sm font-bold">안내<textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-28 w-full rounded-lg border border-[#C8D0DA] p-3 font-normal" placeholder="확인할 내용과 제출 기준을 적어 주세요." /></label></section>
    <section className="rounded-lg border border-[#DCE3EA] bg-white p-5 sm:p-6"><h2 className="text-lg font-bold">2. 배포 파일</h2><p className="mt-1 text-sm text-[#526174]">선택 사항입니다. 파일이 있으면 받는 사람이 확인 후 이상 없음 또는 수정본으로 회신합니다.</p><label className="mt-4 flex min-h-[88px] cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-[#94A3B8] bg-[#F8FAFC] px-4 text-sm font-bold text-[#334155]"><FileUp className="h-5 w-5 text-[#0F6CBD]" />{sourceFile ? sourceFile.name : '배포할 파일 선택'}<input type="file" className="sr-only" accept=".hwp,.hwpx,.docx,.xlsx,.pdf,.png,.jpg,.jpeg" onChange={(event) => void chooseSource(event.target.files?.[0])} /></label></section>
    <section className="rounded-lg border border-[#DCE3EA] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">3. 받을 사람</h2><p className="mt-1 text-sm text-[#526174]">{labelHeader}과 {ownerHeader}를 입력합니다.</p></div><button type="button" onClick={() => setTargets((current) => [...current, { label: '', owner: '' }])} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD]"><Plus className="h-4 w-4" />행 추가</button></div><div className="mt-4 space-y-2">{targets.map((target, index) => <div key={index} className="grid grid-cols-[1fr_1fr_40px] gap-2"><input aria-label={`${index + 1}번 ${labelHeader}`} value={target.label} onChange={(event) => setTargets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} className="min-h-[44px] min-w-0 rounded-lg border border-[#C8D0DA] px-3 text-sm" placeholder={labelHeader} /><input aria-label={`${index + 1}번 ${ownerHeader}`} value={target.owner} onChange={(event) => setTargets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, owner: event.target.value } : item))} className="min-h-[44px] min-w-0 rounded-lg border border-[#C8D0DA] px-3 text-sm" placeholder={ownerHeader} /><button type="button" onClick={() => setTargets((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))} className="flex h-11 w-10 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#FEF2F2] hover:text-[#B42318]" aria-label={`${index + 1}번 대상 삭제`}><Trash2 className="h-4 w-4" /></button></div>)}</div></section>
    <section className="rounded-lg border border-[#DCE3EA] bg-white p-5 sm:p-6"><h2 className="text-lg font-bold">4. 공유 설정</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">기한<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 font-normal" /></label><label className="text-sm font-bold">공개 비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 font-normal" placeholder="선택 사항" /></label><label className="text-sm font-bold">보관 기간<select value={retentionMonths} onChange={(event) => setRetentionMonths(Number(event.target.value))} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 font-normal"><option value={6}>6개월</option><option value={12}>12개월</option><option value={24}>24개월</option></select></label><label className="flex min-h-[44px] items-center gap-3 self-end text-sm font-bold"><input type="checkbox" checked={allowResubmit} onChange={(event) => setAllowResubmit(event.target.checked)} className="h-5 w-5" />수정해서 다시 제출 허용</label></div></section>
    <div className="flex justify-end"><button type="submit" disabled={saving} className="min-h-[48px] rounded-lg bg-[#0F6CBD] px-7 text-sm font-bold text-white disabled:opacity-60">{saving ? '만드는 중' : '자료 수합 만들기'}</button></div>
  </form>;
}
