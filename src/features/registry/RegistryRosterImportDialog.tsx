import { useRef } from 'react';
import type { RegistryColumn } from './types';
import { useDialogFocus } from './useDialogFocus';

interface Props {
  rows: { name: string; values: Record<string, string> }[];
  columns: RegistryColumn[];
  currentCount: number;
  onCancel: () => void;
  onApply: (replace: boolean) => void;
}

export function RegistryRosterImportDialog({ rows, columns, currentCount, onCancel, onApply }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(dialogRef, onCancel, cancelRef);
  const buttonClass = 'min-h-[44px] rounded-lg border px-4 text-sm font-bold';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 p-5">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="roster-import-title" aria-describedby="roster-import-description" className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 id="roster-import-title" className="text-lg font-bold">가져올 명단 확인</h2>
        <p id="roster-import-description" className="mt-2 text-sm">새 명단 {rows.length}명 · 현재 명단 {currentCount}명. 기존 명단에 추가하거나 바꿀 수 있습니다.</p>
        <ul className="my-4 space-y-2 break-words text-sm">
          {rows.slice(0, 5).map((row, index) => <li key={index}>{row.name} · {columns.map((column) => row.values[column.id]).filter(Boolean).join(' · ')}</li>)}
        </ul>
        {rows.length > 5 ? <p className="mb-4 text-xs">앞 5명을 표시했습니다.</p> : null}
        <div className="flex flex-wrap gap-2">
          <button ref={cancelRef} type="button" className={buttonClass} onClick={onCancel}>취소</button>
          <button type="button" className={buttonClass} onClick={() => onApply(true)}>기존 명단 바꾸기</button>
          <button type="button" className={`${buttonClass} bg-[#0F6CBD] text-white`} onClick={() => onApply(false)}>명단에 추가</button>
        </div>
      </div>
    </div>
  );
}
