import {
  readDelimitedImportFile,
  readExcelImportFile,
  normalizeImportHeader,
} from '../../utils/tabularImport';
import type { ImportSheet, ImportRows } from '../../utils/tabularImport';
import {
  NEIS_MAX_FILE_BYTES,
  NEIS_MAX_STUDENTS,
  NEIS_MAX_TASKS,
} from '../../../supabase/functions/_shared/neisHelper';
import type { GradeBook } from '../../../supabase/functions/_shared/neisHelper';
import { downloadBlob } from '../../utils/qrImage';
import { countComment } from '../../../supabase/functions/_shared/neisHelper';
import writeXlsx from 'write-excel-file/browser';
export const PLAN_ACCEPT = '.pdf,.hwp,.hwpx';
export const GRADE_ACCEPT = `.xlsx,.csv,${PLAN_ACCEPT}`;
export const isHangulFile = (file: File) => /\.hwpx?$/i.test(file.name);
export const isPdfOrHangul = (file: File) => /\.(pdf|hwp|hwpx)$/i.test(file.name);
export function checkFile(file: File, kind: 'plan' | 'grades' | 'worksheet') {
  if (!file.size || file.size > NEIS_MAX_FILE_BYTES)
    throw new Error('빈 파일은 읽을 수 없습니다. 10MB 이하 파일을 선택해 주세요.');
  if (!isPdfOrHangul(file) && !(kind === 'grades' && /\.(xlsx|csv)$/i.test(file.name)))
    throw new Error(
      kind === 'plan'
        ? '평가계획은 PDF·HWP·HWPX 파일을 올려 주세요.'
        : kind === 'worksheet'
          ? '평가지는 PDF·HWP·HWPX 파일을 올려 주세요.'
          : '성적은 XLSX·CSV·PDF·HWP·HWPX로 올려 주세요. XLS는 XLSX로 다시 저장해 주세요.',
    );
}
export async function readGradeSheets(file: File): Promise<ImportSheet[]> {
  checkFile(file, 'grades');
  return /\.csv$/i.test(file.name)
    ? [{ sheet: '성적표', data: await readDelimitedImportFile(file) }]
    : readExcelImportFile(file);
}
const numberHeaders = new Set(['번호', '출석번호', '학생번호']);
const nameHeaders = new Set(['성명', '이름', '학생명', '학생이름']);
export function findHeaderRows(rows: ImportRows): number[] {
  return rows.flatMap((row, i) => {
    const cells = row.map(normalizeImportHeader);
    return cells.some((s) => numberHeaders.has(s)) && cells.some((s) => nameHeaders.has(s)) ? [i] : [];
  });
}
export function parseGradeSheet(sheet: ImportSheet, headerIndex: number): GradeBook {
  if (!Number.isInteger(headerIndex) || headerIndex < 0 || headerIndex >= sheet.data.length)
    throw new Error('번호와 이름이 적힌 제목 행을 선택해 주세요.');
  const header = sheet.data[headerIndex];
  const normalized = header.map(normalizeImportHeader);
  const numberColumns = normalized.flatMap((v, i) => (numberHeaders.has(v) ? [i] : []));
  const nameColumns = normalized.flatMap((v, i) => (nameHeaders.has(v) ? [i] : []));
  if (numberColumns.length !== 1 || nameColumns.length !== 1)
    throw new Error('선택한 행에 번호와 이름 열이 각각 하나씩 있어야 합니다. 제목 행을 확인해 주세요.');
  const numberColumn = numberColumns[0],
    nameColumn = nameColumns[0];
  const sourceRows = sheet.data.slice(headerIndex + 1);
  const width = Math.max(header.length, ...sourceRows.map((r) => r.length));
  const excluded = new Set(['학년', '반', '성별', '학적', '비고']);
  const gradeIndices = Array.from({ length: width }, (_, i) => i).filter(
    (i) =>
      i !== numberColumn &&
      i !== nameColumn &&
      !excluded.has(normalized[i]) &&
      (String(header[i] ?? '').trim() || sourceRows.some((r) => String(r[i] ?? '').trim())),
  );
  if (!gradeIndices.length || gradeIndices.length > NEIS_MAX_TASKS)
    throw new Error(
      `평가 열을 찾지 못했거나 ${NEIS_MAX_TASKS}개를 넘었습니다. 한 학급·한 학기의 표인지 확인해 주세요.`,
    );
  const columns = gradeIndices.map((i, index) => ({
    id: `column-${index + 1}`,
    label: String(header[i] ?? '').trim() || `${i + 1}열 (제목 없음)`,
  }));
  const students = sourceRows.flatMap((row, index) => {
    if (row.every((c) => !String(c ?? '').trim())) return [];
    // 번호/이름이 없는 비어 있지 않은 행도 남긴다. 교사가 원본과 대조해 삭제할 수 있다.
    return [
      {
        id: `student-row-${headerIndex + index + 2}`,
        number: String(row[numberColumn] ?? '').trim(),
        name: String(row[nameColumn] ?? '').trim(),
        grades: gradeIndices.map((i) => String(row[i] ?? '').trim()),
        sourceRow: headerIndex + index + 2,
      },
    ];
  });
  if (!students.length || students.length > NEIS_MAX_STUDENTS)
    throw new Error(
      `한 학급 ${NEIS_MAX_STUDENTS}명 이하의 성적표를 사용해 주세요. 반복 제목·합계가 없는 표로 저장하면 정확히 읽을 수 있습니다.`,
    );
  return {
    context: [sheet.sheet, ...sheet.data.slice(0, headerIndex).map((row) => row.filter(Boolean).join(' '))]
      .join(' · ')
      .slice(0, 500),
    columns,
    students,
  };
}
export interface ExportCommentRow {
  number: string;
  name: string;
  grades: string;
  text: string;
  evidence: string;
}
export async function exportComments(subject: string, rows: ExportCommentRow[], signal?: AbortSignal) {
  const cell = (value: string) => ({ type: String, value, format: '@', wrap: true });
  const sheet = [
    ['번호', '이름', '성적', '평어', '글자 수(공백 포함)', '바이트(나이스 기준)', '평가 근거'].map(cell),
    ...rows.map((row) => {
      const counts = countComment(row.text);
      return [
        row.number,
        row.name,
        row.grades,
        row.text,
        String(counts.characters),
        String(counts.bytes),
        row.evidence,
      ].map(cell);
    }),
  ];
  const blob = await writeXlsx(
    sheet,
    {
      sheet: '교과평어',
      columns: [8, 14, 36, 90, 16, 18, 90].map((width) => ({ width })),
      stickyRowsCount: 1,
    },
    { fontFamily: '맑은 고딕', fontSize: 11 },
  ).toBlob();
  if (signal?.aborted) throw new DOMException('저장을 취소했습니다.', 'AbortError');
  downloadBlob(blob, `${subject.replace(/[\\/:*?"<>|]/g, '_')}_교과평어.xlsx`);
}
