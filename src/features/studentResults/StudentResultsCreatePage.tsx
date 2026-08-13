import { useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, FileSpreadsheet, LoaderCircle, Plus, Trash2, Undo2, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { studentResultsOwnerId } from './studentResultsConfig';
import { analyzeStudentResultFile, type StudentResultImportAnalysis } from './studentResultsImport';
import { createStudentResultEvent } from './studentResultsStore';
import { getStudentResultValidationIssue, makeEmptyRecipient } from './studentResultsUtils';
import type { ResultColumn, ResultRecipientDraft, StudentResultDraft } from './types';

type EditableResultColumn = Omit<ResultColumn, 'maxScore'> & { maxScore: number | '' };

interface FormSnapshot {
  title: string;
  description: string;
  columns: EditableResultColumn[];
  recipients: ResultRecipientDraft[];
}

const initialColumns: EditableResultColumn[] = [
  { id: 'score', label: '평가 점수', maxScore: 100, description: '' },
];

export function StudentResultsCreatePage() {
  const navigate = useNavigate();
  const { user } = useTeacherAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columns, setColumns] = useState<EditableResultColumn[]>(initialColumns);
  const [recipients, setRecipients] = useState<ResultRecipientDraft[]>([
    makeEmptyRecipient(0, initialColumns),
  ]);
  const [allowConfirmation, setAllowConfirmation] = useState(true);
  const [allowDispute, setAllowDispute] = useState(true);
  const [error, setError] = useState('');
  const [errorFieldId, setErrorFieldId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importedFileName, setImportedFileName] = useState('');
  const [importAnalysis, setImportAnalysis] = useState<StudentResultImportAnalysis | null>(null);
  const [pendingImportFileName, setPendingImportFileName] = useState('');
  const [pendingImport, setPendingImport] = useState<StudentResultImportAnalysis | null>(null);
  const [preImportSnapshot, setPreImportSnapshot] = useState<FormSnapshot | null>(null);

  const addColumn = () => {
    const column: EditableResultColumn = {
      id: crypto.randomUUID(),
      label: '',
      maxScore: 10,
      description: '',
    };
    setColumns((current) => [...current, column]);
    setRecipients((current) => current.map((recipient) => ({
      ...recipient,
      values: { ...recipient.values, [column.id]: '' },
    })));
  };

  const removeColumn = (columnId: string) => {
    if (columns.length === 1) return;
    setColumns((current) => current.filter((column) => column.id !== columnId));
    setRecipients((current) => current.map((recipient) => {
      const values = { ...recipient.values };
      delete values[columnId];
      return { ...recipient, values };
    }));
  };

  const updateRecipient = (index: number, patch: Partial<ResultRecipientDraft>) => {
    setRecipients((current) => current.map((recipient, recipientIndex) => (
      recipientIndex === index ? { ...recipient, ...patch } : recipient
    )));
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setError('');
    setErrorFieldId('');
    try {
      const analysis = await analyzeStudentResultFile(file);
      setPendingImportFileName(file.name);
      setPendingImport(analysis);
    } catch (importError) {
      setPendingImport(null);
      setPendingImportFileName('');
      setError(importError instanceof Error ? importError.message : '엑셀 파일을 분석하지 못했습니다.');
    } finally {
      setImporting(false);
    }
  };

  const applyImport = () => {
    if (!pendingImport) return;
    setPreImportSnapshot({
      title,
      description,
      columns: structuredClone(columns),
      recipients: structuredClone(recipients),
    });
    setTitle(pendingImport.title);
    setDescription(pendingImport.description);
    setColumns(pendingImport.columns);
    setRecipients(pendingImport.recipients);
    setImportedFileName(pendingImportFileName);
    setImportAnalysis(pendingImport);
    setPendingImport(null);
    setPendingImportFileName('');
    setError('');
    setErrorFieldId('');
  };

  const cancelPendingImport = () => {
    setPendingImport(null);
    setPendingImportFileName('');
  };

  const undoImport = () => {
    if (!preImportSnapshot) return;
    setTitle(preImportSnapshot.title);
    setDescription(preImportSnapshot.description);
    setColumns(preImportSnapshot.columns);
    setRecipients(preImportSnapshot.recipients);
    setPreImportSnapshot(null);
    setImportAnalysis(null);
    setImportedFileName('');
  };

  const focusIssue = (message: string, fieldId: string) => {
    setError(message);
    setErrorFieldId(fieldId);
    window.requestAnimationFrame(() => {
      document.getElementById(fieldId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById(fieldId)?.focus();
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const ownerId = studentResultsOwnerId(user?.id);
    if (!ownerId) return;
    const emptyMaxScoreIndex = columns.findIndex((column) => column.maxScore === '');
    if (emptyMaxScoreIndex >= 0) {
      focusIssue('배점을 입력해 주세요.', `student-result-column-max-${emptyMaxScoreIndex}`);
      return;
    }
    const draft: StudentResultDraft = {
      title,
      description,
      columns: columns.map((column) => ({ ...column, maxScore: Number(column.maxScore) })),
      recipients,
      allowConfirmation,
      allowDispute,
    };
    const validationIssue = getStudentResultValidationIssue(draft);
    if (validationIssue) {
      focusIssue(validationIssue.message, validationIssue.fieldId);
      return;
    }
    try {
      setError('');
      setErrorFieldId('');
      const created = createStudentResultEvent(ownerId, draft);
      navigate(`/tools/student-results/${created.id}`);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : '결과 안내를 만들지 못했습니다.');
    }
  };

  const hasEnteredData = Boolean(
    title.trim()
    || description.trim()
    || columns.some((column) => column.label !== '평가 점수' || column.maxScore !== 100 || column.description.trim())
    || recipients.some((recipient) => recipient.name.trim() || recipient.verificationCode.trim() || recipient.feedback.trim()),
  );
  const fieldError = (fieldId: string) => errorFieldId === fieldId;

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-[#DCE3EA] pb-4">
        <button
          type="button"
          onClick={() => navigate('/tools/student-results')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"
        >
          <ArrowLeft className="h-5 w-5" />
          목록으로
        </button>
        <span className="text-xs font-semibold text-[#526174]">엑셀 분석 또는 직접 입력</span>
      </div>

      <div>
        <p className="text-xs font-bold text-[#0F6CBD]">새 결과 안내</p>
        <h1 className="mt-1 text-2xl font-extrabold">안내 정보와 학생 결과 입력</h1>
        <p className="mt-2 text-sm text-[#526174]">
          엑셀을 분석해 전체 입력란을 채운 뒤, 필요한 부분을 직접 수정할 수 있습니다.
        </p>
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <section className="border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-bold">1. 안내 정보</h2>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">
              엑셀의 제목, 머리글과 학생 행을 분석해 안내 정보·결과 항목·학생 결과를 자동으로 채웁니다.
            </p>
          </div>
          <label className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold ${importing ? 'cursor-wait border-[#C8D0DA] text-[#64748B]' : 'border-[#0F6CBD] text-[#0F6CBD] hover:bg-[#EFF6FC]'}`}>
            {importing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? '시트 분석 중' : '엑셀 시트 분석'}
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(event) => void handleFileImport(event)}
              disabled={importing}
              className="sr-only"
              aria-label="학생 결과 엑셀 파일"
            />
          </label>
        </div>

        {pendingImport ? (
          <div className="mt-4 border-y border-[#B9D9F2] bg-[#F7FBFE] px-4 py-5" aria-label="엑셀 분석 결과 검토">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#0F6CBD]">분석 결과 검토</p>
                <p className="mt-1 truncate text-sm font-extrabold text-[#0F172A]">{pendingImportFileName}</p>
                <p className="mt-1 text-xs text-[#334155]">
                  {pendingImport.sheetName} · 머리글 {pendingImport.headerRowNumber}행 · 결과 항목 {pendingImport.columns.length}개 · 학생 {pendingImport.recipients.length}명
                </p>
              </div>
              <button type="button" onClick={cancelPendingImport} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#64748B] hover:bg-white" aria-label="분석 결과 닫기" title="닫기"><X className="h-5 w-5" /></button>
            </div>

            {hasEnteredData ? (
              <div className="mt-4 flex items-start gap-2 border border-[#F5D08A] bg-[#FFF9ED] px-3 py-2 text-xs font-semibold leading-5 text-[#76520E]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />적용하면 현재 입력을 분석 결과로 교체합니다. 적용 직후 한 번 되돌릴 수 있습니다.
              </div>
            ) : null}

            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="font-semibold text-[#64748B]">안내 제목</dt><dd className="mt-1 truncate font-bold text-[#0F172A]">{pendingImport.title}</dd></div>
              <div><dt className="font-semibold text-[#64748B]">결과 항목</dt><dd className="mt-1 truncate font-bold text-[#0F172A]">{pendingImport.columns.map((column) => `${column.label}(${column.maxScore})`).join(', ')}</dd></div>
              <div><dt className="font-semibold text-[#64748B]">첫 학생</dt><dd className="mt-1 truncate font-bold text-[#0F172A]">{pendingImport.recipients[0]?.name || '없음'}</dd></div>
              <div><dt className="font-semibold text-[#64748B]">확인 필요</dt><dd className="mt-1 font-bold text-[#0F172A]">{pendingImport.warnings.length}건</dd></div>
            </dl>

            <div className="mt-4 overflow-x-auto border border-[#DCE3EA] bg-white">
              <table className="min-w-[640px] w-full border-collapse text-xs">
                <thead><tr className="bg-[#F6F8FB] text-left text-[#526174]"><th className="border-b border-[#DCE3EA] p-2">원본 행</th><th className="border-b border-[#DCE3EA] p-2">식별값</th><th className="border-b border-[#DCE3EA] p-2">성명</th>{pendingImport.columns.map((column) => <th key={column.id} className="border-b border-[#DCE3EA] p-2">{column.label}</th>)}</tr></thead>
                <tbody>{pendingImport.recipients.slice(0, 5).map((recipient, index) => <tr key={`${recipient.studentKey}-${index}`}><td className="border-b border-[#EEF1F4] p-2">{pendingImport.headerRowNumber + index + 1}</td><td className="border-b border-[#EEF1F4] p-2">{recipient.studentKey}</td><td className="border-b border-[#EEF1F4] p-2 font-bold">{recipient.name}</td>{pendingImport.columns.map((column) => <td key={column.id} className="border-b border-[#EEF1F4] p-2">{recipient.values[column.id] === '' ? '미입력' : recipient.values[column.id]}</td>)}</tr>)}</tbody>
              </table>
            </div>
            {pendingImport.recipients.length > 5 ? <p className="mt-2 text-xs text-[#64748B]">앞 5명만 미리 표시합니다. 적용 후 전체 명단을 수정할 수 있습니다.</p> : null}

            {pendingImport.warnings.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs leading-5 text-[#76520E]">
                {pendingImport.warnings.map((warning) => <li key={warning}>· {warning}</li>)}
              </ul>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={cancelPendingImport} className="min-h-[44px] rounded-lg border border-[#C8D0DA] bg-white px-4 text-sm font-bold">취소</button>
              <button type="button" onClick={applyImport} className="min-h-[44px] rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F]">분석 결과 적용</button>
            </div>
          </div>
        ) : importAnalysis ? (
          <div className="mt-4 border border-[#A9D8B8] bg-[#F2FBF5] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#16803C]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#126B32]">{importedFileName}</p>
                <p className="mt-1 text-xs text-[#334155]">
                  {importAnalysis.sheetName} · 머리글 {importAnalysis.headerRowNumber}행 · 결과 항목 {importAnalysis.columns.length}개 · 학생 {importAnalysis.recipients.length}명
                </p>
                {importAnalysis.warnings.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-[#76520E]">
                    {importAnalysis.warnings.map((warning) => <li key={warning}>· {warning}</li>)}
                  </ul>
                ) : null}
              </div>
              </div>
              {preImportSnapshot ? <button type="button" onClick={undoImport} className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg border border-[#16803C] px-3 text-xs font-bold text-[#126B32]"><Undo2 className="h-4 w-4" />가져오기 취소</button> : null}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-start gap-3 bg-[#F6F8FB] px-4 py-3 text-xs leading-5 text-[#526174]">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-[#0F6CBD]" />
            <p>XLSX 또는 CSV 파일을 지원합니다. 성명/이름 머리글이 필요하며, 배점은 `발표(20점)` 또는 `발표/20`처럼 적으면 정확히 인식합니다.</p>
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-[#334155]">
            제목
            <input id="student-result-title" aria-invalid={fieldError('student-result-title')} aria-describedby={fieldError('student-result-title') ? 'student-result-title-error' : undefined} value={title} onChange={(event) => setTitle(event.target.value)} className={`mt-2 min-h-[44px] w-full rounded-lg border px-3 font-normal ${fieldError('student-result-title') ? 'border-[#B42318] bg-[#FFF8F8]' : 'border-[#C8D0DA]'}`} placeholder="예: 2학기 수행평가 결과" />
            {fieldError('student-result-title') ? <span id="student-result-title-error" className="mt-1 block text-xs font-semibold text-[#B42318]">{error}</span> : null}
          </label>
          <label className="text-sm font-semibold text-[#334155]">
            안내 문구
            <input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 font-normal" placeholder="학생에게 보여줄 안내" />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={allowConfirmation} onChange={(event) => setAllowConfirmation(event.target.checked)} className="h-4 w-4" />결과 확인 받기</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={allowDispute} onChange={(event) => setAllowDispute(event.target.checked)} className="h-4 w-4" />이의 제기 받기</label>
        </div>
      </section>

      <section className="border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <div><h2 className="text-base font-bold">2. 결과 항목</h2><p className="mt-1 text-xs text-[#64748B]">자동 분석한 항목명과 배점을 확인해 주세요.</p></div>
          <button id="student-result-add-column" type="button" onClick={addColumn} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD]"><Plus className="h-4 w-4" />항목 추가</button>
        </div>
        <div className="mt-4 space-y-3">
          {columns.map((column, index) => (
            <div key={column.id} className="grid gap-3 border-b border-[#EEF1F4] pb-3 md:grid-cols-[1fr_120px_1.3fr_40px]">
              <div><input id={`student-result-column-label-${index}`} aria-invalid={fieldError(`student-result-column-label-${index}`)} aria-describedby={fieldError(`student-result-column-label-${index}`) ? `student-result-column-label-${index}-error` : undefined} aria-label={`${index + 1}번 항목명`} value={column.label} onChange={(event) => setColumns((current) => current.map((item) => item.id === column.id ? { ...item, label: event.target.value } : item))} className={`min-h-[44px] w-full rounded-lg border px-3 text-sm ${fieldError(`student-result-column-label-${index}`) ? 'border-[#B42318] bg-[#FFF8F8]' : 'border-[#C8D0DA]'}`} placeholder="항목명" />{fieldError(`student-result-column-label-${index}`) ? <p id={`student-result-column-label-${index}-error`} className="mt-1 text-xs font-semibold text-[#B42318]">{error}</p> : null}</div>
              <div><input id={`student-result-column-max-${index}`} aria-invalid={fieldError(`student-result-column-max-${index}`)} aria-describedby={fieldError(`student-result-column-max-${index}`) ? `student-result-column-max-${index}-error` : undefined} aria-label={`${column.label || index + 1} 배점`} type="number" min="1" value={column.maxScore} onChange={(event) => setColumns((current) => current.map((item) => item.id === column.id ? { ...item, maxScore: event.target.value === '' ? '' : Number(event.target.value) } : item))} className={`min-h-[44px] w-full rounded-lg border px-3 text-sm ${fieldError(`student-result-column-max-${index}`) ? 'border-[#B42318] bg-[#FFF8F8]' : 'border-[#C8D0DA]'}`} />{fieldError(`student-result-column-max-${index}`) ? <p id={`student-result-column-max-${index}-error`} className="mt-1 text-xs font-semibold text-[#B42318]">{error}</p> : null}</div>
              <input aria-label={`${column.label || index + 1} 설명`} value={column.description} onChange={(event) => setColumns((current) => current.map((item) => item.id === column.id ? { ...item, description: event.target.value } : item))} className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-3 text-sm" placeholder="설명 (선택)" />
              <button type="button" disabled={columns.length === 1} onClick={() => removeColumn(column.id)} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#FEF3F2] hover:text-[#B42318] disabled:opacity-30" aria-label={`${column.label || index + 1} 항목 삭제`}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <div><h2 className="text-base font-bold">3. 학생 결과</h2><p className="mt-1 text-xs text-[#64748B]">모든 학생의 점수를 입력해야 하며 0점부터 배점까지 입력할 수 있습니다.</p></div>
          <button id="student-result-add-recipient" type="button" onClick={() => setRecipients((current) => [...current, makeEmptyRecipient(current.length, columns)])} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD]"><Plus className="h-4 w-4" />학생 추가</button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead><tr className="bg-[#F6F8FB] text-left text-xs text-[#526174]"><th className="border border-[#DCE3EA] p-3">식별값</th><th className="border border-[#DCE3EA] p-3">성명</th><th className="border border-[#DCE3EA] p-3">확인번호</th>{columns.map((column) => <th key={column.id} className="border border-[#DCE3EA] p-3">{column.label || '미입력 항목'} / {column.maxScore}</th>)}<th className="border border-[#DCE3EA] p-3">피드백</th><th className="w-12 border border-[#DCE3EA] p-3"><span className="sr-only">삭제</span></th></tr></thead>
            <tbody>
              {recipients.map((recipient, index) => (
                <tr key={index}>
                  <td className="border border-[#DCE3EA] p-2"><input id={`student-result-recipient-key-${index}`} aria-invalid={fieldError(`student-result-recipient-key-${index}`)} aria-label={`${index + 1}번 학생 식별값`} value={recipient.studentKey} onChange={(event) => updateRecipient(index, { studentKey: event.target.value })} className={`min-h-[40px] w-full rounded-md border px-2 ${fieldError(`student-result-recipient-key-${index}`) ? 'border-[#B42318] bg-[#FFF8F8]' : 'border-[#C8D0DA]'}`} /></td>
                  <td className="border border-[#DCE3EA] p-2"><input id={`student-result-recipient-name-${index}`} aria-invalid={fieldError(`student-result-recipient-name-${index}`)} aria-label={`${index + 1}번 학생 성명`} value={recipient.name} onChange={(event) => updateRecipient(index, { name: event.target.value })} className={`min-h-[40px] w-full rounded-md border px-2 ${fieldError(`student-result-recipient-name-${index}`) ? 'border-[#B42318] bg-[#FFF8F8]' : 'border-[#C8D0DA]'}`} /></td>
                  <td className="border border-[#DCE3EA] p-2"><input id={`student-result-recipient-code-${index}`} aria-invalid={fieldError(`student-result-recipient-code-${index}`)} aria-label={`${index + 1}번 학생 확인번호`} value={recipient.verificationCode} onChange={(event) => updateRecipient(index, { verificationCode: event.target.value })} className={`min-h-[40px] w-full rounded-md border px-2 ${fieldError(`student-result-recipient-code-${index}`) ? 'border-[#B42318] bg-[#FFF8F8]' : 'border-[#C8D0DA]'}`} /></td>
                  {columns.map((column) => (
                    <td key={column.id} className="border border-[#DCE3EA] p-2">
                      <input
                        id={`student-result-score-${index}-${columns.indexOf(column)}`}
                        aria-invalid={fieldError(`student-result-score-${index}-${columns.indexOf(column)}`)}
                        aria-label={`${index + 1}번 학생 ${column.label} 점수`}
                        type="number"
                        min="0"
                        max={column.maxScore}
                        value={recipient.values[column.id] ?? ''}
                        onChange={(event) => updateRecipient(index, {
                          values: {
                            ...recipient.values,
                            [column.id]: event.target.value === '' ? '' : Number(event.target.value),
                          },
                        })}
                        className={`min-h-[40px] w-24 rounded-md border px-2 ${fieldError(`student-result-score-${index}-${columns.indexOf(column)}`) ? 'border-[#B42318] bg-[#FFF8F8]' : 'border-[#C8D0DA]'}`}
                      />
                    </td>
                  ))}
                  <td className="border border-[#DCE3EA] p-2"><input aria-label={`${index + 1}번 학생 피드백`} value={recipient.feedback} onChange={(event) => updateRecipient(index, { feedback: event.target.value })} className="min-h-[40px] w-full rounded-md border border-[#C8D0DA] px-2" /></td>
                  <td className="border border-[#DCE3EA] p-2"><button type="button" disabled={recipients.length === 1} onClick={() => setRecipients((current) => current.filter((_, recipientIndex) => recipientIndex !== index))} className="flex h-9 w-9 items-center justify-center text-[#94A3B8] hover:text-[#B42318] disabled:opacity-30" aria-label={`${index + 1}번 학생 삭제`}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate('/tools/student-results')} className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-5 text-sm font-bold">취소</button>
        <button type="submit" className="min-h-[44px] rounded-lg bg-[#0F6CBD] px-6 text-sm font-bold text-white hover:bg-[#0B5B9F]">결과 안내 만들기</button>
      </div>
    </form>
  );
}
