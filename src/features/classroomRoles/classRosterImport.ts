import { parseRoleRoster } from '../../../supabase/functions/_shared/classroomRoles';
import {
  decodeImportText, normalizeImportHeader, parseDelimitedImportText, readExcelImportFile,
  type ImportRows, type ImportSheet,
} from '../../utils/tabularImport';

const NAME_HEADERS = new Set(['이름', '성명', '학생명', '학생이름', '학생성명', 'name', 'studentname']);
const NUMBER_HEADERS = ['출석번호', '번호', '학생번호', '연번', '순번', 'number', 'no', '학번', 'studentid', 'id'];
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const cellText = (value: unknown) => String(value ?? '').trim();
const isNumber = (value: string) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 999;

export interface RosterColumnMapping {
  headerRow: number; // -1: 머리글 없음
  nameColumn: number;
  numberColumn: number; // -1: 순서대로 번호 부여
}

export interface RosterImportPreview {
  students: { number: number; name: string }[];
  warnings: string[];
  error: string;
}

export const detectRosterColumns = (rows: ImportRows): RosterColumnMapping => {
  for (const [headerRow, row] of rows.slice(0, 80).entries()) {
    const headers = row.map(normalizeImportHeader);
    const nameColumn = headers.findIndex((header) => NAME_HEADERS.has(header));
    if (nameColumn < 0) continue;
    const numberHeader = NUMBER_HEADERS.find((header) => headers.includes(header));
    return { headerRow, nameColumn, numberColumn: numberHeader ? headers.indexOf(numberHeader) : -1 };
  }
  const first = rows.find((row) => row.some((cell) => cellText(cell)));
  if (!first) return { headerRow: -1, nameColumn: -1, numberColumn: -1 };
  // 머리글 없는 단순 명단만 추정한다. 여러 열이 있으면 교사가 직접 고른다.
  if (first.length === 1) return { headerRow: -1, nameColumn: 0, numberColumn: -1 };
  if (first.length === 2) {
    const numberColumn = first.findIndex((value) => isNumber(cellText(value)));
    if (numberColumn >= 0) return { headerRow: -1, nameColumn: 1 - numberColumn, numberColumn };
  }
  return { headerRow: -1, nameColumn: -1, numberColumn: -1 };
};

export const previewRosterImport = (rows: ImportRows, mapping: RosterColumnMapping): RosterImportPreview => {
  const students: RosterImportPreview['students'] = [];
  const warnings: string[] = [];
  const fail = (error: string) => ({ students, warnings, error });
  if (mapping.nameColumn < 0) return fail('이름 열을 선택해 주세요.');
  if (mapping.nameColumn === mapping.numberColumn) return fail('번호와 이름은 서로 다른 열을 선택해 주세요.');
  if (mapping.headerRow < 0) warnings.push('열 제목 없이 읽었습니다. 첫 학생과 선택한 열을 확인해 주세요.');
  if (mapping.numberColumn < 0) warnings.push('번호 열이 없어 파일 순서대로 1번부터 번호를 부여합니다.');
  let skippedHeaders = 0;
  const numbers = new Set<number>();
  for (let index = mapping.headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.some((cell) => cellText(cell))) continue;
    const name = cellText(row[mapping.nameColumn]);
    const rawNumber = mapping.numberColumn < 0 ? String(students.length + 1) : cellText(row[mapping.numberColumn]);
    if (NAME_HEADERS.has(normalizeImportHeader(name)) && (mapping.numberColumn < 0 || NUMBER_HEADERS.includes(normalizeImportHeader(rawNumber)))) {
      skippedHeaders += 1;
      continue;
    }
    if (!name || name.length > 40 || Array.from(name).some((char) => char.charCodeAt(0) < 32)) return fail(`${index + 1}행의 이름을 확인해 주세요. 이름은 줄바꿈 없이 1~40자로 입력해야 합니다.`);
    if (!isNumber(rawNumber)) return fail(`${index + 1}행의 번호를 확인해 주세요. 번호는 1~999 사이의 정수여야 합니다. 학번 대신 출석번호 열을 선택할 수 있습니다.`);
    const number = Number(rawNumber);
    if (numbers.has(number)) return fail(`${index + 1}행의 ${number}번이 중복되었습니다. 한 학급의 명단인지 확인해 주세요.`);
    numbers.add(number);
    students.push({ number, name });
    if (students.length > 60) return fail('학생은 최대 60명까지 등록할 수 있습니다. 한 학급의 명단을 선택해 주세요.');
  }
  if (!students.length) return fail('불러올 학생이 없습니다. 시트와 열 제목 행을 확인해 주세요.');
  if (skippedHeaders) warnings.push(`반복된 열 제목 ${skippedHeaders}행을 제외했습니다.`);
  // 저장 시 사용하는 공통 검증과 같은 규칙으로 최종 확인한다.
  try {
    parseRoleRoster(rosterImportText(students));
  } catch (error) {
    return fail((error as Error).message);
  }
  return { students, warnings, error: '' };
};

export const rosterImportText = (students: RosterImportPreview['students']) =>
  students.map(({ number, name }) => `${number} ${name}`).join('\n');

export const parseRosterImportText = async (input: string): Promise<ImportRows> => {
  if (!input.trim()) throw new Error('명단을 붙여넣어 주세요.');
  if (input.length > MAX_FILE_SIZE) throw new Error('명단은 20MB 이하로 나누어 주세요.');
  const rows = await parseDelimitedImportText(input);
  if (rows.some((row) => row.length > 1)) return rows;
  return rows.map((row) => {
    const value = cellText(row[0]);
    const match = value.match(/^(\d+)[.)]?\s+(.+)$/)
      ?? value.match(/^(출석번호|번호|학생번호|학번)\s+(이름|성명|학생명)$/);
    return match ? [match[1], match[2]] : row;
  });
};

export const readRosterImportFile = async (file: File): Promise<ImportSheet[]> => {
  if (!file.size) throw new Error('내용이 없는 파일은 불러올 수 없습니다.');
  if (file.size > MAX_FILE_SIZE) throw new Error('명단 파일은 20MB 이하만 불러올 수 있습니다.');
  if (/\.xlsx$/i.test(file.name)) return readExcelImportFile(file);
  if (/\.(csv|tsv|txt)$/i.test(file.name)) {
    const text = decodeImportText(await file.arrayBuffer());
    const data = /\.txt$/i.test(file.name) ? await parseRosterImportText(text)
      : await parseDelimitedImportText(text, /\.tsv$/i.test(file.name) ? '\t' : undefined);
    return [{ sheet: file.name, data }];
  }
  throw new Error('XLSX, CSV, TSV, TXT 파일을 선택해 주세요. 이전 Excel(.xls)은 .xlsx로 저장해 주세요.');
};

export const rosterImportAccept = '.xlsx,.csv,.tsv,.txt';
