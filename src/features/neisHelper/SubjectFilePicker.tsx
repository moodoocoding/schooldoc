import { useRef, useState } from 'react';
import { Check, FileUp } from 'lucide-react';
import { secondaryClass } from './SubjectSteps';

interface SubjectFilePickerProps {
  label: string;
  accept: string;
  file: File | null;
  disabled: boolean;
  onSelect: (files: FileList | null) => void;
}

export function SubjectFilePicker({ label, accept, file, disabled, onSelect }: SubjectFilePickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const active = dragging && !disabled;

  return (
    <div
      role="group"
      aria-label={`${label} 업로드`}
      className={`rounded-xl border-2 p-4 sm:p-6 ${
        active
          ? 'border-dashed border-blue-700 bg-blue-50'
          : file
            ? 'border-solid border-blue-200 bg-blue-50/50'
            : 'border-dashed border-slate-300 bg-slate-50'
      }`}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes('Files') && !event.dataTransfer.files.length) return;
        event.preventDefault();
        setDragging(false);
        if (!disabled) onSelect(event.dataTransfer.files);
      }}
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FileUp className="h-7 w-7 shrink-0 text-blue-700" aria-hidden="true" />
          <div>
            <p className="font-semibold text-slate-800">{label}</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              {active ? '여기에 놓으세요.' : '파일을 여기에 끌어다 놓으세요.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={`${secondaryClass} shrink-0`}
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          {file ? '파일 바꾸기' : '파일 선택'}
        </button>
      </div>
      <input
        ref={input}
        hidden
        type="file"
        aria-label={label}
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          onSelect(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      <div role="status" aria-atomic="true">
        {file && (
          <div className="mt-4 flex items-start gap-2 border-t border-blue-200 pt-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
            <div className="min-w-0 text-sm">
              <p className="text-slate-600">선택한 파일</p>
              <p className="mt-1 break-words font-semibold text-slate-900">{file.name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
