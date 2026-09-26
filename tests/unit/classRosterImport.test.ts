import { describe, expect, test } from 'vitest';
import { detectRosterColumns, parseRosterImportText, previewRosterImport, readRosterImportFile, rosterImportText } from '../../src/features/classroomRoles/classRosterImport';
import { decodeImportText, parseDelimitedImportText } from '../../src/utils/tabularImport';
import { parseRoleRoster } from '../../supabase/functions/_shared/classroomRoles';

describe('학급 명단 가져오기', () => {
  test('앞의 제목과 열 순서에 상관없이 출석번호와 이름만 추출한다', () => {
    const rows = [['우리 반 명단'], [], ['학번', '성 명', '학년', '반', '출석 번호', '비고'], ['30101', '가상하늘', 3, 1, 1, '메모'], ['30102', '가상바다', 3, 1, 2, '메모']];
    const mapping = detectRosterColumns(rows);
    expect(mapping).toEqual({ headerRow: 2, nameColumn: 1, numberColumn: 4 });
    expect(previewRosterImport(rows, mapping)).toMatchObject({ students: [{ number: 1, name: '가상하늘' }, { number: 2, name: '가상바다' }], error: '' });
  });

  test.each([
    ['번호\t이름\t비고\r\n1\t가상하늘\t메모\r\n2\t가상바다\t메모', '1 가상하늘\n2 가상바다'],
    ['1 가상하늘\n2 가상바다', '1 가상하늘\n2 가상바다'],
    ['번호 이름\n1 가상하늘', '1 가상하늘'],
    ['가상하늘\n가상바다', '1 가상하늘\n2 가상바다'],
    ['가상하늘\t1\n가상바다\t2', '1 가상하늘\n2 가상바다'],
    ['1 Jane Doe\n2 Kim Sky', '1 Jane Doe\n2 Kim Sky'],
  ])('붙여넣기와 TXT 명단을 분석한다: %s', async (input, expected) => {
    const rows = await parseRosterImportText(input);
    const preview = previewRosterImport(rows, detectRosterColumns(rows));
    expect(preview.error).toBe('');
    expect(rosterImportText(preview.students)).toBe(expected);
  });

  test('CSV의 BOM, 쉼표, 따옴표, 빈 행과 제목을 처리한다', async () => {
    const rows = await parseDelimitedImportText('\uFEFF가상 명단\r\n\r\n번호,이름,비고\r\n1,"Doe, Jane","메모 ""하나"""\r\n2,가상바다,');
    expect(rows[3]).toEqual(['1', 'Doe, Jane', '메모 "하나"']);
    expect(previewRosterImport(rows, detectRosterColumns(rows))).toMatchObject({ error: '', students: [{ number: 1, name: 'Doe, Jane' }, { number: 2, name: '가상바다' }] });
  });

  test('세미콜론 CSV, EUC-KR과 UTF-16 텍스트를 읽는다', async () => {
    expect(await parseDelimitedImportText('번호;이름\n1;가상하늘')).toEqual([['번호', '이름'], ['1', '가상하늘']]);
    expect(decodeImportText(Uint8Array.from([0xb1, 0xe8, 0xc7, 0xcf, 0xb4, 0xc3]).buffer)).toBe('김하늘');
    expect(decodeImportText(Uint8Array.from([0xff, 0xfe, 0x00, 0xac]).buffer)).toBe('가');
  });

  test.each([
    [[[1, '가상하늘'], ['01', '가상바다']], '중복'],
    [[[0, '가상하늘']], '1~999'],
    [[[30101, '가상하늘']], '출석번호'],
    [[[1.5, '가상하늘']], '정수'],
    [[['', '가상하늘']], '번호'],
    [[[1, '']], '이름'],
    [[[1, '가상\n하늘']], '줄바꿈'],
    [[['1', '가'.repeat(41)]], '1~40'],
    [Array.from({ length: 61 }, (_, i) => [i + 1, '가상학생']), '60명'],
  ])('잘못된 명단은 적용을 막는다', (data, error) => {
    const rows = [['번호', '이름'], ...data];
    expect(previewRosterImport(rows, detectRosterColumns(rows)).error).toContain(error);
  });

  test('동명이인을 유지하고 반복 머리글과 빈 행만 제외한다', () => {
    const rows = [['번호', '이름'], [1, '가상하늘'], [], ['번호', '이름'], [2, '가상하늘']];
    const preview = previewRosterImport(rows, detectRosterColumns(rows));
    expect(preview.students).toHaveLength(2);
    expect(preview.warnings.join()).toContain('반복된 열 제목 1행');
    const previous = parseRoleRoster('1 가상하늘\n2 가상하늘');
    expect(parseRoleRoster(rosterImportText(preview.students), previous)).toEqual(previous);
  });

  test('알 수 없는 열은 직접 선택하고 번호 자동 부여를 안내한다', () => {
    const rows = [['구분', '학생', '기타'], ['A', '가상하늘', '메모']];
    expect(detectRosterColumns(rows).nameColumn).toBe(-1);
    const preview = previewRosterImport(rows, { headerRow: 0, nameColumn: 1, numberColumn: -1 });
    expect(preview.error).toBe('');
    expect(preview.students).toEqual([{ number: 1, name: '가상하늘' }]);
    expect(preview.warnings.join()).toContain('1번부터');
  });

  test('파일 확장자와 크기 및 빈 입력을 확인한다', async () => {
    await expect(readRosterImportFile(new File([], 'empty.txt'))).rejects.toThrow('내용이 없는');
    await expect(readRosterImportFile(new File(['data'], 'old.xls'))).rejects.toThrow('.xlsx로');
    await expect(readRosterImportFile({ name: 'large.txt', size: 20 * 1024 * 1024 + 1 } as File)).rejects.toThrow('20MB');
    await expect(parseRosterImportText('  ')).rejects.toThrow('붙여넣어');
    const sheets = await readRosterImportFile(new File(['1 가상하늘'], '명단.txt'));
    expect(sheets[0].data).toEqual([['1', '가상하늘']]);
  });
});
