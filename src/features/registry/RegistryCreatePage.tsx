import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardPaste,
  FileSpreadsheet,
  ListPlus,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createRegistry } from './registryService';
import { createColumn, createParticipant, getRegistryPageSettings, parseExcelRows, parsePastedRows } from './registryUtils';
import { RegistryPrintSheet } from './RegistryPrintSheet';
import { RegistryPagination } from './RegistryPagination';
import type { Registry, RegistryColumn, RegistryDraft, RegistryLayout, RegistryMode } from './types';

const STEPS = ['기본 정보', '표와 명단', '인쇄 미리보기', '공유 설정'];
const PARTICIPANTS_PER_PAGE = 50;

const inputClass = 'min-h-[44px] w-full rounded-lg border border-[#DCE3EA] bg-white px-3.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]/15';

export function RegistryCreatePage() {
  const navigate = useNavigate();
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<RegistryMode>('fixed');
  const [title, setTitle] = useState('');
  const [leftHeader, setLeftHeader] = useState('');
  const [rightHeader, setRightHeader] = useState('');
  const [columns, setColumns] = useState<RegistryColumn[]>([createColumn('소속')]);
  const [participants, setParticipants] = useState<Array<ReturnType<typeof createParticipant>>>([
    createParticipant([], ''),
  ]);
  const [layout, setLayout] = useState<RegistryLayout>(10);
  const [allowWalkIn, setAllowWalkIn] = useState(true);
  const [publicPassword, setPublicPassword] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [participantPage, setParticipantPage] = useState(1);
  const [previewPage, setPreviewPage] = useState(1);

  const cleanParticipants = participants.filter((participant) => participant.name.trim());
  const participantPageCount = Math.max(1, Math.ceil(participants.length / PARTICIPANTS_PER_PAGE));
  const safeParticipantPage = Math.min(participantPage, participantPageCount);
  const participantPageStart = (safeParticipantPage - 1) * PARTICIPANTS_PER_PAGE;
  const visibleParticipants = participants.slice(participantPageStart, participantPageStart + PARTICIPANTS_PER_PAGE);
  const printSettings = getRegistryPageSettings(layout);
  const previewPageCount = Math.max(1, Math.ceil(cleanParticipants.length / (printSettings.columns * printSettings.rowsPerColumn)));
  const safePreviewPage = Math.min(previewPage, previewPageCount);

  const previewRegistry: Registry = {
    id: 'preview',
    publicToken: 'preview',
    title: title || '등록부 제목',
    leftHeader: leftHeader || '일시:',
    rightHeader: rightHeader || '장소:',
    mode,
    status: 'open',
    layout,
    allowWalkIn,
    publicPassword: publicPassword || undefined,
    columns,
    participants: (step === 3 ? cleanParticipants : []).map((participant, index) => ({
      ...participant,
      id: `preview-${index}`,
      rowNumber: index + 1,
    })),
    createdAt: '',
    updatedAt: '',
  };

  const updateColumn = (id: string, label: string) => {
    setColumns((current) => current.map((column) => (column.id === id ? { ...column, label } : column)));
  };

  const addColumn = () => {
    if (columns.length >= 4) return;
    const column = createColumn(`추가 항목 ${columns.length + 1}`);
    setColumns((current) => [...current, column]);
    setParticipants((current) => current.map((participant) => ({
      ...participant,
      values: { ...participant.values, [column.id]: '' },
    })));
  };

  const removeColumn = (id: string) => {
    setColumns((current) => current.filter((column) => column.id !== id));
    setParticipants((current) => current.map((participant) => {
      const values = { ...participant.values };
      delete values[id];
      return { ...participant, values };
    }));
  };

  const updateParticipant = (index: number, field: string, value: string) => {
    setParticipants((current) => current.map((participant, participantIndex) => {
      if (participantIndex !== index) return participant;
      if (field === 'name') return { ...participant, name: value };
      return { ...participant, values: { ...participant.values, [field]: value } };
    }));
  };

  const addParticipantRow = () => {
    setParticipants((current) => [...current, createParticipant(columns)]);
    setParticipantPage(Math.ceil((participants.length + 1) / PARTICIPANTS_PER_PAGE));
  };

  const importPaste = () => {
    const imported = parsePastedRows(pasteText, columns);
    if (imported.length === 0) {
      setError('붙여넣은 명단에서 성명을 찾지 못했습니다. 탭으로 열을 구분해 주세요.');
      return;
    }
    setParticipants(imported);
    setParticipantPage(1);
    setPasteText('');
    setError('');
  };

  const importExcel = async (file: File) => {
    try {
      const { readSheet } = await import('read-excel-file/web-worker');
      const rows = await readSheet(file);
      const imported = parseExcelRows(rows, columns);
      if (imported.length === 0) {
        setError('엑셀에서 참석자 이름을 찾지 못했습니다. 성명 열을 확인해 주세요.');
        return;
      }
      setParticipants(imported);
      setParticipantPage(1);
      setError('');
    } catch (importError) {
      console.error('등록부 명단 엑셀을 읽지 못했습니다.', importError);
      setError('엑셀 파일을 읽지 못했습니다. 손상되지 않은 .xlsx 파일인지 확인해 주세요.');
    }
  };

  const goNext = () => {
    if (step === 1 && !title.trim()) {
      setError('등록부 제목을 입력해 주세요.');
      return;
    }
    if (step === 2 && columns.some((column) => !column.label.trim())) {
      setError('모든 표 열의 이름을 입력해 주세요.');
      return;
    }
    if (step === 2 && mode === 'fixed' && cleanParticipants.length === 0) {
      setError('사전 명단형은 참석자를 한 명 이상 입력해야 합니다.');
      return;
    }
    setError('');
    setStep((current) => Math.min(4, current + 1));
  };

  const handleCreate = async () => {
    const draft: RegistryDraft = {
      title: title.trim(),
      leftHeader: leftHeader.trim(),
      rightHeader: rightHeader.trim(),
      mode,
      layout,
      allowWalkIn: mode === 'custom' ? true : allowWalkIn,
      publicPassword: publicPassword.trim() || undefined,
      columns: columns.map((column) => ({ ...column, label: column.label.trim() })),
      participants: mode === 'fixed' ? cleanParticipants : [],
    };
    setIsCreating(true);
    setError('');
    try {
      const registry = await createRegistry(draft);
      navigate(`/tools/registry-sign/${registry.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '등록부를 만들지 못했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-7xl space-y-6 overflow-x-clip pb-12">
      <div className="flex items-center justify-between border-b border-[#DCE3EA] pb-4">
        <button
          type="button"
          onClick={() => navigate('/tools/registry-sign')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"
        >
          <ArrowLeft className="h-5 w-5" />
          등록부 목록
        </button>
        <span className="text-xs font-semibold text-[#526174]">새 등록부</span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-[#0F172A]">새 등록부 만들기</h1>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STEPS.map((label, index) => {
            const number = index + 1;
            const active = step === number;
            const complete = step > number;
            return (
              <div
                key={label}
                className={`flex min-h-12 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${
                  active
                    ? 'border-[#0F6CBD] bg-[#0F6CBD] text-white'
                    : complete
                      ? 'border-[#B9D9F2] bg-[#EFF6FC] text-[#0F6CBD]'
                      : 'border-[#DCE3EA] bg-white text-[#526174]'
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px]">
                  {complete ? <Check className="h-3 w-3" /> : number}
                </span>
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <section className="min-w-0 border-y border-[#DCE3EA] bg-white px-4 py-6 sm:px-8 sm:py-8">
        {step === 1 ? (
          <div className="mx-auto max-w-3xl space-y-7">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A]">서명 방식</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode('fixed')}
                  aria-pressed={mode === 'fixed'}
                  className={`min-h-28 rounded-lg border p-4 text-left ${mode === 'fixed' ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#DCE3EA] bg-white'}`}
                >
                  <Users className="h-5 w-5 text-[#0F6CBD]" />
                  <span className="mt-3 block text-sm font-bold text-[#0F172A]">사전 명단</span>
                  <span className="mt-1 block text-xs leading-5 text-[#526174]">참석자가 목록에서 본인을 찾아 서명합니다.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('custom')}
                  aria-pressed={mode === 'custom'}
                  className={`min-h-28 rounded-lg border p-4 text-left ${mode === 'custom' ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#DCE3EA] bg-white'}`}
                >
                  <ListPlus className="h-5 w-5 text-[#0F6CBD]" />
                  <span className="mt-3 block text-sm font-bold text-[#0F172A]">현장 자율 입력</span>
                  <span className="mt-1 block text-xs leading-5 text-[#526174]">참석자가 현장에서 정보를 입력하고 서명합니다.</span>
                </button>
              </div>
            </div>

            <div className="grid gap-5">
              <label className="grid gap-2 text-sm font-bold text-[#334155]">
                문서 제목 <span className="sr-only">필수</span>
                <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 2026학년도 교직원 연수 등록부" />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-[#334155]">
                  왼쪽 내용
                  <textarea className={`${inputClass} min-h-24 py-3`} value={leftHeader} onChange={(event) => setLeftHeader(event.target.value)} placeholder="일시: 2026. 8. 20.(목) 14:00" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#334155]">
                  오른쪽 내용
                  <textarea className={`${inputClass} min-h-24 py-3`} value={rightHeader} onChange={(event) => setRightHeader(event.target.value)} placeholder="장소: 미래교육실" />
                </label>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="min-w-0 space-y-8">
            <div className="mx-auto max-w-4xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#0F172A]">표 열 구성</h2>
                  <p className="mt-1 text-xs text-[#526174]">연번·성명·서명은 고정이며 입력 열을 최대 4개까지 추가할 수 있습니다.</p>
                </div>
                <button type="button" onClick={addColumn} disabled={columns.length >= 4} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#DCE3EA] px-4 text-sm font-bold text-[#334155] hover:bg-[#F6F8FB] disabled:opacity-40">
                  <Plus className="h-4 w-4" /> 열 추가
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {columns.map((column, index) => (
                  <div key={column.id} className="flex items-center gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F6F8FB] text-xs font-bold text-[#526174]">{index + 1}</span>
                    <input className={inputClass} value={column.label} onChange={(event) => updateColumn(column.id, event.target.value)} aria-label={`${index + 1}번째 열 이름`} />
                    <button type="button" onClick={() => removeColumn(column.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#FEF3F2] hover:text-[#B42318]" aria-label={`${column.label} 열 삭제`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {mode === 'fixed' ? (
              <div className="min-w-0 border-t border-[#DCE3EA] pt-7">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#0F172A]">참석자 명단</h2>
                    <p className="mt-1 text-xs text-[#526174]">엑셀에서 성명과 열 이름이 있는 행을 찾아 자동으로 맞춥니다.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => excelInputRef.current?.click()} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#DCE3EA] px-4 text-sm font-bold text-[#334155] hover:bg-[#F6F8FB]">
                      <FileSpreadsheet className="h-4 w-4" /> 엑셀 불러오기
                    </button>
                    <input ref={excelInputRef} type="file" accept=".xlsx" tabIndex={-1} aria-hidden="true" className="hidden" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importExcel(file);
                      event.target.value = '';
                    }} />
                    <button type="button" onClick={addParticipantRow} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#DCE3EA] px-4 text-sm font-bold text-[#334155] hover:bg-[#F6F8FB]">
                      <Plus className="h-4 w-4" /> 행 추가
                    </button>
                  </div>
                </div>

                <div className="mt-4 w-full min-w-0 max-w-full overflow-x-auto border-y border-[#DCE3EA]">
                  <table className="w-full min-w-[740px] border-collapse text-sm">
                    <thead className="bg-[#F6F8FB] text-xs font-bold text-[#334155]">
                      <tr>
                        <th className="w-14 px-3 py-3 text-center">연번</th>
                        <th className="min-w-40 px-3 py-3 text-left">성명</th>
                        {columns.map((column) => <th key={column.id} className="min-w-44 px-3 py-3 text-left">{column.label}</th>)}
                        <th className="w-32 px-3 py-3 text-center">서명</th>
                        <th className="w-12"><span className="sr-only">삭제</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleParticipants.map((participant, pageIndex) => {
                        const index = participantPageStart + pageIndex;
                        return (
                          <tr key={index} className="border-t border-[#EEF1F4]">
                            <td className="px-3 py-2 text-center text-[#526174]">{index + 1}</td>
                            <td className="px-3 py-2"><input className={inputClass} value={participant.name} onChange={(event) => updateParticipant(index, 'name', event.target.value)} placeholder="성명" aria-label={`${index + 1}번 참석자 성명`} /></td>
                            {columns.map((column) => (
                              <td key={column.id} className="px-3 py-2"><input className={inputClass} value={participant.values[column.id] ?? ''} onChange={(event) => updateParticipant(index, column.id, event.target.value)} placeholder={column.label} aria-label={`${index + 1}번 참석자 ${column.label}`} /></td>
                            ))}
                            <td className="w-32 px-3 py-2 text-center" aria-label={`${index + 1}번 참석자 서명 칸`}>
                              <span aria-hidden="true" className="inline-block h-10 w-24 border-b border-[#CBD5E1]" />
                            </td>
                            <td className="px-1 py-2">
                              <button type="button" onClick={() => setParticipants((current) => current.filter((_, participantIndex) => participantIndex !== index))} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#FEF3F2] hover:text-[#B42318]" aria-label={`${index + 1}번 참석자 삭제`}><Trash2 className="h-4 w-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <RegistryPagination currentPage={safeParticipantPage} pageSize={PARTICIPANTS_PER_PAGE} totalItems={participants.length} onPageChange={setParticipantPage} label="참석자 명단 페이지" />

                <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <label className="grid gap-2 text-sm font-bold text-[#334155]">
                    <span className="flex items-center gap-2"><ClipboardPaste className="h-4 w-4" /> 표 붙여넣기</span>
                    <textarea className={`${inputClass} min-h-24 py-3 font-mono`} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="소속[TAB]성명 형식의 표를 붙여넣으세요" />
                  </label>
                  <button type="button" onClick={importPaste} className="min-h-[44px] self-end rounded-lg bg-[#334155] px-5 text-sm font-bold text-white hover:bg-[#0F172A]">명단 반영</button>
                </div>
              </div>
            ) : (
              <div className="border-t border-[#DCE3EA] py-12 text-center">
                <Users className="mx-auto h-7 w-7 text-[#0F6CBD]" />
                <p className="mt-3 text-sm font-bold text-[#0F172A]">참석자가 공개 페이지에서 직접 입력합니다</p>
                <p className="mt-1 text-xs text-[#526174]">성명과 위에서 설정한 표 열이 입력 항목으로 표시됩니다.</p>
              </div>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A]">인쇄 레이아웃</h2>
              <div className="mt-4 grid gap-2">
                {([10, 15, 20, 30] as RegistryLayout[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLayout(option)}
                    aria-pressed={layout === option}
                    className={`min-h-[52px] rounded-lg border px-4 text-left text-sm font-bold ${layout === option ? 'border-[#0F6CBD] bg-[#EFF6FC] text-[#0F6CBD]' : 'border-[#DCE3EA] bg-white text-[#334155]'}`}
                  >
                    {option <= 15 ? `1단 ${option}명` : `2단 ${option}명`}
                  </button>
                ))}
              </div>
            </div>
            <div tabIndex={0} role="region" aria-label="등록부 인쇄 미리보기" className="overflow-auto rounded-lg bg-[#E8ECF1] p-5">
              <div className="origin-top-left scale-[0.72] sm:scale-[0.82] xl:scale-[0.9]">
                <RegistryPrintSheet registry={previewRegistry} pageIndex={safePreviewPage - 1} />
              </div>
            </div>
            <div className="xl:col-start-2">
              <RegistryPagination currentPage={safePreviewPage} pageSize={1} totalItems={previewPageCount} onPageChange={setPreviewPage} label="인쇄 미리보기 페이지" itemLabel="쪽" showItemRange={false} />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="mx-auto max-w-3xl space-y-7">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A]">공개 서명 설정</h2>
              <p className="mt-1 text-xs text-[#526174]">등록부를 만든 뒤 링크와 QR이 생성됩니다.</p>
            </div>
            <label className="flex min-h-[64px] items-center justify-between gap-5 border-y border-[#DCE3EA] py-4">
              <span>
                <span className="block text-sm font-bold text-[#0F172A]">명단 외 참석자 추가</span>
                <span className="mt-1 block text-xs text-[#526174]">현장에서 명단에 없는 사람이 직접 추가할 수 있습니다.</span>
              </span>
              <input type="checkbox" checked={mode === 'custom' ? true : allowWalkIn} disabled={mode === 'custom'} onChange={(event) => setAllowWalkIn(event.target.checked)} className="h-5 w-5 accent-[#0F6CBD]" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#334155]">
              공개 링크 비밀번호 <span className="text-xs font-normal text-[#526174]">선택</span>
              <input type="password" className={inputClass} value={publicPassword} onChange={(event) => setPublicPassword(event.target.value)} placeholder="비워두면 비밀번호 없이 접속" />
            </label>
            <dl className="grid gap-3 bg-[#F6F8FB] p-5 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-semibold text-[#526174]">서명 방식</dt><dd className="mt-1 font-bold text-[#0F172A]">{mode === 'fixed' ? '사전 명단' : '현장 자율 입력'}</dd></div>
              <div><dt className="text-xs font-semibold text-[#526174]">참석자</dt><dd className="mt-1 font-bold text-[#0F172A]">{mode === 'fixed' ? `${cleanParticipants.length}명` : '현장 등록'}</dd></div>
              <div><dt className="text-xs font-semibold text-[#526174]">표 열</dt><dd className="mt-1 font-bold text-[#0F172A]">연번 · 성명{columns.map((column) => ` · ${column.label}`).join('')} · 서명</dd></div>
              <div><dt className="text-xs font-semibold text-[#526174]">인쇄</dt><dd className="mt-1 font-bold text-[#0F172A]">{layout <= 15 ? `1단 ${layout}명` : `2단 ${layout}명`}</dd></div>
            </dl>
          </div>
        ) : null}
      </section>

      {error ? <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]">{error}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#DCE3EA] bg-white px-5 text-sm font-bold text-[#334155] hover:bg-[#F6F8FB] disabled:opacity-40">
          <ArrowLeft className="h-4 w-4" /> 이전
        </button>
        {step < 4 ? (
          <button type="button" onClick={goNext} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-6 text-sm font-bold text-white hover:bg-[#0B5B9F]">
            다음 <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" disabled={isCreating} onClick={() => void handleCreate()} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-6 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]">
            <Check className="h-4 w-4" /> {isCreating ? '생성 중' : '등록부 생성'}
          </button>
        )}
      </div>
    </div>
  );
}
