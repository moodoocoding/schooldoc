import { useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ClipboardPaste, FileSpreadsheet, FileUp, ListPlus, Plus, Trash2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { dataCollectOwnerId } from './dataCollectConfig';
import { createDataCollection } from './dataCollectService';
import { parseDataCollectionPastedRows, parseDataCollectionRows, validateCollectionFile } from './dataCollectUtils';
import type { DataCollectionMode } from './types';

const inputClass = 'min-h-[44px] w-full rounded-lg border border-[#C8D0DA] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]/15';

export function DataCollectCreatePage() {
  const navigate = useNavigate();
  const { user } = useTeacherAuth();
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<DataCollectionMode>('fixed');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceFile, setSourceFile] = useState<File>();
  const [targets, setTargets] = useState([{ label: '', owner: '' }]);
  const [pasteText, setPasteText] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [password, setPassword] = useState('');
  const [allowResubmit, setAllowResubmit] = useState(true);
  const [retentionMonths, setRetentionMonths] = useState(12);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const chooseSource = async (file?: File) => {
    if (!file) return;
    try {
      await validateCollectionFile(file);
      setSourceFile(file);
      setError('');
    } catch (fileError) {
      setSourceFile(undefined);
      setError(fileError instanceof Error ? fileError.message : '파일을 확인하지 못했습니다.');
    }
  };

  const applyImportedLabels = (labels: string[]) => {
    if (labels.length === 0) {
      setError('명단에서 이름을 찾지 못했습니다. 이름 또는 성명 열을 확인해 주세요.');
      return;
    }
    setTargets(labels.map((label) => ({ label, owner: '' })));
    setPasteText('');
    setError('');
  };

  const importPaste = () => applyImportedLabels(parseDataCollectionPastedRows(pasteText));

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const labels = parseDataCollectionPastedRows(event.clipboardData.getData('text'));
    if (labels.length === 0) return;
    event.preventDefault();
    applyImportedLabels(labels);
  };

  const importExcel = async (file?: File) => {
    if (!file) return;
    try {
      const { readSheet } = await import('read-excel-file/web-worker');
      const rows = await readSheet(file);
      applyImportedLabels(parseDataCollectionRows(rows as unknown[][]));
    } catch (importError) {
      console.error('자료 수합 명단 엑셀을 읽지 못했습니다.', importError);
      setError('엑셀 파일을 읽지 못했습니다. 손상되지 않은 .xlsx 파일인지 확인해 주세요.');
    } finally {
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ownerId = dataCollectOwnerId(user?.id);
    const cleanedTargets = targets.map((target) => ({ label: target.label.trim(), owner: '' })).filter((target) => target.label);
    if (!title.trim()) {
      setError('수합 제목을 입력해 주세요.');
      return;
    }
    if (mode === 'fixed' && cleanedTargets.length === 0) {
      setError('명단 있음은 제출 대상을 한 명 이상 입력해야 합니다.');
      return;
    }
    if (new Set(cleanedTargets.map((target) => target.label.toLocaleLowerCase('ko-KR'))).size !== cleanedTargets.length) {
      setError('같은 제출 대상을 중복해 넣을 수 없습니다.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const created = await createDataCollection(ownerId, {
        title,
        description,
        kind: 'custom',
        mode,
        targets: mode === 'fixed' ? cleanedTargets : [],
        dueAt,
        password,
        allowResubmit,
        retentionMonths,
      }, sourceFile);
      navigate(`/tools/data-collect/${created.id}`);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : '자료 수합을 만들지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-5xl space-y-6 pb-12">
      <div className="border-b border-[#DCE3EA] pb-4">
        <button type="button" onClick={() => navigate('/tools/data-collect')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />자료 수합 목록</button>
      </div>
      <div><p className="text-xs font-bold text-[#0F6CBD]">새 업무</p><h1 className="mt-1 text-2xl font-extrabold">자료 수합 만들기</h1><p className="mt-2 text-sm text-[#526174]">제목과 안내를 직접 작성하고, 명단 방식에 따라 자료를 받습니다.</p></div>
      {error ? <div role="alert" className="flex gap-2 border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div> : null}

      <section className="rounded-lg border border-[#DCE3EA] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold">1. 기본 정보</h2>
        <label className="mt-5 block text-sm font-bold">제목<input aria-label="제목" value={title} onChange={(event) => setTitle(event.target.value)} className={`${inputClass} mt-2`} placeholder="예: 2학기 평가 문항 검토" /></label>
        <label className="mt-4 block text-sm font-bold">안내<textarea aria-label="안내" value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} mt-2 min-h-28 p-3`} placeholder="확인할 내용과 제출 기준을 적어 주세요." /></label>
      </section>

      <section className="rounded-lg border border-[#DCE3EA] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold">2. 명단 방식</h2>
        <p className="mt-1 text-sm text-[#526174]">등록부 서명처럼 미리 명단을 준비하거나, 제출자가 이름을 직접 입력할 수 있습니다.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" aria-pressed={mode === 'fixed'} onClick={() => setMode('fixed')} className={`min-h-28 rounded-lg border p-4 text-left ${mode === 'fixed' ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#DCE3EA] bg-white'}`}><Users className="h-5 w-5 text-[#0F6CBD]" /><span className="mt-3 block text-sm font-bold">명단 있음</span><span className="mt-1 block text-xs leading-5 text-[#526174]">받는 사람이 목록에서 본인을 찾아 자료를 제출합니다.</span></button>
          <button type="button" aria-pressed={mode === 'custom'} onClick={() => setMode('custom')} className={`min-h-28 rounded-lg border p-4 text-left ${mode === 'custom' ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#DCE3EA] bg-white'}`}><ListPlus className="h-5 w-5 text-[#0F6CBD]" /><span className="mt-3 block text-sm font-bold">명단 없음</span><span className="mt-1 block text-xs leading-5 text-[#526174]">제출자가 이름을 직접 입력하고 자료를 제출합니다.</span></button>
        </div>
      </section>

      <section className="rounded-lg border border-[#DCE3EA] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold">3. 제출 대상 명단</h2><p className="mt-1 text-sm text-[#526174]">{mode === 'fixed' ? '이름을 붙여 넣거나 Excel을 불러오면 이름/성명 열을 분석해 행으로 나눕니다.' : '명단이 없으므로 제출할 때 이름을 직접 입력합니다.'}</p></div>
          {mode === 'fixed' ? <button type="button" onClick={() => setTargets((current) => [...current, { label: '', owner: '' }])} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD]"><Plus className="h-4 w-4" />행 추가</button> : null}
        </div>
        {mode === 'fixed' ? <>
          <div className="mt-4 grid gap-3 rounded-lg border border-dashed border-[#C8D0DA] bg-[#F8FAFC] p-4 sm:grid-cols-[1fr_auto]">
            <label className="text-sm font-bold">명단 붙여넣기<textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} onPaste={handlePaste} className={`${inputClass} mt-2 min-h-24 p-3 font-normal`} placeholder="이름을 붙여 넣으면 자동으로 각 행에 반영됩니다." /></label>
            <button type="button" onClick={importPaste} className="inline-flex min-h-[44px] items-center justify-center gap-2 self-end rounded-lg bg-[#334155] px-4 text-xs font-bold text-white"><ClipboardPaste className="h-4 w-4" />행으로 반영</button>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-3 sm:col-span-2"><span className="text-xs text-[#526174]">Excel의 이름·성명 열을 자동으로 찾아 제출 대상에 넣습니다.</span><button type="button" onClick={() => excelInputRef.current?.click()} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#C8D0DA] bg-white px-3 text-xs font-bold text-[#334155]"><FileSpreadsheet className="h-4 w-4 text-[#0F6CBD]" />Excel 불러오기</button><input ref={excelInputRef} type="file" className="sr-only" accept=".xlsx" onChange={(event) => void importExcel(event.target.files?.[0])} /></div>
          </div>
          <div className="mt-4 space-y-2">{targets.map((target, index) => <div key={index} className="grid grid-cols-[1fr_40px] gap-2"><input aria-label={`${index + 1}번 제출 대상`} value={target.label} onChange={(event) => setTargets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} className={inputClass} placeholder="제출 대상" /><button type="button" onClick={() => setTargets((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))} className="flex h-11 w-10 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#FEF2F2] hover:text-[#B42318]" aria-label={`${index + 1}번 대상 삭제`}><Trash2 className="h-4 w-4" /></button></div>)}</div>
        </> : <div className="mt-4 flex min-h-20 items-center gap-3 rounded-lg bg-[#F8FAFC] px-4 text-sm text-[#526174]"><ListPlus className="h-5 w-5 text-[#0F6CBD]" />제출자가 공개 화면에서 이름을 입력하면 제출 대상이 자동으로 기록됩니다.</div>}
      </section>

      <section className="rounded-lg border border-[#DCE3EA] bg-white p-5 sm:p-6"><h2 className="text-lg font-bold">4. 배포 파일</h2><p className="mt-1 text-sm text-[#526174]">선택 사항입니다. 파일이 있으면 받는 사람이 확인 후 이상 없음 또는 수정본으로 회신합니다.</p><label className="mt-4 flex min-h-[88px] cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-[#94A3B8] bg-[#F8FAFC] px-4 text-sm font-bold text-[#334155]"><FileUp className="h-5 w-5 text-[#0F6CBD]" />{sourceFile ? sourceFile.name : '배포할 파일 선택'}<input type="file" className="sr-only" accept=".hwp,.hwpx,.docx,.xlsx,.pdf,.png,.jpg,.jpeg" onChange={(event) => void chooseSource(event.target.files?.[0])} /></label></section>

      <section className="rounded-lg border border-[#DCE3EA] bg-white p-5 sm:p-6"><h2 className="text-lg font-bold">5. 배포 설정</h2><p className="mt-1 text-sm text-[#526174]">배포 링크의 회신 기한과 제출 파일 보관 방식을 정합니다.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">회신 기한<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className={`${inputClass} mt-2 font-normal`} /></label><label className="text-sm font-bold">링크 비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} mt-2 font-normal`} placeholder="선택 사항" /></label><label className="text-sm font-bold">보관 기간<select value={retentionMonths} onChange={(event) => setRetentionMonths(Number(event.target.value))} className={`${inputClass} mt-2 font-normal`}><option value={6}>6개월</option><option value={12}>12개월</option><option value={24}>24개월</option></select></label><label className="flex min-h-[44px] items-center gap-3 self-end text-sm font-bold"><input type="checkbox" checked={allowResubmit} onChange={(event) => setAllowResubmit(event.target.checked)} className="h-5 w-5" />수정본 재제출 허용</label></div></section>

      <div className="flex justify-end"><button type="submit" disabled={saving} className="min-h-[48px] rounded-lg bg-[#0F6CBD] px-7 text-sm font-bold text-white disabled:opacity-60">{saving ? '만드는 중' : '자료 수합 만들기'}</button></div>
    </form>
  );
}
