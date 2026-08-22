import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, ClipboardPaste, FileSpreadsheet, FileUp, ListPlus, Plus, RotateCcw, Trash2, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { dataCollectOwnerId } from './dataCollectConfig';
import { createDataCollection } from './dataCollectService';
import { analyzeDataCollectionRows, validateCollectionFile, type DataCollectionImportAnalysis } from './dataCollectUtils';
import type { DataCollectionMode } from './types';

type TargetDraft = { label: string; owner: string };
type ImportMethod = 'paste' | 'excel' | 'manual';
type ImportStrategy = 'append' | 'replace';
type RequestType = 'upload' | 'review';
type FieldErrors = Partial<Record<'title' | 'targets' | 'source' | 'password', string>>;

interface SavedCreateDraft {
  version: 2;
  title: string;
  description: string;
  mode: DataCollectionMode;
  targets: TargetDraft[];
  importMethod: ImportMethod;
  importStrategy: ImportStrategy;
  requestType: RequestType;
  dueAt: string;
  allowResubmit: boolean;
}

const DRAFT_KEY = 'schooldoc_data_collect_create_v2';
const inputClass = 'min-h-[44px] w-full rounded-lg border border-[#C8D0DA] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:border-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]/20';
const radioCardClass = 'relative block min-h-[112px] cursor-pointer rounded-lg border p-4 focus-within:ring-2 focus-within:ring-[#0F6CBD] focus-within:ring-offset-2';

const normalizeTarget = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');

const defaultDueAt = () => {
  const due = new Date();
  due.setDate(due.getDate() + 7);
  due.setHours(17, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}`;
};

const readSavedDraft = (): SavedCreateDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<SavedCreateDraft> | null;
    if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.targets)) return null;
    return {
      version: 2,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      mode: parsed.mode === 'custom' ? 'custom' : 'fixed',
      targets: parsed.targets.map((target) => ({ label: String(target?.label ?? ''), owner: String(target?.owner ?? '') })),
      importMethod: ['paste', 'excel', 'manual'].includes(String(parsed.importMethod)) ? parsed.importMethod as ImportMethod : 'paste',
      importStrategy: parsed.importStrategy === 'replace' ? 'replace' : 'append',
      requestType: parsed.requestType === 'review' ? 'review' : 'upload',
      dueAt: typeof parsed.dueAt === 'string' ? parsed.dueAt : defaultDueAt(),
      allowResubmit: parsed.allowResubmit !== false,
    };
  } catch {
    return null;
  }
};

const importRowsFromText = (text: string) => text.split(/\r?\n/).map((line) => line.split(/\t|,/));

const formatFileSize = (size: number) => size < 1024 * 1024
  ? `${Math.max(1, Math.round(size / 1024))}KB`
  : `${(size / 1024 / 1024).toFixed(1)}MB`;

const formatDueSummary = (value: string) => {
  if (!value) return '기한 없음';
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(due);
};

export function DataCollectCreatePage() {
  const navigate = useNavigate();
  const { user } = useTeacherAuth();
  const [savedDraft] = useState(readSavedDraft);
  const [showRestoreNotice, setShowRestoreNotice] = useState(Boolean(savedDraft));
  const [mode, setMode] = useState<DataCollectionMode>(savedDraft?.mode ?? 'fixed');
  const [title, setTitle] = useState(savedDraft?.title ?? '');
  const [description, setDescription] = useState(savedDraft?.description ?? '');
  const [targets, setTargets] = useState<TargetDraft[]>(savedDraft?.targets ?? []);
  const [importMethod, setImportMethod] = useState<ImportMethod>(savedDraft?.importMethod ?? 'paste');
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>(savedDraft?.importStrategy ?? 'append');
  const [requestType, setRequestType] = useState<RequestType>(savedDraft?.requestType ?? 'upload');
  const [sourceFile, setSourceFile] = useState<File>();
  const [pasteText, setPasteText] = useState('');
  const [excelRows, setExcelRows] = useState<unknown[][]>();
  const [excelColumn, setExcelColumn] = useState<number>();
  const [excelLoading, setExcelLoading] = useState(false);
  const [previousTargets, setPreviousTargets] = useState<TargetDraft[]>();
  const [importNotice, setImportNotice] = useState('');
  const [importError, setImportError] = useState('');
  const [fileError, setFileError] = useState('');
  const [dueAt, setDueAt] = useState(savedDraft?.dueAt ?? defaultDueAt());
  const [password, setPassword] = useState('');
  const [allowResubmit, setAllowResubmit] = useState(savedDraft?.allowResubmit ?? true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const targetSectionRef = useRef<HTMLDivElement>(null);
  const sourceButtonRef = useRef<HTMLButtonElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const cleanedTargets = useMemo(() => targets
    .map((target) => ({ label: target.label.trim(), owner: target.owner.trim() }))
    .filter((target) => target.label), [targets]);
  const duplicateLabelKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const target of cleanedTargets) {
      const key = normalizeTarget(target.label);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
  }, [cleanedTargets]);
  const excelAnalysis = useMemo<DataCollectionImportAnalysis | null>(() => (
    excelRows ? analyzeDataCollectionRows(excelRows, excelColumn) : null
  ), [excelColumn, excelRows]);

  useEffect(() => {
    // 대량 명단을 편집할 때마다 동기식 Storage 쓰기가 반복되지 않도록 잠시 모아서 저장한다.
    const timeout = window.setTimeout(() => {
      const hasMeaningfulContent = Boolean(title.trim() || description.trim() || targets.some((target) => target.label.trim()));
      if (!hasMeaningfulContent) {
        window.localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const draft: SavedCreateDraft = {
        version: 2,
        title,
        description,
        mode,
        targets,
        importMethod,
        importStrategy,
        requestType,
        dueAt,
        allowResubmit,
      };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [allowResubmit, description, dueAt, importMethod, importStrategy, mode, requestType, targets, title]);

  const clearFieldError = (key: keyof FieldErrors) => {
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError('');
  };

  const focusError = (key: keyof FieldErrors) => {
    window.requestAnimationFrame(() => {
      const element = key === 'title' ? titleRef.current
        : key === 'targets' ? targetSectionRef.current
          : key === 'source' ? sourceButtonRef.current
            : passwordRef.current;
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      element?.focus();
    });
  };

  const applyImportedLabels = (analysis: DataCollectionImportAnalysis, source: '붙여넣기' | 'Excel') => {
    if (analysis.labels.length === 0) {
      setImportError('이름을 찾지 못했습니다. 이름 또는 성명 열을 확인해 주세요.');
      return;
    }
    const existing = targets.filter((target) => target.label.trim());
    const imported = analysis.labels.map((label) => ({ label, owner: '' }));
    const next = importStrategy === 'append' && existing.length > 0 ? [...existing, ...imported] : imported;
    setPreviousTargets(targets);
    setTargets(next);
    setPasteText('');
    setImportError('');
    clearFieldError('targets');
    const duplicateCount = next.length - new Set(next.map((target) => normalizeTarget(target.label))).size;
    setImportNotice(`${source}에서 ${analysis.labels.length}명을 반영했습니다.${analysis.excludedCount ? ` 제외 ${analysis.excludedCount}행.` : ''}${duplicateCount ? ` 같은 이름 ${duplicateCount}건은 구분 정보를 입력해 주세요.` : ''}`);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData('text');
    const analysis = analyzeDataCollectionRows(importRowsFromText(text));
    if (analysis.labels.length === 0) return;
    event.preventDefault();
    applyImportedLabels(analysis, '붙여넣기');
  };

  const importExcel = async (file?: File) => {
    if (!file) return;
    try {
      setExcelLoading(true);
      setImportError('');
      const { readSheet } = await import('read-excel-file/web-worker');
      const rows = await readSheet(file) as unknown[][];
      const analysis = analyzeDataCollectionRows(rows);
      setExcelRows(rows);
      setExcelColumn(analysis.selectedColumn);
      if (analysis.labels.length === 0) setImportError('Excel에서 이름을 찾지 못했습니다. 사용할 열을 직접 선택해 주세요.');
    } catch (error) {
      console.error('자료 수합 명단 Excel을 읽지 못했습니다.', error);
      setExcelRows(undefined);
      setImportError('Excel을 읽지 못했습니다. 손상되지 않은 .xlsx 파일인지 확인해 주세요.');
    } finally {
      setExcelLoading(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  const chooseSource = async (file?: File) => {
    if (!file) return;
    try {
      await validateCollectionFile(file);
      setSourceFile(file);
      setFileError('');
      clearFieldError('source');
    } catch (error) {
      setSourceFile(undefined);
      setFileError(error instanceof Error ? error.message : '파일을 확인하지 못했습니다.');
    } finally {
      if (sourceInputRef.current) sourceInputRef.current.value = '';
    }
  };

  const resetDraft = () => {
    window.localStorage.removeItem(DRAFT_KEY);
    setTitle('');
    setDescription('');
    setMode('fixed');
    setTargets([]);
    setImportMethod('paste');
    setImportStrategy('append');
    setRequestType('upload');
    setSourceFile(undefined);
    setDueAt(defaultDueAt());
    setPassword('');
    setAllowResubmit(true);
    setShowRestoreNotice(false);
    setFieldErrors({});
    setSubmitError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors: FieldErrors = {};
    if (!title.trim()) errors.title = '수합 제목을 입력해 주세요.';
    if (mode === 'fixed') {
      if (cleanedTargets.length === 0) errors.targets = '제출 대상 명단을 한 명 이상 입력해 주세요.';
      else if (cleanedTargets.some((target) => duplicateLabelKeys.has(normalizeTarget(target.label)) && !target.owner)) errors.targets = '같은 이름이 여러 명이면 각 사람의 학년·부서 같은 구분 정보를 입력해 주세요.';
      else {
        const keys = cleanedTargets.map((target) => `${normalizeTarget(target.label)}\u0000${normalizeTarget(target.owner)}`);
        if (new Set(keys).size !== keys.length) errors.targets = '이름과 구분 정보가 모두 같은 행이 있습니다. 구분하거나 삭제해 주세요.';
      }
    }
    if (requestType === 'review' && !sourceFile) errors.source = '검토받을 배포 파일을 선택해 주세요.';
    if (password && password.length < 4) errors.password = '비밀번호는 4자 이상 입력해 주세요.';
    setFieldErrors(errors);
    const firstError = (['title', 'targets', 'source', 'password'] as const).find((key) => errors[key]);
    if (firstError) {
      focusError(firstError);
      return;
    }

    try {
      setSaving(true);
      setSubmitError('');
      const ownerId = dataCollectOwnerId(user?.id);
      const created = await createDataCollection(ownerId, {
        title,
        description,
        kind: 'custom',
        mode,
        targets: mode === 'fixed' ? cleanedTargets : [],
        dueAt,
        password,
        allowResubmit,
        retentionMonths: 12,
      }, requestType === 'review' ? sourceFile : undefined);
      window.localStorage.removeItem(DRAFT_KEY);
      navigate(`/tools/data-collect/${created.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '자료 수합을 만들지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const summaryTarget = mode === 'fixed' ? `대상 ${cleanedTargets.length}명` : '제출자가 이름 입력';
  const summaryFile = requestType === 'review' ? (sourceFile ? `검토 파일 ${sourceFile.name}` : '검토 파일 미선택') : '새 파일 제출받기';

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-5xl space-y-5 pb-10">
      <div className="border-b border-[#DCE3EA] pb-4">
        <button type="button" onClick={() => navigate('/tools/data-collect')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />자료 수합 목록</button>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold">자료 수합 만들기</h1>
        <p className="mt-2 text-sm text-[#526174]">누구에게 무엇을 받을지 정하면 공유 링크가 만들어집니다.</p>
      </div>

      {showRestoreNotice ? <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-[#0F6CBD] bg-[#EFF6FC] px-4 py-3 text-sm text-[#1E4E79]"><span>작성 중이던 내용을 복원했습니다.{requestType === 'review' ? ' 배포 파일은 다시 선택해 주세요.' : ''}</span><button type="button" onClick={resetDraft} className="min-h-[44px] rounded-lg px-3 text-xs font-bold text-[#0F6CBD]">처음부터 작성</button></div> : null}

      <div className="divide-y divide-[#DCE3EA] overflow-hidden rounded-lg border border-[#DCE3EA] bg-white">
        <section className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">요청 내용</h2>
          <label className="mt-5 block text-sm font-bold" htmlFor="data-collect-title">제목 <span className="text-[#B42318]">필수</span></label>
          <input ref={titleRef} id="data-collect-title" value={title} onChange={(event) => { setTitle(event.target.value); clearFieldError('title'); }} aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? 'data-collect-title-error' : undefined} className={`${inputClass} mt-2`} placeholder="예: 2학기 평가 문항 검토" />
          {fieldErrors.title ? <p id="data-collect-title-error" className="mt-2 text-sm font-semibold text-[#B42318]">{fieldErrors.title}</p> : null}
          <label className="mt-4 block text-sm font-bold" htmlFor="data-collect-description">안내 <span className="font-normal text-[#64748B]">선택</span></label>
          <textarea id="data-collect-description" value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} mt-2 min-h-28 p-3`} placeholder="확인할 내용과 제출 기준을 적어 주세요." />
        </section>

        <section className="p-5 sm:p-6">
          <fieldset>
            <legend className="text-lg font-bold">누가 제출하나요?</legend>
            <p className="mt-1 text-sm text-[#526174]">미제출자를 확인하려면 명단을 미리 준비하세요.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className={`${radioCardClass} ${mode === 'fixed' ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#DCE3EA] bg-white'}`}>
                <input type="radio" name="recipient-mode" value="fixed" checked={mode === 'fixed'} onChange={() => { setMode('fixed'); clearFieldError('targets'); }} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
                <Users className="h-5 w-5 text-[#0F6CBD]" /><span className="mt-3 block text-sm font-bold">명단에서 본인 찾기</span><span className="mt-1 block text-xs leading-5 text-[#526174]">명단 있음 · 제출 현황과 미제출자를 확인합니다.</span>
              </label>
              <label className={`${radioCardClass} ${mode === 'custom' ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#DCE3EA] bg-white'}`}>
                <input type="radio" name="recipient-mode" value="custom" checked={mode === 'custom'} onChange={() => { setMode('custom'); clearFieldError('targets'); }} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
                <ListPlus className="h-5 w-5 text-[#0F6CBD]" /><span className="mt-3 block text-sm font-bold">제출자가 이름 입력</span><span className="mt-1 block text-xs leading-5 text-[#526174]">명단 없음 · 링크를 받은 사람이 이름을 직접 적습니다.</span>
              </label>
            </div>
          </fieldset>

          {mode === 'fixed' ? <div ref={targetSectionRef} tabIndex={-1} className="mt-6 rounded-lg border border-[#DCE3EA] bg-[#F8FAFC] p-4 outline-none focus:ring-2 focus:ring-[#0F6CBD] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">제출 대상 명단</h3><p className="mt-1 text-xs leading-5 text-[#526174]">가져올 방법 하나를 선택하세요. 같은 이름은 구분 정보를 추가할 수 있습니다.</p></div><span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-[#334155]">{cleanedTargets.length}명</span></div>

            <fieldset className="mt-4">
              <legend className="sr-only">명단 입력 방법</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {([
                  ['paste', '붙여넣기'],
                  ['excel', 'Excel 불러오기'],
                  ['manual', '직접 입력'],
                ] as const).map(([value, label]) => <label key={value} className={`relative flex min-h-[46px] cursor-pointer items-center justify-center rounded-lg border px-3 text-xs font-bold focus-within:ring-2 focus-within:ring-[#0F6CBD] ${importMethod === value ? 'border-[#0F6CBD] bg-white text-[#0F6CBD]' : 'border-[#C8D0DA] text-[#526174]'}`}><input type="radio" name="import-method" value={value} checked={importMethod === value} onChange={() => { setImportMethod(value); if (value === 'manual' && targets.length === 0) setTargets([{ label: '', owner: '' }]); }} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />{label}</label>)}
              </div>
            </fieldset>

            {cleanedTargets.length > 0 && importMethod !== 'manual' ? <fieldset className="mt-4 flex flex-wrap items-center gap-4 text-xs"><legend className="mr-1 font-bold text-[#334155]">가져온 명단을</legend><label className="flex min-h-[44px] items-center gap-2"><input type="radio" name="import-strategy" checked={importStrategy === 'append'} onChange={() => setImportStrategy('append')} />기존 명단에 추가</label><label className="flex min-h-[44px] items-center gap-2"><input type="radio" name="import-strategy" checked={importStrategy === 'replace'} onChange={() => setImportStrategy('replace')} />기존 명단 교체</label></fieldset> : null}

            {importMethod === 'paste' ? <div className="mt-4"><label htmlFor="data-collect-paste" className="text-sm font-bold">명단 붙여넣기</label><textarea id="data-collect-paste" value={pasteText} onChange={(event) => setPasteText(event.target.value)} onPaste={handlePaste} className={`${inputClass} mt-2 min-h-24 p-3 font-normal`} placeholder="Excel이나 문서에서 이름을 복사해 여기에 붙여 넣으세요. 붙이는 즉시 분류됩니다." /><p className="mt-2 flex items-center gap-2 text-xs text-[#526174]"><ClipboardPaste className="h-4 w-4" />이름·성명 열을 자동으로 찾아 반영합니다.</p></div> : null}

            {importMethod === 'excel' ? <div className="mt-4 space-y-3"><button type="button" disabled={excelLoading} onClick={() => excelInputRef.current?.click()} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#0F6CBD] bg-white px-4 text-sm font-bold text-[#0F6CBD] disabled:opacity-60"><FileSpreadsheet className="h-4 w-4" />{excelLoading ? 'Excel 분석 중' : '명단 Excel 파일 선택'}</button><input ref={excelInputRef} type="file" hidden tabIndex={-1} aria-hidden="true" accept=".xlsx" onChange={(event) => void importExcel(event.target.files?.[0])} />
              {excelAnalysis ? <div className="rounded-lg border border-[#DCE3EA] bg-white p-4"><label className="text-xs font-bold" htmlFor="data-collect-name-column">이름으로 사용할 열</label><select id="data-collect-name-column" value={excelAnalysis.selectedColumn} onChange={(event) => setExcelColumn(Number(event.target.value))} className={`${inputClass} mt-2`}>{excelAnalysis.columns.map((column) => <option key={column.index} value={column.index}>{column.label}{column.sample ? ` — 예: ${column.sample}` : ''}</option>)}</select><p className="mt-3 text-xs font-semibold text-[#334155]">{excelAnalysis.labels.length}명 인식 · 제외 {excelAnalysis.excludedCount}행 · 같은 이름 {excelAnalysis.duplicateCount}건</p><div className="mt-3 max-h-28 overflow-y-auto rounded-md bg-[#F8FAFC] px-3 py-2 text-xs leading-6 text-[#526174]">{excelAnalysis.labels.slice(0, 20).map((label, index) => <span key={`${label}-${index}`} className="mr-3 inline-block">{index + 1}. {label}</span>)}{excelAnalysis.labels.length > 20 ? <span>외 {excelAnalysis.labels.length - 20}명</span> : null}</div><button type="button" disabled={excelAnalysis.labels.length === 0} onClick={() => applyImportedLabels(excelAnalysis, 'Excel')} className="mt-3 min-h-[44px] rounded-lg bg-[#334155] px-4 text-xs font-bold text-white disabled:opacity-50">{importStrategy === 'append' && cleanedTargets.length > 0 ? '명단에 추가' : '명단 교체'}</button></div> : null}
            </div> : null}

            {importMethod === 'manual' ? <div className="mt-4 flex justify-end"><button type="button" onClick={() => setTargets((current) => [...current, { label: '', owner: '' }])} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-[#0F6CBD] bg-white px-3 text-xs font-bold text-[#0F6CBD]"><Plus className="h-4 w-4" />한 명 추가</button></div> : null}

            {importError ? <p role="alert" className="mt-3 flex gap-2 text-sm font-semibold text-[#B42318]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{importError}</p> : null}
            {importNotice ? <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#E6F4EA] px-3 py-2 text-xs font-semibold text-[#126B32]"><span className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{importNotice}</span>{previousTargets ? <button type="button" onClick={() => { setTargets(previousTargets); setPreviousTargets(undefined); setImportNotice('가져오기 전 명단으로 되돌렸습니다.'); }} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 font-bold"><RotateCcw className="h-4 w-4" />실행 취소</button> : null}</div> : null}

            {targets.length > 0 ? <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">{targets.map((target, index) => {
              const needsOwner = duplicateLabelKeys.has(normalizeTarget(target.label)) || Boolean(target.owner);
              return <div key={index} className={`grid gap-2 rounded-lg border border-[#E2E8F0] bg-white p-2 ${needsOwner ? 'sm:grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_44px]' : 'sm:grid-cols-[36px_minmax(0,1fr)_44px]'}`}><span className="flex min-h-[44px] items-center justify-center text-xs font-semibold text-[#64748B]">{index + 1}</span><input aria-label={`${index + 1}번 제출 대상`} value={target.label} onChange={(event) => { setTargets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item)); clearFieldError('targets'); }} className={inputClass} placeholder="이름" />{needsOwner ? <input aria-label={`${index + 1}번 구분 정보`} value={target.owner} onChange={(event) => { setTargets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, owner: event.target.value } : item)); clearFieldError('targets'); }} className={inputClass} placeholder="구분 정보 (예: 2학년 1반)" /> : null}<button type="button" onClick={() => setTargets((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="flex h-11 w-11 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#B42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6CBD]" aria-label={`${index + 1}번 대상 삭제`}><Trash2 className="h-4 w-4" /></button></div>;
            })}</div> : <div className="mt-4 rounded-lg border border-dashed border-[#C8D0DA] bg-white px-4 py-6 text-center text-sm text-[#526174]">아직 등록된 사람이 없습니다.</div>}
            {fieldErrors.targets ? <p role="alert" className="mt-3 text-sm font-semibold text-[#B42318]">{fieldErrors.targets}</p> : null}
          </div> : null}
        </section>

        <section className="p-5 sm:p-6">
          <fieldset>
            <legend className="text-lg font-bold">무엇을 받을까요?</legend>
            <p className="mt-1 text-sm text-[#526174]">배포 파일 유무에 따라 받는 사람의 회신 방법이 달라집니다.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className={`${radioCardClass} ${requestType === 'upload' ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#DCE3EA] bg-white'}`}><input type="radio" name="request-type" value="upload" checked={requestType === 'upload'} onChange={() => { setRequestType('upload'); clearFieldError('source'); }} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" /><FileUp className="h-5 w-5 text-[#0F6CBD]" /><span className="mt-3 block text-sm font-bold">새 파일 제출받기</span><span className="mt-1 block text-xs leading-5 text-[#526174]">받는 사람이 준비한 파일을 올립니다.</span></label>
              <label className={`${radioCardClass} ${requestType === 'review' ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#DCE3EA] bg-white'}`}><input type="radio" name="request-type" value="review" checked={requestType === 'review'} onChange={() => { setRequestType('review'); clearFieldError('source'); }} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" /><CheckCircle2 className="h-5 w-5 text-[#0F6CBD]" /><span className="mt-3 block text-sm font-bold">파일을 보내 검토받기</span><span className="mt-1 block text-xs leading-5 text-[#526174]">이상 없음으로 확인하거나 수정본을 제출합니다.</span></label>
            </div>
          </fieldset>

          {requestType === 'review' ? <div className="mt-5 rounded-lg border border-dashed border-[#94A3B8] bg-[#F8FAFC] p-4"><button ref={sourceButtonRef} type="button" onClick={() => sourceInputRef.current?.click()} aria-describedby={fieldErrors.source ? 'data-collect-source-error' : 'data-collect-source-help'} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#0F6CBD] bg-white px-4 text-sm font-bold text-[#0F6CBD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6CBD]"><FileUp className="h-4 w-4" />{sourceFile ? '배포 파일 교체' : '검토할 배포 파일 선택'}</button><input ref={sourceInputRef} type="file" hidden tabIndex={-1} aria-hidden="true" accept=".hwp,.hwpx,.docx,.xlsx,.pdf,.png,.jpg,.jpeg" onChange={(event) => void chooseSource(event.target.files?.[0])} />
            {sourceFile ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{sourceFile.name}</p><p className="mt-1 text-xs text-[#64748B]">{formatFileSize(sourceFile.size)}</p></div><button type="button" onClick={() => { setSourceFile(undefined); if (sourceInputRef.current) sourceInputRef.current.value = ''; }} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 text-xs font-bold text-[#B42318]"><X className="h-4 w-4" />제거</button></div> : null}
            <p id="data-collect-source-help" className="mt-3 text-xs leading-5 text-[#526174]">한글·Word·Excel·PDF·이미지, 최대 50MB</p>{fileError ? <p role="alert" className="mt-2 text-sm font-semibold text-[#B42318]">{fileError}</p> : null}{fieldErrors.source ? <p id="data-collect-source-error" role="alert" className="mt-2 text-sm font-semibold text-[#B42318]">{fieldErrors.source}</p> : null}</div> : <p className="mt-4 rounded-lg bg-[#F8FAFC] px-4 py-3 text-sm text-[#526174]">배포 파일 없이 제출자가 새 파일을 올립니다.</p>}
        </section>

        <section className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">마감</h2>
          <label className="mt-4 block max-w-md text-sm font-bold" htmlFor="data-collect-due">회신 기한 <span className="font-normal text-[#64748B]">선택</span></label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id="data-collect-due" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className={`${inputClass} max-w-md font-normal`} />{dueAt ? <button type="button" onClick={() => setDueAt('')} className="min-h-[44px] rounded-lg px-3 text-xs font-bold text-[#526174]">기한 없애기</button> : null}</div>
          <p className="mt-2 text-xs text-[#526174]">{dueAt ? '기한이 지나면 공개 링크에서 더 이상 제출할 수 없습니다.' : '수합을 직접 닫을 때까지 계속 받습니다.'}</p>

          <details className="mt-5 rounded-lg border border-[#DCE3EA] bg-[#F8FAFC] p-4">
            <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-bold text-[#334155]">추가 설정</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold" htmlFor="data-collect-password">링크 비밀번호 <span className="font-normal text-[#64748B]">선택</span></label><input ref={passwordRef} id="data-collect-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); clearFieldError('password'); }} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'data-collect-password-error' : undefined} className={`${inputClass} sm:col-start-1`} placeholder="4자 이상" />{fieldErrors.password ? <p id="data-collect-password-error" className="text-sm font-semibold text-[#B42318] sm:col-start-1">{fieldErrors.password}</p> : null}<label className="flex min-h-[44px] items-center gap-3 text-sm font-bold sm:col-start-2 sm:row-start-1 sm:row-span-2"><input type="checkbox" checked={allowResubmit} onChange={(event) => setAllowResubmit(event.target.checked)} className="h-5 w-5" />{requestType === 'review' ? '수정본 다시 제출 허용' : '제출 후 파일 교체 허용'}</label></div>
          </details>
        </section>
      </div>

      <div className="sticky bottom-0 z-10 rounded-lg border border-[#DCE3EA] bg-white/95 p-4 shadow-lg backdrop-blur">
        {submitError ? <p role="alert" className="mb-3 flex gap-2 text-sm font-semibold text-[#B42318]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{submitError}</p> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="min-w-0 text-xs font-semibold leading-5 text-[#526174]"><span className="text-[#0F172A]">{summaryTarget}</span> · <span className="break-all text-[#0F172A]">{summaryFile}</span> · {formatDueSummary(dueAt)}</p><button type="submit" disabled={saving} className="min-h-[48px] shrink-0 rounded-lg bg-[#0F6CBD] px-6 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:opacity-60">{saving ? '만드는 중' : '자료 수합 만들고 링크 확인'}</button></div>
      </div>
    </form>
  );
}
