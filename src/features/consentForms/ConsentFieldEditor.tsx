import { ConsentChoiceSettings } from './ConsentChoiceSettings';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Copy, GripVertical, PenLine, Plus, Redo2, Sparkles, Trash2, Type, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { ConsentPdfPage } from './ConsentPdfPage';
import { alignmentGuides, cloneFieldsToPage, consentFieldMinimumSize, fieldStyle, findAvailableFieldPosition, getConsentFieldLayoutIssues, pageAspectRatio, resolveConsentFieldOverlaps, snapFieldPosition } from './consentFieldLayout';
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
    ? { width: 2.4, height: 1.7 }
  : kind === 'text'
    ? { width: 30, height: 7 }
    : { width: 22, height: 6 };

const resizeCornerLabel = { nw: '왼쪽 위', ne: '오른쪽 위', sw: '왼쪽 아래', se: '오른쪽 아래' } as const;

const kbd = 'rounded border border-[#C8D0DA] bg-[#F6F8FB] px-1.5 py-0.5 font-sans text-[10px] font-bold text-[#334155]';
const modifierLabel = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

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
  const [clipboard, setClipboard] = useState<ConsentFieldDraft[]>([]);
  const [guides, setGuides] = useState<{ vertical: number[]; horizontal: number[] }>({ vertical: [], horizontal: [] });
  const [toast, setToast] = useState('');
  const [zoom, setZoom] = useState(1);
  const resizeRef = useRef<{ field: ConsentFieldDraft; corner: 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; bounds: DOMRect } | null>(null);
  const history = useRef<{ past: ConsentFieldDraft[][]; future: ConsentFieldDraft[][] }>({ past: [], future: [] });
  const [historyDepth, setHistoryDepth] = useState({ past: 0, future: 0 });
  const selected = fields.find((field) => field.id === selectedId) ?? null;
  const selectedMinimum = consentFieldMinimumSize(selected?.kind ?? 'text');
  const pageFields = fields.filter((field) => field.pageIndex === pageIndex);
  const pagesWithFields = Array.from(new Set(fields.map((field) => field.pageIndex))).sort((a, b) => a - b);

  const goToFieldPage = (direction: 1 | -1) => {
    const ahead = direction === 1
      ? pagesWithFields.filter((page) => page > pageIndex)
      : [...pagesWithFields].reverse().filter((page) => page < pageIndex);
    if (ahead.length) setPageIndex(ahead[0]);
  };

  const syncHistoryDepth = () => setHistoryDepth({ past: history.current.past.length, future: history.current.future.length });

  /** 되돌릴 지점을 남긴다. 끌기·크기 조절은 시작할 때 한 번만 부른다. */
  const markHistory = useCallback(() => {
    history.current.past = [...history.current.past.slice(-49), fields];
    history.current.future = [];
    setHistoryDepth({ past: history.current.past.length, future: 0 });
  }, [fields]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? '' : current), 1800);
  };

  const undo = useCallback(() => {
    const previous = history.current.past.pop();
    if (!previous) return;
    history.current.future = [fields, ...history.current.future.slice(0, 49)];
    onFieldsChange(previous);
    syncHistoryDepth();
    notify('되돌렸습니다.');
  }, [fields, onFieldsChange]);

  const redo = useCallback(() => {
    const [next, ...rest] = history.current.future;
    if (!next) return;
    history.current.past = [...history.current.past, fields];
    history.current.future = rest;
    onFieldsChange(next);
    syncHistoryDepth();
    notify('다시 실행했습니다.');
  }, [fields, onFieldsChange]);
  const layoutIssues = getConsentFieldLayoutIssues(fields, analysis.pageCount);
  const overlappingIds = new Set(layoutIssues.filter((issue) => issue.type === 'overlap').flatMap((issue) => issue.fieldIds));
  const pageHasOverlap = pageFields.some((field) => overlappingIds.has(field.id));
  const canContinue = fields.length > 0 && layoutIssues.length === 0;
  const pageSize = analysis.pageSizes[pageIndex];
  const pageRatio = pageAspectRatio(pageSize?.width, pageSize?.height);

  const addField = (kind: ConsentFieldKind) => {
    const size = defaultSize(kind);
    if (kind === 'checkbox') size.height = size.width * pageAspectRatio(pageSize?.width, pageSize?.height);
    const position = findAvailableFieldPosition(pageFields, size);
    const field: ConsentFieldDraft = {
      id: crypto.randomUUID(), kind,
      label: fieldOptions.find((option) => option.kind === kind)?.label ?? '응답',
      required: kind !== 'checkbox', pageIndex,
      ...position,
      ...size,
    };
    markHistory();
    onFieldsChange([...fields, field]);
    setSelectedId(field.id);
  };

  const addChoiceQuestion = () => {
    const choice = { id: crypto.randomUUID(), label: '동의 여부', mode: 'single' as const, required: true, minSelections: 1 };
    const added: ConsentFieldDraft[] = [];
    const pageSize = analysis.pageSizes[pageIndex];
    const size = { width: 2.4, height: 2.4 * pageAspectRatio(pageSize?.width, pageSize?.height) };
    for (const label of ['예', '아니오']) {
      added.push({ id: crypto.randomUUID(), kind: 'checkbox', label, required: false, choice, pageIndex,
        ...size, ...findAvailableFieldPosition([...pageFields, ...added], size) });
    }
    markHistory();
    onFieldsChange([...fields, ...added]);
    setSelectedId(added[0].id);
  };

  const patchSelected = (patch: Partial<ConsentFieldDraft>) => {
    if (!selected) return;
    onFieldsChange(fields.map((field) => field.id === selected.id ? { ...field, ...patch } : field));
  };

  const removeSelected = () => {
    if (!selected) return;
    markHistory();
    onFieldsChange(fields.filter((field) => field.id !== selected.id));
    setSelectedId(null);
  };

  const copySelected = useCallback(() => {
    if (!selected) return;
    setClipboard([selected]);
    notify(`‘${selected.label}’을(를) 복사했습니다.`);
  }, [selected]);

  /** 복사본은 보고 있는 쪽의 빈 자리에 놓는다. 다른 쪽으로 옮겨 붙이는 것이 주된 쓰임이다. */
  const pasteClipboard = useCallback((sources: ConsentFieldDraft[]) => {
    if (!sources.length) return;
    const clones = cloneFieldsToPage(fields.filter((field) => field.pageIndex === pageIndex), sources, pageIndex);
    markHistory();
    onFieldsChange([...fields, ...clones]);
    setSelectedId(clones.at(-1)?.id ?? null);
    notify(`${clones.length}개를 ${pageIndex + 1}쪽에 붙여넣었습니다.`);
  }, [fields, markHistory, onFieldsChange, pageIndex]);

  // 글자를 입력하는 칸에서는 브라우저 기본 동작을 방해하지 않는다.
  // 다만 쪽 번호처럼 '복사 → 쪽 이동 → 붙여넣기' 흐름에 끼는 칸은 예외로 둔다.
  const typingInField = (target: EventTarget | null) => (
    target instanceof HTMLElement
    && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    && target.dataset.allowFieldShortcuts !== 'true'
  );

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (typingInField(event.target)) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (!modifier) return;
      const key = event.key.toLowerCase();
      if (key === 'c' && selected) { event.preventDefault(); copySelected(); }
      if (key === 'v') { event.preventDefault(); pasteClipboard(clipboard); }
      if (key === 'd' && selected) { event.preventDefault(); pasteClipboard([selected]); }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [clipboard, copySelected, pasteClipboard, redo, selected, undo]);

  const startDrag = (event: React.PointerEvent, field: ConsentFieldDraft) => {
    // preventDefault가 기본 포커스 이동까지 막는다. 직접 옮겨야 방향키와 단축키가 바로 먹는다.
    event.preventDefault();
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
    setSelectedId(field.id);
    const canvas = event.currentTarget.parentElement;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left - (field.x / 100) * bounds.width;
    const offsetY = event.clientY - bounds.top - (field.y / 100) * bounds.height;
    const others = fields.filter((candidate) => candidate.pageIndex === field.pageIndex && candidate.id !== field.id);
    markHistory();
    const move = (moveEvent: PointerEvent) => {
      const rawX = Math.max(0, Math.min(100 - field.width, ((moveEvent.clientX - bounds.left - offsetX) / bounds.width) * 100));
      const rawY = Math.max(0, Math.min(100 - field.height, ((moveEvent.clientY - bounds.top - offsetY) / bounds.height) * 100));
      const snapped = snapFieldPosition(field, others, rawX, rawY);
      const x = Math.max(0, Math.min(100 - field.width, snapped.x));
      const y = Math.max(0, Math.min(100 - field.height, snapped.y));
      setGuides(alignmentGuides({ ...field, x, y }, others));
      onFieldsChange(fields.map((candidate) => candidate.id === field.id ? { ...candidate, x, y } : candidate));
    };
    const finish = () => { setGuides({ vertical: [], horizontal: [] }); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); };
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
    markHistory();
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
    const minimum = consentFieldMinimumSize(field.kind);
    const right = field.x + field.width;
    const bottom = field.y + field.height;
    const x = fromLeft ? Math.max(0, Math.min(right - minimum.width, field.x + dx)) : field.x;
    const y = fromTop ? Math.max(0, Math.min(bottom - minimum.height, field.y + dy)) : field.y;
    const width = fromLeft ? right - x : Math.max(consentFieldMinimumSize(field.kind).width, Math.min(100 - field.x, field.width + dx));
    const height = fromTop ? bottom - y : Math.max(consentFieldMinimumSize(field.kind).height, Math.min(100 - field.y, field.height + dy));
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
    markHistory();
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
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedId(field.id);
      return;
    }
    const step = event.shiftKey ? 2 : event.altKey ? 0.1 : 0.5;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      markHistory();
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
        width: Math.max(consentFieldMinimumSize(field.kind).width, Math.min(100 - field.x, field.width + delta.x)),
        height: Math.max(consentFieldMinimumSize(field.kind).height, Math.min(100 - field.y, field.height + delta.y)),
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
    <div data-testid="consent-field-editor" className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EA] pb-4">
        <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />원본 문서로</button>
        <span className="text-xs font-semibold text-[#526174]">2. 응답 필드 배치</span>
      </header>

      <div className="grid items-start gap-6 pb-16 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <div data-testid="consent-field-tools" className="min-w-0 space-y-4">
          <div>
            <p className="text-xs font-bold text-[#0F6CBD]">새 가정통신문 수합</p>
            <h1 className="mt-1 text-2xl font-extrabold">응답 필드 배치</h1>
            <p className="mt-2 text-sm leading-6 text-[#526174]">필드를 추가하고, 원본의 원하는 위치로 옮기세요. 모서리를 잡아 크기를 조절할 수 있습니다.</p>
          </div>

          <section aria-label="필드 추가 도구" className="border-y border-[#DCE3EA] bg-white px-4 py-4">
            <h2 className="text-sm font-bold">필드 추가</h2>
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2">
              {fieldOptions.map(({kind,label,icon:Icon}) => <button key={kind} type="button" onClick={() => addField(kind)} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] px-2 text-xs font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD]"><Icon className="h-4 w-4 shrink-0" />{label}</button>)}
              <button type="button" onClick={addChoiceQuestion} className="col-[1/-1] inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD]"><Plus className="h-4 w-4 shrink-0" />예 / 아니오 질문</button>
            </div>
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2 border-t border-[#EEF1F4] pt-3">
              <button type="button" disabled={!historyDepth.past} onClick={undo} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] px-2 text-xs font-bold text-[#334155] disabled:cursor-not-allowed disabled:opacity-50"><Undo2 className="h-4 w-4 shrink-0" />되돌리기</button>
              <button type="button" disabled={!historyDepth.future} onClick={redo} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] px-2 text-xs font-bold text-[#334155] disabled:cursor-not-allowed disabled:opacity-50"><Redo2 className="h-4 w-4 shrink-0" />다시 실행</button>
              <button type="button" disabled={!selected} onClick={copySelected} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] px-2 text-xs font-bold text-[#334155] disabled:cursor-not-allowed disabled:opacity-50"><Copy className="h-4 w-4 shrink-0" />복사</button>
              <button type="button" disabled={!clipboard.length} onClick={() => pasteClipboard(clipboard)} className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#C8D0DA] px-2 text-xs font-bold text-[#334155] disabled:cursor-not-allowed disabled:opacity-50">붙여넣기</button>
            </div>
            <details className="mt-3 border-t border-[#EEF1F4] pt-3 text-xs text-[#526174]">
              <summary className="flex min-h-[44px] cursor-pointer items-center font-semibold">단축키 안내</summary>
              <p className="mt-1 leading-5">필드를 선택한 상태에서 사용할 수 있습니다. 이름 입력 중에는 글자를 편집합니다.</p>
              <ul className="mt-2 space-y-2 leading-5">
                <li><kbd className={kbd}>{modifierLabel}</kbd> + <kbd className={kbd}>C</kbd> 복사 · <kbd className={kbd}>V</kbd> 붙여넣기</li>
                <li><kbd className={kbd}>{modifierLabel}</kbd> + <kbd className={kbd}>D</kbd> 복제 · <kbd className={kbd}>Z</kbd> 되돌리기</li>
                <li><kbd className={kbd}>방향키</kbd> 이동 · <kbd className={kbd}>Alt</kbd> + 방향키 크기 조절 · <kbd className={kbd}>Delete</kbd> 삭제</li>
              </ul>
            </details>
            {pageHasOverlap ? <button type="button" onClick={() => { markHistory(); onFieldsChange(resolveConsentFieldOverlaps(fields,pageIndex)); }} className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#E6A700] bg-[#FFF9ED] px-3 text-xs font-bold text-[#76520E]"><Sparkles className="h-4 w-4 shrink-0" />겹침 자동 해제</button> : null}
            {layoutIssues.find(issue => issue.type === 'choice') ? <p role="alert" className="mt-3 text-sm text-[#B42318]">{layoutIssues.find(issue => issue.type === 'choice')?.message}</p> : null}
            {pageHasOverlap ? <p role="alert" className="mt-3 flex items-start gap-2 text-xs font-semibold leading-5 text-[#9A6700]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />겹치는 입력란의 위치를 조정하거나 자동 해제를 사용하세요.</p> : null}
          </section>
          <section data-testid="consent-field-settings" className={`${selected ? 'fixed inset-x-4 bottom-20 z-40 max-h-[55vh] overflow-y-auto rounded-lg border border-[#C8D0DA] shadow-2xl' : ''} min-w-0 border-y border-[#DCE3EA] bg-white px-4 py-4 lg:static lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-x-0 lg:shadow-none`}>
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold">필드 설정</h2>{selected ? <button type="button" onClick={() => setSelectedId(null)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F6F8FB]" aria-label="필드 설정 닫기" title="닫기"><X className="h-4 w-4" /></button> : <span className="text-[11px] font-semibold text-[#64748B]">필드를 선택하세요</span>}</div>
          {!selected ? <div className="py-5 text-center text-xs leading-5 text-[#64748B]">필드를 추가하거나<br />문서 위 필드를 선택하세요.{clipboard.length ? <><br /><br /><span className="font-semibold text-[#0F6CBD]">복사한 필드 {clipboard.length}개</span><br />{modifierLabel}+V로 이 쪽에 붙여넣습니다.</> : null}</div> : <div className="mt-5 space-y-5"><div><span className="text-xs font-bold text-[#64748B]">종류</span><p className="mt-1 text-sm font-bold">{fieldOptions.find((option) => option.kind === selected.kind)?.label}</p></div><label className="block text-xs font-bold text-[#334155]">표시 이름<input value={selected.label} onFocus={markHistory} onChange={(event) => patchSelected({ label: event.target.value })} className={`mt-2 min-h-[44px] w-full rounded-lg border px-3 text-sm font-normal ${selected.label.trim() ? 'border-[#C8D0DA]' : 'border-[#D92D20]'}`} />{selected.label.trim() ? null : <span className="mt-1 block text-[#B42318]">표시 이름을 입력하세요.</span>}</label>{selected.kind === 'checkbox' ? <ConsentChoiceSettings selected={selected} fields={fields} onChange={next => { markHistory(); onFieldsChange(next); }} /> : null}{!selected.choice ? <label className="flex min-h-[44px] items-center gap-3 text-sm font-bold"><input type="checkbox" checked={selected.required} onChange={(event) => patchSelected({ required: event.target.checked })} className="h-4 w-4" />{selected.kind === 'checkbox' ? '반드시 체크해야 하는 확인 항목' : '필수 응답'}</label> : null}<details><summary className="flex min-h-[44px] cursor-pointer flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#526174]"><span>크기와 위치</span><span className="text-[10px] font-semibold text-[#64748B]">쪽 대비 %</span></summary>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <label className="text-[#526174]">너비<input type="number" step="0.1" min={selectedMinimum.width} max={100 - selected.x} value={Number(selected.width.toFixed(1))} onChange={(event) => patchSelected({ width: Math.max(selectedMinimum.width, Math.min(100 - selected.x, Number(event.target.value))) })} className="mt-1 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-2 tabular-nums" /></label>
            <label className="text-[#526174]">높이<input type="number" step="0.1" min={selectedMinimum.height} max={100 - selected.y} value={Number(selected.height.toFixed(1))} onChange={(event) => patchSelected({ height: Math.max(selectedMinimum.height, Math.min(100 - selected.y, Number(event.target.value))) })} className="mt-1 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-2 tabular-nums" /></label>
            <label className="text-[#526174]">가로 위치<input type="number" step="0.1" min="0" max={100 - selected.width} value={Number(selected.x.toFixed(1))} onChange={(event) => patchSelected({ x: Math.max(0, Math.min(100 - selected.width, Number(event.target.value))) })} className="mt-1 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-2 tabular-nums" /></label>
            <label className="text-[#526174]">세로 위치<input type="number" step="0.1" min="0" max={100 - selected.height} value={Number(selected.y.toFixed(1))} onChange={(event) => patchSelected({ y: Math.max(0, Math.min(100 - selected.height, Number(event.target.value))) })} className="mt-1 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-2 tabular-nums" /></label>
          </div></details>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2"><button type="button" onClick={() => pasteClipboard([selected])} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] text-sm font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD]"><Copy className="h-4 w-4" />복제</button><button type="button" onClick={removeSelected} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#FECACA] text-sm font-bold text-[#B42318] hover:bg-[#FEF2F2]"><Trash2 className="h-4 w-4" />필드 삭제</button></div></div>}
          <section aria-label="배치된 필드" className="mt-6 border-t border-[#EEF1F4] pt-5">
            <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold">배치된 필드</h2><span className="text-xs font-semibold text-[#64748B]">{fields.length}개</span></div>
            {fields.length === 0
              ? <p className="mt-3 text-xs leading-5 text-[#64748B]">아직 배치한 필드가 없습니다. 위에서 필드를 추가하세요.</p>
              : <ul className="mt-3 space-y-1.5">{[...fields].sort((a, b) => a.pageIndex - b.pageIndex || a.y - b.y).map((field) => {
                const Icon = fieldOptions.find((option) => option.kind === field.kind)?.icon ?? Type;
                return <li key={field.id}><button type="button" onClick={() => { setPageIndex(field.pageIndex); setSelectedId(field.id); }} className={`flex w-full min-h-[40px] items-center gap-2 rounded-lg border px-2.5 text-left text-xs font-semibold ${field.id === selectedId ? 'border-[#0F6CBD] bg-[#EFF6FC] text-[#0F6CBD]' : overlappingIds.has(field.id) ? 'border-[#FECACA] bg-[#FEF2F2] text-[#B42318]' : 'border-[#DCE3EA] text-[#334155] hover:border-[#0F6CBD]'}`}>
                  <span className="shrink-0 rounded bg-[#EEF1F4] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#526174]">{field.pageIndex + 1}쪽</span>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{field.label}{field.required ? ' *' : ''}</span>
                  {overlappingIds.has(field.id) ? <AlertTriangle className="ml-auto h-3.5 w-3.5 shrink-0" /> : null}
                </button></li>;
              })}</ul>}
          </section>
          </section>
        </div>

        <section aria-label="PDF 필드 편집" className="min-w-0 border-y border-[#DCE3EA] bg-[#E9EDF2]">
          <div data-testid="consent-editor-document-toolbar" className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EA] bg-white px-3 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="mr-2 text-sm font-bold">원본 PDF</h2>
              <button type="button" disabled={pageIndex === 0} onClick={() => setPageIndex(value => value - 1)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#DCE3EA] text-[#334155] disabled:opacity-50" aria-label="이전 쪽"><ChevronLeft className="h-5 w-5" /></button>
              <input type="number" min={1} max={analysis.pageCount} value={pageIndex + 1} onChange={event => { const page=Math.round(Number(event.target.value)); if(Number.isFinite(page)) setPageIndex(Math.max(0,Math.min(analysis.pageCount-1,page-1))); }} data-allow-field-shortcuts="true" className="h-11 w-16 rounded-lg border border-[#C8D0DA] bg-white text-center text-xs font-bold tabular-nums" aria-label="쪽 번호" />
              <span className="text-xs font-semibold tabular-nums text-[#526174]">/ {analysis.pageCount}쪽</span>
              <button type="button" disabled={pageIndex+1 >= analysis.pageCount} onClick={() => setPageIndex(value => value + 1)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#DCE3EA] text-[#334155] disabled:opacity-50" aria-label="다음 쪽"><ChevronRight className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" disabled={zoom<=0.5} onClick={() => setZoom(value => Math.max(0.5,Math.round((value-0.25)*100)/100))} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#DCE3EA] text-[#334155] disabled:opacity-50" aria-label="축소"><ZoomOut className="h-4 w-4" /></button>
              <span className="min-w-[48px] text-center text-xs font-bold tabular-nums text-[#334155]" aria-live="polite">{Math.round(zoom*100)}%</span>
              <button type="button" disabled={zoom>=3} onClick={() => setZoom(value => Math.min(3,Math.round((value+0.25)*100)/100))} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#DCE3EA] text-[#334155] disabled:opacity-50" aria-label="확대"><ZoomIn className="h-4 w-4" /></button>
              <button type="button" onClick={() => setZoom(1)} className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#334155]">너비 맞춤</button>
            </div>
            {pagesWithFields.length > 1 ? <div className="flex w-full flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-[#526174]">필드가 있는 쪽으로</span>
              <button type="button" disabled={!pagesWithFields.some(page => page<pageIndex)} onClick={() => goToFieldPage(-1)} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#334155] disabled:opacity-50" aria-label="이전 배치 페이지"><ChevronLeft className="h-4 w-4" />이전</button>
              <button type="button" disabled={!pagesWithFields.some(page => page>pageIndex)} onClick={() => goToFieldPage(1)} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#334155] disabled:opacity-50" aria-label="다음 배치 페이지">다음<ChevronRight className="h-4 w-4" /></button>
            </div> : null}
          </div>
          <div data-testid="consent-editor-document-viewport" className="overflow-x-auto overflow-y-hidden p-3 sm:p-6">
              <div data-testid="consent-field-canvas" data-field-canvas style={{ aspectRatio: pageRatio, width: `${zoom * 100}%` }} className="relative mx-auto shrink-0 overflow-hidden bg-white shadow-[0_8px_28px_rgba(15,23,42,0.16)]">
            <ConsentPdfPage file={file} pageNumber={pageIndex + 1} />
            {guides.vertical.map((at) => <span key={`v-${at}`} aria-hidden className="pointer-events-none absolute top-0 z-30 h-full border-l border-dashed border-[#D92D20]" style={{ left: `${at}%` }} />)}
            {guides.horizontal.map((at) => <span key={`h-${at}`} aria-hidden className="pointer-events-none absolute left-0 z-30 w-full border-t border-dashed border-[#D92D20]" style={{ top: `${at}%` }} />)}
            {pageFields.map((field) => <div key={field.id} role="button" tabIndex={0} aria-invalid={overlappingIds.has(field.id)} onPointerDown={(event) => startDrag(event, field)} onClick={() => setSelectedId(field.id)} onKeyDown={(event) => moveFieldByKeyboard(event, field)} style={fieldStyle(field)} className={`absolute z-20 flex min-h-0 touch-none items-center justify-center overflow-visible border-2 ${field.kind === 'checkbox' ? 'p-0' : 'px-1'} text-[10px] font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]/35 ${field.kind !== 'checkbox' && field.id === selectedId ? "bg-white/85" : "bg-transparent"} ${overlappingIds.has(field.id) ? 'border-[#D92D20] text-[#B42318]' : field.id === selectedId ? 'border-[#0F6CBD] text-[#0F6CBD]' : 'border-[#64748B] text-[#334155]'}`} aria-label={`${field.label} 필드${overlappingIds.has(field.id) ? ' 겹침 오류' : ''}`} aria-describedby="field-keyboard-help">{field.kind !== 'checkbox' && field.id === selectedId ? <GripVertical className="mr-0.5 h-3 w-3 shrink-0" /> : null}{field.kind !== 'checkbox' ? <span className="truncate rounded-sm bg-white/85 px-1">{field.label}{field.required ? ' *' : ''}</span> : null}</div>)}
            {/* 선택 영역과 조절점을 나누어 중첩된 버튼을 피한다. */}
            {selected?.pageIndex === pageIndex ? <div role="group" aria-label={`${selected.label} 크기 조절 도구`} style={fieldStyle(selected)} className="pointer-events-none absolute z-20 border-2 border-transparent">{(['nw', 'ne', 'sw', 'se'] as const).map((corner) => <button key={corner} type="button" data-resize-handle={corner} onMouseDown={(event) => startMouseResize(event, selected, corner)} onPointerDown={(event) => startResize(event, selected, corner)} onPointerMove={resizeField} onPointerUp={finishResize} onPointerCancel={finishResize} onClick={(event) => event.stopPropagation()} className={`pointer-events-auto absolute h-11 w-11 touch-none bg-transparent before:absolute before:h-3 before:w-3 before:rounded-full before:border-2 before:border-white before:bg-[#0F6CBD] before:shadow-sm ${corner === 'nw' ? '-left-11 -top-11 before:bottom-0 before:right-0 before:translate-x-1/2 before:translate-y-1/2 cursor-nwse-resize' : corner === 'ne' ? '-right-11 -top-11 before:bottom-0 before:left-0 before:-translate-x-1/2 before:translate-y-1/2 cursor-nesw-resize' : corner === 'sw' ? '-bottom-11 -left-11 before:top-0 before:right-0 before:translate-x-1/2 before:-translate-y-1/2 cursor-nesw-resize' : '-bottom-11 -right-11 before:top-0 before:left-0 before:-translate-x-1/2 before:-translate-y-1/2 cursor-nwse-resize'}`} aria-label={`${selected.label} 필드 ${resizeCornerLabel[corner]} 크기 조절`} title={`${resizeCornerLabel[corner]} 크기 조절`} />)}
            </div> : null}
            <p id="field-keyboard-help" className="sr-only">방향키로 이동하고 Alt와 방향키로 크기를 조절하며 Delete 키로 삭제합니다.</p>
          </div>
          </div>
        </section>
      </div>
      {toast ? <p role="status" className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0F172A]/90 px-4 py-2 text-xs font-bold text-white shadow-lg">{toast}</p> : null}
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE3EA] bg-[#F6F8FB]/95 py-3 backdrop-blur">
        <p className={`text-xs ${layoutIssues.length ? 'font-semibold text-[#B42318]' : 'text-[#526174]'}`}>{layoutIssues.length ? layoutIssues[0].message : fields.length>0 ? `응답 필드 ${fields.length}개가 배치되었습니다.` : '문서에 응답 필드를 하나 이상 배치하세요.'}</p>
        <button type="button" disabled={!canContinue} onClick={onNext} className="ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]">필드 배치 완료<ArrowRight className="h-4 w-4 shrink-0" /></button>
      </div>
    </div>
  );
}
