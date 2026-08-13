import { describe, expect, test } from 'vitest';
import {
  chunkPdfRows,
  fitPdfFontSize,
  getPdfColumnWidths,
  getPdfPageSettings,
  paginatePdfRows,
} from '../../supabase/functions/registry-pdf/layout';

describe('등록부 서버 PDF 레이아웃', () => {
  test('인쇄 옵션에 따라 표 단수와 행 수를 고정한다', () => {
    expect(getPdfPageSettings(10)).toEqual({ tableColumns: 1, rowsPerColumn: 10 });
    expect(getPdfPageSettings(15)).toEqual({ tableColumns: 1, rowsPerColumn: 15 });
    expect(getPdfPageSettings(20)).toEqual({ tableColumns: 2, rowsPerColumn: 10 });
    expect(getPdfPageSettings(30)).toEqual({ tableColumns: 2, rowsPerColumn: 15 });
  });

  test('참석자를 페이지 단위로 나누고 빈 등록부도 한 페이지를 만든다', () => {
    expect(paginatePdfRows([], 20)).toEqual([[]]);
    expect(paginatePdfRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('서명 다운로드 항목을 제한된 크기의 배치로 나눈다', () => {
    expect(chunkPdfRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkPdfRows([], 8)).toEqual([]);
    expect(() => chunkPdfRows([1], 0)).toThrow(RangeError);
  });

  test('고정 열과 입력 열의 합이 정확히 표 너비가 된다', () => {
    for (const compact of [false, true]) {
      for (const fieldCount of [0, 1, 4]) {
        const width = compact ? 251 : 514;
        const columns = getPdfColumnWidths(width, compact, fieldCount);
        expect(columns.fields).toHaveLength(fieldCount);
        expect(columns.number + columns.name + columns.signature + columns.fields.reduce((sum, value) => sum + value, 0)).toBeCloseTo(width, 6);
      }
    }
  });

  test('긴 문자열은 최소 크기까지 줄이고 짧은 문자열은 선호 크기를 유지한다', () => {
    expect(fitPdfFontSize(4, 100, 12, 6)).toBe(12);
    expect(fitPdfFontSize(20, 100, 12, 6)).toBe(6);
    expect(fitPdfFontSize(40, 100, 12, 6)).toBe(6);
  });
});
