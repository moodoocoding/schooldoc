import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { missionCounts, missionDateLabel, type Mission, type MissionState } from './missionApi';
import { matchesMissionFilter, missionFilters, type MissionFilter } from './missionManagementOrder';

const pageSize = 5;
const control = 'min-h-11 min-w-0 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm font-normal text-[#0F172A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD]';
const pagination = 'inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-bold text-[#0B5B9F] hover:bg-[#EFF6FC] aria-disabled:text-[#64748B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD]';

export function MissionManagementList({ missions, state, today, selectedId, disabled, onSelect, createAction, query, filter, onQuery, onFilter }: {
  missions: Mission[]; state: MissionState; today: string; selectedId?: string; disabled: boolean;
  onSelect: (id: string) => void; createAction: ReactNode; query: string; filter: MissionFilter;
  onQuery: (query: string) => void; onFilter: (filter: MissionFilter) => void;
}) {
  const [page, setPage] = useState(0);
  const results = missions.filter((mission) => matchesMissionFilter(mission, today, query, filter));
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  const currentPage = Math.min(page, pages - 1);

  return <section id="class-missions-list" tabIndex={-1} className="min-w-0 rounded-2xl border border-[#DCE3EA] bg-white p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD] sm:p-5" aria-label="미션 목록">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-extrabold">미션 목록 <span className="ml-1 text-sm font-semibold text-[#526174]">{missions.length}건</span></h2>
      {createAction}
    </div>
    {missions.length ? <>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(6.5rem,auto)] gap-2">
        <label className="min-w-0 text-sm font-bold">미션 검색
          <input name="mission-search" autoComplete="off" type="search" placeholder="제목 검색…" value={query} className={`${control} mt-1`}
            onChange={(event) => { onQuery(event.target.value); setPage(0); }} />
        </label>
        <label className="text-sm font-bold">미션 상태
          <select value={filter} className={`${control} mt-1`} onChange={(event) => { onFilter(event.target.value as MissionFilter); setPage(0); }}>
            {missionFilters.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2">
        <p role="status" className="py-2 text-sm text-[#526174]">{results.length}건{pages > 1 ? ` · ${currentPage + 1} / ${pages}쪽` : ''}</p>
        {pages > 1 ? <nav aria-label="검색 결과 페이지" className="flex gap-1">
          <button type="button" className={pagination} aria-disabled={currentPage === 0}
            onClick={() => { if (currentPage > 0) setPage(currentPage - 1); }}><ChevronLeft aria-hidden="true" className="h-4 w-4" />이전</button>
          <button type="button" className={pagination} aria-disabled={currentPage === pages - 1}
            onClick={() => { if (currentPage < pages - 1) setPage(currentPage + 1); }}>다음<ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
        </nav> : null}
      </div>
      {results.length ? <ul className="space-y-1.5">
        {results.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((mission) => {
          const selected = mission.id === selectedId;
          const status = missionDateLabel(mission, today);
          const counts = missionCounts(state, mission);
          const marked = counts.reported + counts.pending + counts.confirmed;
          const target = mission.targets.length - counts.exempt;
          return <li key={mission.id}>
            <button type="button" aria-current={selected ? 'true' : undefined} disabled={disabled}
              onClick={() => onSelect(mission.id)}
              className={`grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 rounded-lg border px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD] ${selected ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#E2E8F0] hover:border-[#93C5FD]'}`}>
              <strong className="line-clamp-2 break-words text-sm">{mission.title}</strong>
              <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${status === '진행 중' ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#F1F5F9] text-[#475569]'}`}>{status}</span>
              <span className="col-span-2 mt-0.5 text-xs tabular-nums text-[#526174]">{mission.dueDate} 마감 · 완료 표시 {marked}/{target}명{counts.pending ? ` · 확인 대기 ${counts.pending}명` : ''}</span>
            </button>
          </li>;
        })}
      </ul> : <p className="py-6 text-center text-sm text-[#526174]">조건에 맞는 미션이 없습니다.</p>}
    </> : <p className="py-6 text-center text-sm text-[#526174]">아직 미션이 없습니다. 첫 미션을 만들어 주세요.</p>}
  </section>;
}
