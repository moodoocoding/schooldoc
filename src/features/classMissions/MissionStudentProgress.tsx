import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MissionState } from './missionApi';
import type { MissionStatisticsRange } from './missionStatistics';
import { summarizeMissionStudentProgress } from './studentMissionProgress';
import { statusLabel, statusTone } from './missionStatusPresentation';

const studentsPerPage = 20;
const pageButton = 'inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-bold text-[#0B5B9F] hover:bg-[#EFF6FC] aria-disabled:text-[#64748B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD]';

export function MissionStudentProgress({ state, range, maskNames, onMaskNamesChange }: {
  state: MissionState; range: MissionStatisticsRange; maskNames: boolean; onMaskNamesChange: (masked: boolean) => void;
}) {
  const { asOf, missionCount, students } = useMemo(() => summarizeMissionStudentProgress(state, range), [state, range]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => { if (maskNames) { setQuery(''); setPage(0); } }, [maskNames]);
  const search = query.trim().toLocaleLowerCase('ko');
  const visibleStudents = students.filter(({ student }) => {
    if (/^\d+\s*번?$/.test(search)) return student.number === Number.parseInt(search, 10);
    return !search || (!maskNames && student.name.toLocaleLowerCase('ko').includes(search));
  });
  const pages = Math.max(1, Math.ceil(visibleStudents.length / studentsPerPage));
  const currentPage = Math.min(page, pages - 1);

  return <section aria-labelledby="mission-student-progress-heading" className="border-t border-[#DCE3EA]">
    <div className="p-3 sm:p-4 sm:px-6">
      <h3 id="mission-student-progress-heading" className="font-extrabold">학생별 완료 현황</h3>
      {missionCount ? <div className="mt-1 text-sm leading-5 text-[#526174]">
        <p aria-live="polite" className="tabular-nums">{range.start} ~ {range.end} · {missionCount}개 미션 · {asOf === range.end ? '종료일' : '오늘'} 기준</p>
        <p className="break-keep">확인 대기는 학생이 완료를 표시한 상태입니다. 교사 확인이 필요한 미션은 확인 후 완료로 셉니다.</p>
      </div> : null}
      {students.length ? <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-5">
        <label className="min-w-0 flex-1 text-sm font-bold sm:flex-none"><span className="sr-only">학생 검색</span>
          <input name="student-search" autoComplete="off" type="search" placeholder={maskNames ? '학생 번호…' : '학생 이름 또는 번호…'} value={query}
            onChange={(event) => { setQuery(event.target.value); setSelectedStudent(''); setPage(0); }}
            className="mt-1 block min-h-11 w-full max-w-64 rounded-xl border border-[#CBD5E1] px-3 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD]" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#334155]">
          <input type="checkbox" checked={maskNames} className="h-4 w-4 accent-[#0F6CBD]" onChange={(event) => {
            onMaskNamesChange(event.target.checked);
            setQuery('');
            setPage(0);
          }} />이름 가림
        </label>
      </div> : null}
      {pages > 1 ? <nav aria-label="학생별 현황 페이지" className="mt-1 flex flex-wrap items-center justify-end gap-2 sm:mt-2">
        <span role="status" className="mr-auto text-sm tabular-nums text-[#526174]">{visibleStudents.length}명 · {currentPage + 1} / {pages}쪽</span>
        <button type="button" className={pageButton} aria-disabled={currentPage === 0} onClick={() => {
          if (currentPage > 0) { setPage(currentPage - 1); setSelectedStudent(''); }
        }}><ChevronLeft aria-hidden="true" className="h-4 w-4" />이전</button>
        <button type="button" className={pageButton} aria-disabled={currentPage === pages - 1} onClick={() => {
          if (currentPage < pages - 1) { setPage(currentPage + 1); setSelectedStudent(''); }
        }}>다음<ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
      </nav> : null}
    </div>
    {visibleStudents.length ? <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">학생별 미션 완료와 미완료 건수</caption>
      <thead className="border-y border-[#DCE3EA] bg-[#F1F5F9] text-[#334155]">
        <tr>
          <th scope="col" className="w-[42%] px-3 py-2.5 text-left sm:w-[36%] sm:px-6">학생</th>
          <th scope="col" className="break-keep px-1 py-2.5 leading-tight">완료 인정 / 대상</th>
          <th scope="col" className="break-keep px-1 py-2.5">확인 대기</th>
          <th scope="col" className="break-keep px-1 py-2.5">표시 전</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#E2E8F0]">
        {visibleStudents.slice(currentPage * studentsPerPage, (currentPage + 1) * studentsPerPage).map(({ student, missions, counts }) => {
          const expanded = selectedStudent === student.id;
          const label = maskNames ? `${student.number}번` : `${student.number}번 ${student.name}`;
          const completed = counts.reported + counts.confirmed;
          const target = missions.length - counts.exempt;
          return <Fragment key={student.id}>
            <tr className={expanded ? 'bg-[#EFF6FC]' : undefined}>
              <th scope="row" className="px-3 py-0.5 text-left sm:px-6">
                {missions.length ? <button type="button" aria-expanded={expanded} onClick={() => setSelectedStudent(expanded ? '' : student.id)}
                  className="inline-flex min-h-11 max-w-full items-center gap-1 rounded py-1 text-left font-bold text-[#0B5B9F] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD]">
                  <span className="min-w-0 break-words">{label}</span><ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 ${expanded ? 'rotate-180' : ''}`} />
                </button> : <span className="inline-flex min-h-11 items-center break-words">{label}</span>}
              </th>
              {missions.length ? <>
                <td className={`px-1 text-center font-bold tabular-nums ${completed > 0 && completed === target ? 'text-[#126B32]' : 'text-[#334155]'}`}>{completed} / {target}</td>
                <td className={`px-1 text-center tabular-nums ${counts.pending ? 'font-semibold text-[#8A5100]' : 'text-[#475569]'}`}>{counts.pending}</td>
                <td className="px-1 text-center tabular-nums text-[#475569]">{counts.unmarked}</td>
              </> : <td colSpan={3} className="px-1 text-center text-[#526174]">배정된 미션 없음</td>}
            </tr>
            {expanded ? <tr><td colSpan={4} className="bg-[#F8FAFC] px-3 py-3 sm:px-6">
              <ul aria-label={`${label} 미션별 상태`} className="divide-y divide-[#E2E8F0] rounded-xl border border-[#DCE3EA] bg-white">
                {missions.map((mission) => <li key={mission.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                  <p className="min-w-0 basis-48 flex-1 break-words font-semibold">{mission.title}<span className="mt-0.5 block text-xs font-normal text-[#526174]">{mission.dueDate} 마감</span></p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone[mission.status]}`}>{statusLabel[mission.status]}</span>
                </li>)}
              </ul>
            </td></tr> : null}
          </Fragment>;
        })}
      </tbody>
    </table> : <p role="status" className="border-t border-[#DCE3EA] px-4 py-8 text-center text-sm text-[#526174]">
      {students.length ? '검색과 일치하는 학생이 없습니다.' : '선택 기간에 조회할 미션이 없습니다.'}
    </p>}
  </section>;
}
