import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MissionState } from './missionApi';
import {
  emptyMissionActivity, missionStatisticsPage, missionStatisticsRangeError, recentMissionStatisticsRange,
  summarizeMissionStatistics, type MissionActivityCounts,
} from './missionStatistics';

const metrics = [
  ['reported', '완료 표시', 'text-[#0B5B9F]'],
  ['confirmed', '교사 확인', 'text-[#126B32]'],
  ['cancelled', '완료 취소', 'text-[#8A5100]'],
  ['corrected', '교사 정정', 'text-[#475569]'],
] as const satisfies ReadonlyArray<readonly [keyof MissionActivityCounts, string, string]>;

const dateInput = 'mt-1.5 block min-h-11 w-full min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-2 py-2 text-sm font-normal text-[#0F172A] focus:border-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#BFDBFE] sm:px-3';
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD]';
const pageButton = `inline-flex min-h-11 items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-sm font-semibold text-[#334155] hover:border-[#0F6CBD] ${focus}`;
const zeroCounts = emptyMissionActivity();

export function MissionStatisticsPanel({ state }: { state: MissionState }) {
  const [range, setRange] = useState(recentMissionStatisticsRange);
  const [input, setInput] = useState(range);
  const [error, setError] = useState<ReturnType<typeof missionStatisticsRangeError>>(null);
  const [page, setPage] = useState(0);
  const [expandedDate, setExpandedDate] = useState('');
  const { totals, byDate } = useMemo(() => summarizeMissionStatistics(state, range), [state, range]);
  const { dates, pageCount } = missionStatisticsPage(range, page);

  return <section className="rounded-2xl border border-[#DCE3EA] bg-white" aria-labelledby="mission-statistics-heading">
    <div className="p-4 sm:p-6">
      <h2 id="mission-statistics-heading" className="text-lg font-extrabold">일별 미션 활동</h2>
      <p className="mt-1.5 text-sm leading-6 text-[#526174]">활동이 있었던 날짜에 집계합니다(한국 시간). 같은 학생이 여러 번 상태를 바꾸면 각각 셉니다.</p>
      <form className="mt-4" noValidate onSubmit={(event) => {
        event.preventDefault();
        const issue = missionStatisticsRangeError(input);
        setError(issue);
        if (issue) {
          (event.currentTarget.elements.namedItem(issue.field) as HTMLInputElement).focus();
          return;
        }
        setRange(input);
        setPage(0);
        setExpandedDate('');
      }}>
        <div className="grid max-w-xl grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_auto] sm:gap-3">
          <label className="min-w-0 text-sm font-bold">시작일
            <input name="start" type="date" className={dateInput} value={input.start} aria-invalid={error?.field === 'start'}
              aria-describedby={error?.field === 'start' ? 'mission-statistics-error' : undefined}
              onChange={(event) => { setInput({ ...input, start: event.target.value }); setError(null); }} />
          </label>
          <label className="min-w-0 text-sm font-bold">종료일
            <input name="end" type="date" className={dateInput} value={input.end} aria-invalid={error?.field === 'end'}
              aria-describedby={error?.field === 'end' ? 'mission-statistics-error' : undefined}
              onChange={(event) => { setInput({ ...input, end: event.target.value }); setError(null); }} />
          </label>
          <button type="submit" className={`col-span-2 min-h-11 rounded-xl bg-[#0F6CBD] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B5B9F] sm:col-span-1 ${focus}`}>조회</button>
        </div>
        {error ? <p id="mission-statistics-error" role="alert" className="mt-2 text-sm font-semibold text-[#B42318]">{error.message}</p> : null}
      </form>

      <h3 className="mt-6 text-sm font-bold" aria-live="polite">기간 합계 <span className="ml-1 inline-block font-normal tabular-nums text-[#526174]">{range.start} ~ {range.end}</span></h3>
      <dl className="mt-2 grid grid-cols-4 divide-x divide-[#DCE3EA] rounded-xl border border-[#DCE3EA] bg-[#F8FAFC]">
        {metrics.map(([metric, label, tone]) => <div key={metric} className="min-w-0 px-1 py-2.5 text-center sm:px-4 sm:text-left">
          <dt className="break-keep text-sm text-[#475569]">{label}</dt>
          <dd className={`mt-0.5 break-words text-xl font-extrabold tabular-nums sm:text-2xl ${tone}`}>{totals[metric].toLocaleString('ko-KR')}<span className="ml-1 text-xs font-medium">건</span></dd>
        </div>)}
      </dl>
    </div>

    {byDate.size ? <>
      {pageCount > 1 ? <nav aria-label="일별 통계 페이지" className="flex flex-wrap items-center justify-center gap-3 border-t border-[#DCE3EA] px-3 py-2 sm:justify-end sm:px-6">
        <button type="button" className={`${pageButton} aria-disabled:opacity-60`} aria-disabled={page === 0} onClick={() => { if (page > 0) { setPage(page - 1); setExpandedDate(''); } }}><ChevronLeft aria-hidden="true" className="h-4 w-4" />최근 날짜</button>
        <span role="status" className="text-sm tabular-nums text-[#526174]">{page + 1} / {pageCount}</span>
        <button type="button" className={`${pageButton} aria-disabled:opacity-60`} aria-disabled={page === pageCount - 1} onClick={() => { if (page < pageCount - 1) { setPage(page + 1); setExpandedDate(''); } }}>이전 날짜<ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
      </nav> : null}
      <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">날짜별 미션 활동 건수</caption>
        <thead className="border-y border-[#DCE3EA] bg-[#F1F5F9] text-[#334155]">
          <tr>
            <th scope="col" className="w-[34%] px-2 py-2.5 text-left sm:w-[28%] sm:px-6">날짜</th>
            {metrics.map(([metric, label]) => <th key={metric} scope="col" className="break-keep px-1 py-2.5 text-center">
              <span className="mx-auto block max-w-8 leading-tight sm:max-w-none">{label}</span>
            </th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">
          {dates.map((date) => {
            const activity = byDate.get(date);
            const expanded = expandedDate === date;
            return <Fragment key={date}>
              <tr className={expanded ? 'bg-[#EFF6FC]' : undefined}>
                <th scope="row" className="px-2 py-1 text-left tabular-nums sm:px-6">
                  {activity ? <button type="button" aria-expanded={expanded}
                    onClick={() => setExpandedDate(expanded ? '' : date)}
                    className={`inline-flex min-h-11 items-center gap-0.5 rounded text-xs font-bold text-[#0B5B9F] underline underline-offset-4 sm:gap-1.5 sm:text-sm ${focus}`}>
                    <time dateTime={date}>{date}</time>
                    <ChevronDown aria-hidden="true" className={`h-3 w-3 shrink-0 sm:h-4 sm:w-4 ${expanded ? 'rotate-180' : ''}`} />
                    <span className="sr-only"> 미션별 활동</span>
                  </button> : <time dateTime={date} className="inline-flex min-h-11 items-center text-xs font-medium text-[#526174] sm:text-sm">{date}</time>}
                </th>
                {metrics.map(([metric]) => <td key={metric} className="break-words px-0.5 text-center tabular-nums text-[#334155]">{(activity?.counts ?? zeroCounts)[metric].toLocaleString('ko-KR')}</td>)}
              </tr>
              {expanded && activity ? <tr><td colSpan={5} className="bg-[#F8FAFC] px-3 py-3 sm:px-6">
                <ul aria-label={`${date} 미션별 활동`} className="divide-y divide-[#E2E8F0] rounded-xl border border-[#DCE3EA] bg-white">
                  {[...activity.missions].map(([id, mission]) => <li key={id} className="px-3 py-2.5 sm:px-4">
                    <p className="break-words font-bold text-[#0F172A]">{mission.title}</p>
                    <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#475569]">
                      {metrics.filter(([metric]) => mission.counts[metric] > 0).map(([metric, label]) => <li key={metric}>{label} <strong className="tabular-nums">{mission.counts[metric].toLocaleString('ko-KR')}건</strong></li>)}
                    </ul>
                  </li>)}
                </ul>
              </td></tr> : null}
            </Fragment>;
          })}
        </tbody>
      </table>
    </> : <p role="status" className="border-t border-[#DCE3EA] px-4 py-10 text-center text-sm text-[#526174]">이 기간에 기록된 미션 활동이 없습니다.</p>}
  </section>;
}
