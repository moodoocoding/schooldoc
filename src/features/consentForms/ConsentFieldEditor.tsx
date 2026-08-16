import { useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, GripVertical, PenLine, Plus, Sparkles, Trash2, Type, X } from 'lucide-react';
import { ConsentPdfPage } from './ConsentPdfPage';
import { fieldStyle, findAvailableFieldPosition, getConsentFieldLayoutIssues, pageAspectRatio, resolveConsentFieldOverlaps } from './consentFieldLayout';
import type { ConsentDocumentAnalysis, ConsentFieldDraft, ConsentFieldKind } from './types';

const fieldOptions: Array<{ kind: ConsentFieldKind; label: string; icon: typeof Type }> = [
  { kind: 'text', label: '텍스트', icon: Type },
  { kind: 'checkbox', label: '체크박스', icon: CheckSquare },
  { kind: 'date', label: '날짜', icon: CalendarDays },
  { kind: 'signature', label: '서명', icon: PenLine },
];

const defaultSize = (kind: ConsentFieldKind) => kind === 'signature'
  ? { width: 28, height: 10 }
  : kind === 'checkbox'
    ? { width: 18, height: 6 }
  : kind === 'text'
    ? { width: 30, height: 7 }
    : { width: 22, height: 6 };

const resizeCornerLabel = { nw: '왼쪽 위', ne: '오른쪽 위', sw: '왼쪽 아래', se: '오른쪽 아래' } as const;

export function ConsentFieldEditor({ analysis, file, fields, onFieldsChange, onBack, onNext }: {
  analysis: ConsentDocumentAnalysis;
  file: File;
  fields: ConsentFieldDraft[];
  onFieldsChange: (fields: ConsentFieldDraft[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(fields[0]?.id ?? null);
  const resizeRef = useRef<{ field: ConsentFieldDraft; corner: 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; bounds: DOMRect } | null>(null);
  const selected = fields.find((field) => field.id === selectedId) ?? null;
  const pageFields = fields.filter((field) => field.pageIndex === pageIndex);
  const layoutIssues = getConsentFieldLayoutIssues(fields, analysis.pageCount);
  const overlappingIds = new Set(layoutIssues.filter((issue) => issue.type === 'overlap').flatMap((issue) => issue.fieldIds));
  const pageHasOverlap = pageFields.some((field) => overlappingIds.has(field.id));
  const canContinue = fields.length > 0 && layoutIssues.length === 0;
  const pageSize = analysis.pageSizes[pageIndex];

  const addField = (kind: ConsentFieldKind) => {
    const size = defaultSize(kind);
    const position = findAvailableFieldPosition(pageFields, size);
    const field: ConsentFieldDraft = {
      id: crypto.randomUUID(), kind,
      label: fieldOptions.find((option) => option.kind === kind)?.label ?? '응답',
      required: true, pageIndex,
      ...position,
      ...size,
    };
    onFieldsChange([...fields, field]);
    setSelectedId(field.id);
  };

  const patchSelected = (patch: Partial<ConsentFieldDraft>) => {
    if (!selected) return;
    onFieldsChange(fields.map((field) => field.id === selected.id ? { ...field, ...patch } : field));
  };

  const removeSelected = () => {
    if (!selected) return;
    onFieldsChange(fields.filter((field) => field.id !== selected.id));
    setSelectedId(null);
  };

  const startDrag = (event: React.PointerEvent, field: ConsentFieldDraft) => {
    event.preventDefault();
    setSelectedId(field.id);
    const canvas = event.currentTarget.parentElement;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left - (field.x / 100) * bounds.width;
    const offsetY = event.clientY - bounds.top - (field.y / 100) * bounds.height;
    const move = (moveEvent: PointerEvent) => {
      const x = Math.max(0, Math.min(100 - field.width, ((moveEvent.clientX - bounds.left - offsetX) / bounds.width) * 100));
      const y = Math.max(0, Math.min(100 - field.height, ((moveEvent.clientY - bounds.top - offsetY) / bounds.height) * 100));
      onFieldsChange(fields.map((candidate) => candidate.id === field.id ? { ...candidate, x, y } : candidate));
    };
    const finish = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
  };

  const startResize = (event: React.PointerEvent, field: ConsentFieldDraft, corner: 'nw' | 'ne' | 'sw' | 'se') => {
    event.stopPropagation();
    if (event.pointerType === 'mouse') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(field.id);
    const canvas = event.currentTarget.closest('[data-field-canvas]');
    if (!(canvas instanceof HTMLElement)) return;
    const bounds = canvas.getBoundingClientRect();
    resizeRef.current = { field, corner, startX: event.clientX, startY: event.clientY, bounds };
  };

  const applyResize = (clientX: number, clientY: number) => {
    const resizing = resizeRef.current;
    if (!resizing) return;
    const { field, corner, startX, startY, bounds } = resizing;
    const dx = ((clientX - startX) / bounds.width) * 100;
    const dy = ((clientY - startY) / bounds.height) * 100;
    const fromLeft = corner === 'nw' || corner === 'sw';
    const fromTop = corner === 'nw' || corner === 'ne';
    const right = field.x + field.width;
    const bottom = field.y + field.height;
    const x = fromLeft ? Math.max(0, Math.min(right - 10, field.x + dx)) : field.x;
    const y = fromTop ? Math.max(0, Math.min(bottom - 4, field.y + dy)) : field.y;
    const width = fromLeft ? right - x : Math.max(10, Math.min(100 - field.x, field.width + dx));
    const height = fromTop ? bottom - y : Math.max(4, Math.min(100 - field.y, field.height + dy));
    onFieldsChange(fields.map((candidate) => candidate.id === field.id ? { ...candidate, x, y, width, height } : candidate));
  };

  const resizeField = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    applyResize(event.clientX, event.clientY);
  };

  const startMouseResize = (event: React.MouseEvent, field: ConsentFieldDraft, corner: 'nw' | 'ne' | 'sw' | 'se') => {
    event.preventDefault();
    event.stopPropagation();
    const canvas = event.currentTarget.closest('[data-field-canvas]');
    if (!(canvas instanceof HTMLElement)) return;
    resizeRef.current = { field, corner, startX: event.clientX, startY: event.clientY, bounds: canvas.getBoundingClientRect() };
    const move = (moveEvent: MouseEvent) => applyResize(moveEvent.clientX, moveEvent.clientY);
    const finish = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', finish);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', finish);
  };

  const finishResize = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    resizeRef.current = null;
  };

  const moveFieldByKeyboard = (event: React.KeyboardEvent, field: ConsentFieldDraft) => {
    const step = event.shiftKey ? 2 : 0.5;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onFieldsChange(fields.filter((candidate) => candidate.id !== field.id));
      setSelectedId(null);
      return;
    }
    const delta = event.key === 'ArrowLeft' ? { x: -step, y: 0 }
      : event.key === 'ArrowRight' ? { x: step, y: 0 }
        : event.key === 'ArrowUp' ? { x: 0, y: -step }
          : event.key === 'ArrowDown' ? { x: 0, y: step }
            : null;
    if (!delta) return;
    event.preventDefault();
    if (event.altKey) {
      onFieldsChange(fields.map((candidate) => candidate.id === field.id ? {
        ...candidate,
        width: Math.max(10, Math.min(100 - field.x, field.width + delta.x)),
        height: Math.max(4, Math.min(100 - field.y, field.height + delta.y)),
      } : candidate));
      return;
    }
    onFieldsChange(fields.map((candidate) => candidate.id === field.id ? {
      ...candidate,
      x: Math.max(0, Math.min(100 - field.width, field.x + delta.x)),
      y: Math.max(0, Math.min(100 - field.height, field.y + delta.y)),
    } : candidate));
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EA] pb-4"><button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />원본 문서로</button><span className="text-xs font-semibold text-[#526174]">2. 응답 필드 배치</span></header>
      <div><p className="text-xs font-bold text-[#0F6CBD]">새 가정통신문 수합</p><h1 className="mt-1 text-2xl font-extrabold">응답 필드 배치</h1><p className="mt-2 text-sm text-[#526174]">필드를 추가한 뒤 드래그로 이동하고 모서리를 잡아 크기를 조절하세요.</p></div>

      <section className="border-y border-[#DCE3EA] bg-white px-4 py-4">
        <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-bold text-[#334155]">필드 추가</span>{fieldOptions.map(({ kind, label, icon: Icon }) => <button key={kind} type="button" onClick={() => addField(kind)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD]"><Plus className="h-3.5 w-3.5" /><Icon className="h-4 w-4" />{label}</button>)}{pageHasOverlap ? <button type="button" onClick={() => onFieldsChange(resolveConsentFieldOverlaps(fields, pageIndex))} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#E6A700] bg-[#FFF9ED] px-3 text-xs font-bold text-[#76520E]"><Sparkles className="h-4 w-4" />겹침 자동 해제</button> : null}<span className="ml-auto text-xs font-semibold text-[#64748B]">배치됨 {fields.length}개</span></div>
        {pageHasOverlap ? <p role="alert" className="mt-3 flex items-start gap-2 border-t border-[#F5D08A] pt-3 text-xs font-semibold leading-5 text-[#9A6700]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />겹치는 입력란은 응답자가 작성하기 어렵습니다. 위치를 조정하거나 자동 해제를 사용하세요.</p> : null}
      </section>

      <div className="grid gap-4 pb-16 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 bg-[#E9EDF2] p-3 sm:p-6">
          <div className="mb-3 flex items-center justify-between"><button type="button" disabled={pageIndex === 0} onClick={() => setPageIndex((value) => value - 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#334155] disabled:opacity-30" aria-label="이전 페이지"><ChevronLeft className="h-5 w-5" /></button><strong className="text-xs text-[#526174]">{pageIndex + 1} / {analysis.pageCount}</strong><button type="button" disabled={pageIndex + 1 >= analysis.pageCount} onClick={() => setPageIndex((value) => value + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#334155] disabled:opacity-30" aria-label="다음 페이지"><ChevronRight className="h-5 w-5" /></button></div>
          <div data-testid="consent-field-canvas" data-field-canvas style={{ aspectRatio: pageAspectRatio(pageSize?.width, pageSize?.height) }} className="relative mx-auto w-full max-w-[794px] overflow-hidden bg-white shadow-[0_8px_28px_rgba(15,23,42,0.16)]">
            <ConsentPdfPage file={file} pageNumber={pageIndex + 1} />
            {pageFields.map((field) => <div key={field.id} role="button" tabIndex={0} aria-invalid={overlappingIds.has(field.id)} onPointerDown={(event) => startDrag(event, field)} onClick={() => setSelectedId(field.id)} onKeyDown={(event) => moveFieldByKeyboard(event, field)} style={fieldStyle(field)} className={`absolute z-20 flex min-h-7 touch-none items-center justify-center overflow-visible border-2 bg-white/90 px-1 text-[10px] font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]/35 ${overlappingIds.has(field.id) ? 'border-[#D92D20] text-[#B42318]' : field.id === selectedId ? 'border-[#0F6CBD] text-[#0F6CBD]' : 'border-[#64748B] text-[#334155]'}`} aria-label={`${field.label} 필드${overlappingIds.has(field.id) ? ' 겹침 오류' : ''}`} aria-describedby="field-keyboard-help"><GripVertical className="mr-0.5 h-3 w-3 shrink-0" />{field.kind === 'checkbox' ? <span className="mr-1 h-3 w-3 shrink-0 border border-current bg-white" /> : null}<span className="truncate">{field.required ? '* ' : ''}{field.label}</span>{field.id === selectedId ? <>{(['nw', 'ne', 'sw', 'se'] as const).map((corner) => <button key={corner} type="button" data-resize-handle={corner} onMouseDown={(event) => startMouseResize(event, field, corner)} onPointerDown={(event) => startResize(event, field, corner)} onPointerMove={resizeField} onPointerUp={finishResize} onPointerCancel={finishResize} onClick={(event) => event.stopPropagation()} className={`absolute h-11 w-11 touch-none bg-transparent before:absolute before:left-1/2 before:top-1/2 before:h-3 before:w-3 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border-2 before:border-white before:bg-[#0F6CBD] before:shadow-sm ${corner === 'nw' ? '-left-[22px] -top-[22px] cursor-nwse-resize' : corner === 'ne' ? '-right-[22px] -top-[22px] cursor-nesw-resize' : corner === 'sw' ? '-bottom-[22px] -left-[22px] cursor-nesw-resize' : '-bottom-[22px] -right-[22px] cursor-nwse-resize'}`} aria-label={`${field.label} 필드 ${resizeCornerLabel[corner]} 크기 조절`} title={`${resizeCornerLabel[corner]} 크기 조절`} />)}</> : null}</div>)}
            <p id="field-keyboard-help" className="sr-only">방향키로 이동하고 Alt와 방향키로 크기를 조절하며 Delete 키로 삭제합니다.</p>
          </div>
        </section>

        <aside data-testid="consent-field-settings" className={`${selected ? 'fixed inset-x-4 bottom-20 z-30 max-h-[55vh] overflow-y-auto rounded-lg border border-[#C8D0DA] shadow-2xl' : 'order-first'} bg-white px-5 py-5 lg:order-none lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-4 lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:rounded-none lg:border-x-0 lg:shadow-none`}>
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold">필드 설정</h2>{selected ? <button type="button" onClick={() => setSelectedId(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F6F8FB] lg:hidden" aria-label="필드 설정 닫기" title="닫기"><X className="h-4 w-4" /></button> : <span className="text-[11px] font-semibold text-[#64748B]">필드를 선택하세요</span>}</div>
          {!selected ? <div className="py-12 text-center text-xs leading-5 text-[#64748B]">필드를 추가하거나<br />문서 위 필드를 선택하세요.</div> : <div className="mt-5 space-y-5"><div><span className="text-xs font-bold text-[#64748B]">종류</span><p className="mt-1 text-sm font-bold">{fieldOptions.find((option) => option.kind === selected.kind)?.label}</p></div><label className="block text-xs font-bold text-[#334155]">표시 이름<input value={selected.label} onChange={(event) => patchSelected({ label: event.target.value })} className={`mt-2 min-h-[44px] w-full rounded-lg border px-3 text-sm font-normal ${selected.label.trim() ? 'border-[#C8D0DA]' : 'border-[#D92D20]'}`} />{selected.label.trim() ? null : <span className="mt-1 block text-[#B42318]">표시 이름을 입력하세요.</span>}</label><label className="flex min-h-[44px] items-center gap-3 text-sm font-bold"><input type="checkbox" checked={selected.required} onChange={(event) => patchSelected({ required: event.target.checked })} className="h-4 w-4" />필수 응답</label><div className="grid grid-cols-2 gap-2 text-xs"><label>너비<input type="number" min="10" max={Math.floor(100 - selected.x)} value={Math.round(selected.width)} onChange={(event) => patchSelected({ width: Math.max(10, Math.min(100 - selected.x, Number(event.target.value))) })} className="mt-1 min-h-[40px] w-full rounded-lg border border-[#C8D0DA] px-2" /></label><label>높이<input type="number" min="4" max={Math.floor(100 - selected.y)} value={Math.round(selected.height)} onChange={(event) => patchSelected({ height: Math.max(4, Math.min(100 - selected.y, Number(event.target.value))) })} className="mt-1 min-h-[40px] w-full rounded-lg border border-[#C8D0DA] px-2" /></label></div><button type="button" onClick={removeSelected} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#FECACA] text-sm font-bold text-[#B42318] hover:bg-[#FEF2F2]"><Trash2 className="h-4 w-4" />필드 삭제</button></div>}
        </aside>
      </div>
      <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-[#DCE3EA] bg-[#F6F8FB]/95 py-3 backdrop-blur">
        <p className={`hidden text-xs sm:block ${layoutIssues.length ? 'font-semibold text-[#B42318]' : 'text-[#526174]'}`}>{layoutIssues.length ? layoutIssues[0].message : fields.length > 0 ? `응답 필드 ${fields.length}개가 배치되었습니다.` : '문서에 응답 필드를 하나 이상 배치하세요.'}</p>
        <button type="button" disabled={!canContinue} onClick={onNext} className="ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]">필드 배치 완료<ArrowRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
