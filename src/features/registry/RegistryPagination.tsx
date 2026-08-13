import { ChevronLeft, ChevronRight } from 'lucide-react';

interface RegistryPaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  label: string;
  itemLabel?: string;
  showItemRange?: boolean;
}

export function RegistryPagination({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  label,
  itemLabel = '명',
  showItemRange = true,
}: RegistryPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), pageCount);
  const firstItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, totalItems);

  if (pageCount === 1 && totalItems <= pageSize) return null;

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE3EA] bg-[#F8FAFC] px-4 py-3">
      <p className="text-xs font-semibold text-[#526174]">
        {showItemRange ? `${firstItem}-${lastItem} / ${totalItems}${itemLabel}` : `전체 ${totalItems}${itemLabel}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={safePage === 1}
          onClick={() => onPageChange(safePage - 1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#DCE3EA] bg-white text-[#334155] hover:bg-[#EFF6FC] disabled:opacity-40"
          aria-label="이전 페이지"
          title="이전 페이지"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <label className="flex items-center gap-2 text-xs font-semibold text-[#526174]">
          <span className="sr-only">{label} 선택</span>
          <select
            value={safePage}
            onChange={(event) => onPageChange(Number(event.target.value))}
            className="h-10 rounded-lg border border-[#DCE3EA] bg-white px-3 text-sm font-bold text-[#334155] focus:border-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]/15"
            aria-label={`${label} 선택`}
          >
            {Array.from({ length: pageCount }, (_, index) => (
              <option key={index + 1} value={index + 1}>{index + 1} / {pageCount}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={safePage === pageCount}
          onClick={() => onPageChange(safePage + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#DCE3EA] bg-white text-[#334155] hover:bg-[#EFF6FC] disabled:opacity-40"
          aria-label="다음 페이지"
          title="다음 페이지"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
