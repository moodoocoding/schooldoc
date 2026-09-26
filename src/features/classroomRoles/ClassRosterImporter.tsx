import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, FileUp } from 'lucide-react';
import type { ImportSheet } from '../../utils/tabularImport';
import {
  detectRosterColumns, parseRosterImportText, previewRosterImport, readRosterImportFile,
  rosterImportAccept, rosterImportText, type RosterColumnMapping,
} from './classRosterImport';
import { RoleError, RoleField, roleButton, roleInput, roleSecondary } from './RoleControls';

interface Props {
  disabled: boolean;
  onApply: (text: string) => void;
  onPendingChange: (pending: boolean) => void;
}

export function ClassRosterImporter({ disabled, onApply, onPendingChange }: Props) {
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [sheets, setSheets] = useState<ImportSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<RosterColumnMapping>({ headerRow: -1, nameColumn: -1, numberColumn: -1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceButtonRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLHeadingElement>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);
  const selected = sheets[sheetIndex];
  const preview = useMemo(() => selected ? previewRosterImport(selected.data, mapping) : null, [selected, mapping]);
  const columnCount = selected?.data.reduce((max, row) => Math.max(max, row.length), 0) ?? 0;
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const heading = mapping.headerRow >= 0 ? selected?.data[mapping.headerRow]?.[index] : '';
    return { index, label: `${index + 1}열${heading ? ` · ${String(heading).slice(0, 40)}` : ''}` };
  });
  const locked = disabled || loading;

  const analyze = async (read: () => Promise<ImportSheet[]>) => {
    if (locked) return;
    const current = ++request.current;
    setLoading(true);
    setError('');
    onPendingChange(true);
    try {
      const next = await read();
      if (current !== request.current) return;
      if (!next.some((sheet) => sheet.data.some((row) => row.some((cell) => String(cell ?? '').trim())))) {
        throw new Error('파일에 명단이 없습니다. 내용을 확인해 주세요.');
      }
      const headerSheet = next.findIndex((sheet) => detectRosterColumns(sheet.data).headerRow >= 0);
      const detected = headerSheet >= 0 ? headerSheet : next.findIndex((sheet) => detectRosterColumns(sheet.data).nameColumn >= 0);
      const index = detected < 0 ? 0 : detected;
      setSheets(next);
      setSheetIndex(index);
      setMapping(detectRosterColumns(next[index].data));
      requestAnimationFrame(() => { if (current === request.current) previewRef.current?.focus(); });
    } catch (e) {
      if (current !== request.current) return;
      setError(e instanceof Error ? e.message : '명단을 읽지 못했습니다. 파일이나 붙여넣은 내용을 확인해 주세요.');
      onPendingChange(sheets.length > 0);
    } finally {
      if (current === request.current) setLoading(false);
    }
  };

  const clear = () => {
    setSheets([]);
    setPastedText('');
    setError('');
    onPendingChange(false);
  };

  return (
    <section aria-label="명단 가져오기" className="space-y-4 rounded-2xl border border-[#DCE3EA] bg-[#F8FAFC] p-4 sm:p-5">
      <div>
        <h3 className="font-bold">파일이나 표로 한 번에 가져오기</h3>
        <p className="mt-1 text-sm leading-6 text-[#526174]">번호와 이름을 자동으로 찾습니다. 원본 파일은 업로드하지 않고 이 브라우저에서 분석합니다.</p>
      </div>
      <div role="group" aria-label="입력 방식 선택" className="flex flex-wrap gap-2">
        <button ref={mode === 'file' ? sourceButtonRef : undefined} type="button" aria-pressed={mode === 'file'} disabled={locked} className={mode === 'file' ? roleButton : roleSecondary} onClick={() => setMode('file')}><FileUp aria-hidden="true" className="mr-2 inline h-4 w-4" />파일 가져오기</button>
        <button ref={mode === 'paste' ? sourceButtonRef : undefined} type="button" aria-pressed={mode === 'paste'} disabled={locked} className={mode === 'paste' ? roleButton : roleSecondary} onClick={() => setMode('paste')}><ClipboardPaste aria-hidden="true" className="mr-2 inline h-4 w-4" />구글 시트·표 붙여넣기</button>
      </div>
      {mode === 'file' ? (
        <div className="rounded-xl border border-dashed border-[#94A3B8] bg-white p-5 text-center" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
          event.preventDefault();
          if (locked) return;
          if (event.dataTransfer.files.length !== 1) { setError('명단 파일은 한 번에 하나씩 선택해 주세요.'); return; }
          const file = event.dataTransfer.files[0];
          void analyze(() => readRosterImportFile(file));
        }}>
          <button type="button" disabled={locked} className={roleSecondary} onClick={() => inputRef.current?.click()}>명단 파일 선택</button>
          <input ref={inputRef} type="file" hidden accept={rosterImportAccept} data-testid="class-roster-file-input" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void analyze(() => readRosterImportFile(file));
          }} />
          <p className="mt-3 text-sm text-[#526174]">파일을 이곳에 끌어다 놓아도 됩니다.</p>
          <p className="mt-1 text-xs text-[#64748B]">Excel(.xlsx), CSV, TSV, TXT · 최대 20MB</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-[#526174]">구글 시트나 엑셀에서 열 제목과 학생 명단을 함께 복사해 붙여넣으세요. 이름만 한 줄씩 넣어도 됩니다.</p>
          <RoleField label="복사한 표 또는 명단">
            <textarea className={roleInput} rows={5} value={pastedText} disabled={locked} onChange={(event) => {
              setPastedText(event.target.value);
              setSheets([]);
              setError('');
              onPendingChange(false);
            }} placeholder={'번호\t이름\n1\t김하늘\n2\t이바다'} />
          </RoleField>
          <button type="button" className={roleSecondary} disabled={locked || !pastedText.trim()} onClick={() => void analyze(async () => [{ sheet: '붙여넣은 명단', data: await parseRosterImportText(pastedText) }])}>붙여넣은 명단 분석</button>
        </div>
      )}
      {loading ? <p role="status" className="text-sm">명단을 분석하는 중…</p> : null}
      <RoleError message={error} />
      {selected && preview ? (
        <div className="space-y-4 border-t border-[#DCE3EA] pt-4" aria-busy={loading}>
          <h4 ref={previewRef} tabIndex={-1} className="font-bold focus:outline-none">가져온 명단 미리보기</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RoleField label="시트 선택"><select className={roleInput} value={sheetIndex} disabled={locked} onChange={(event) => {
              const index = Number(event.target.value);
              setSheetIndex(index);
              setMapping(detectRosterColumns(sheets[index].data));
            }}>{sheets.map((sheet, index) => <option key={index} value={index}>{sheet.sheet}</option>)}</select></RoleField>
            <RoleField label="열 제목 행"><select className={roleInput} value={mapping.headerRow} disabled={locked} onChange={(event) => setMapping({ ...mapping, headerRow: Number(event.target.value) })}>
              <option value={-1}>없음 · 첫 행부터 읽기</option>
              {selected.data.slice(0, 80).map((row, index) => <option key={index} value={index}>{index + 1}행 · {row.map((cell) => String(cell ?? '')).join(' / ').slice(0, 50)}</option>)}
            </select></RoleField>
            <RoleField label="번호 열"><select className={roleInput} value={mapping.numberColumn} disabled={locked} onChange={(event) => setMapping({ ...mapping, numberColumn: Number(event.target.value) })}>
              <option value={-1}>없음 · 1번부터 자동 부여</option>
              {columns.map((column) => <option key={column.index} value={column.index}>{column.label}</option>)}
            </select></RoleField>
            <RoleField label="이름 열"><select className={roleInput} value={mapping.nameColumn} disabled={locked} onChange={(event) => setMapping({ ...mapping, nameColumn: Number(event.target.value) })}>
              <option value={-1}>이름 열을 선택해 주세요</option>
              {columns.map((column) => <option key={column.index} value={column.index}>{column.label}</option>)}
            </select></RoleField>
          </div>
          <RoleError message={preview.error} />
          {preview.warnings.length ? <ul className="space-y-1 text-sm text-[#854D0E]">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
          {preview.students.length > 0 ? <table className="w-full table-fixed border-collapse bg-white text-left text-sm">
            <caption className="pb-2 text-left font-semibold">{preview.error ? '오류 전까지 읽은 명단' : `학생 ${preview.students.length}명`}</caption>
            <thead><tr className="border-b border-[#DCE3EA]"><th scope="col" className="w-20 p-2">번호</th><th scope="col" className="p-2">이름</th></tr></thead>
            <tbody>{preview.students.map((student, index) => <tr key={index} className="border-b border-[#E2E8F0]"><td className="p-2">{student.number}</td><td className="break-words p-2">{student.name}</td></tr>)}</tbody>
          </table> : null}
          <p className="text-sm leading-6 text-[#526174]">적용하면 아래 편집 명단을 이 명단으로 바꿉니다. 수정 후 ‘학생 명단 저장’을 눌러야 저장됩니다.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={roleButton} disabled={locked || Boolean(preview.error)} onClick={() => { onApply(rosterImportText(preview.students)); clear(); }}>이 명단 적용</button>
            <button type="button" className={roleSecondary} disabled={locked} onClick={() => { clear(); sourceButtonRef.current?.focus(); }}>가져오기 취소</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
