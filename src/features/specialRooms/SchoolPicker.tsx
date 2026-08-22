import { useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle, School, Search, X } from 'lucide-react';
import { useDialogFocus } from '../registry/useDialogFocus';
import { searchSchools } from './specialRoomsService';
import type { NeisSchool } from './specialRoomsService';
import type { SelectedSchool } from './types';

interface SchoolPickerProps {
  value: SelectedSchool | null;
  onChange: (school: SelectedSchool | null) => void;
}

/**
 * 학교를 이름으로 찾아 고른다.
 *
 * 이름만 글자로 받으면 NEIS 코드가 없어 학사일정을 받을 수 없다. 그래서 칸을 누르면
 * 검색창을 열고, 목록에서 고른 것만 값이 된다. 손으로 적어 넣을 수는 없다.
 *
 * 학교 연결은 곁들이는 기능이라 비워 둘 수 있다. 비우면 휴업일 표시 없이 평범한 주간
 * 표가 된다.
 */
export function SchoolPicker({ value, onChange }: SchoolPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NeisSchool[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => setOpen(false);
  useDialogFocus(open ? dialogRef : { current: null }, close, closeRef);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const search = async () => {
    const name = query.trim();
    if (name.length < 2 || searching) return;
    setSearching(true);
    setError('');
    try {
      setResults(await searchSchools(name));
      setSearched(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : '학교를 찾지 못했습니다.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setOpen(true); setQuery(value?.name ?? ''); }}
          className="flex min-h-[44px] flex-1 items-center gap-2 rounded-lg border border-[#C8D0DA] bg-white px-3 text-left text-sm hover:border-[#0F6CBD]"
        >
          <School className="h-4 w-4 shrink-0 text-[#0F6CBD]" />
          {value
            ? <span className="truncate font-bold text-[#0F172A]">{value.name}</span>
            : <span className="text-[#94A3B8]">눌러서 학교를 찾습니다</span>}
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="연결한 학교 지우기"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#C8D0DA] text-[#526174] hover:text-[#B42318]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0F172A]/45 p-0 sm:items-center sm:p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="school-picker-title"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="school-picker-title" className="text-lg font-extrabold text-[#0F172A]">학교 찾기</h2>
                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  NEIS에서 찾습니다. 고르면 그 학교의 공휴일과 재량휴업일을 바로 받아 주간 예약 시간표에 표시합니다.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="학교 찾기 닫기"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#526174] hover:bg-[#F6F8FB]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <label className="relative block flex-1">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#94A3B8]" />
                <span className="sr-only">학교 이름</span>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search(); } }}
                  placeholder="학교 이름을 두 글자 이상"
                  className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] pl-9 pr-3 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={searching || query.trim().length < 2}
                onClick={() => void search()}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-4 text-sm font-bold text-white disabled:bg-[#AAB7C4]"
              >
                {searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {searching ? '찾는 중' : '찾기'}
              </button>
            </div>

            {error ? (
              <p role="alert" className="mt-3 flex items-start gap-2 text-xs font-semibold text-[#B42318]">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
              </p>
            ) : null}

            {searched && !searching && results.length === 0 && !error ? (
              <p className="mt-4 py-8 text-center text-sm text-[#64748B]">
                찾는 학교가 없습니다. 정식 명칭으로 다시 찾아 보세요.
              </p>
            ) : null}

            {results.length > 0 ? (
              <ul className="mt-4 divide-y divide-[#EEF1F4] border-y border-[#DCE3EA]">
                {results.map((school) => (
                  <li key={`${school.officeCode}-${school.schoolCode}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ name: school.name, officeCode: school.officeCode, schoolCode: school.schoolCode });
                        close();
                      }}
                      className="flex w-full min-h-[56px] flex-col justify-center px-1 py-2 text-left hover:bg-[#F6F8FB]"
                    >
                      <span className="truncate text-sm font-bold text-[#0F172A]">{school.name}</span>
                      <span className="truncate text-xs text-[#64748B]">{school.kind} · {school.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
