import { describe, expect, it } from 'vitest';
import {
  getRegistryPageSettings,
  isValidSignatureDataUrl,
  maskName,
  maskValue,
  paginateRegistryParticipants,
  parsePastedRows,
} from '../../src/features/registry/registryUtils';
import type { RegistryColumn, RegistryParticipant } from '../../src/features/registry/types';

const columns: RegistryColumn[] = [
  { id: 'affiliation', label: '소속' },
  { id: 'role', label: '직위' },
];

const makeParticipant = (rowNumber: number): RegistryParticipant => ({
  id: `participant-${rowNumber}`,
  rowNumber,
  name: `참석자 ${rowNumber}`,
  values: { affiliation: `학교 ${rowNumber}` },
});

describe('parsePastedRows', () => {
  it('소속 열 뒤의 마지막 셀을 성명으로 읽고 공백 행은 제거한다', () => {
    const rows = parsePastedRows(
      ' 새봄초등학교\t교사\t김하늘 \n\n 한빛중학교\t교감\t이도윤 ',
      columns,
    );

    expect(rows).toEqual([
      { name: '김하늘', values: { affiliation: '새봄초등학교', role: '교사' } },
      { name: '이도윤', values: { affiliation: '한빛중학교', role: '교감' } },
    ]);
  });

  it('추가 열이 없으면 첫 셀을 성명으로 읽는다', () => {
    expect(parsePastedRows('김하늘\n이도윤', [])).toEqual([
      { name: '김하늘', values: {} },
      { name: '이도윤', values: {} },
    ]);
  });
});

describe('공개 명단 마스킹', () => {
  it('성명 가운데 글자와 추가 정보 뒷부분을 숨긴다', () => {
    expect(maskName('김하늘')).toBe('김*늘');
    expect(maskName('이도윤수')).toBe('이**수');
    expect(maskValue('새봄초등학교')).toBe('새봄****');
  });
});

describe('등록부 인쇄 페이지 분할', () => {
  it.each([
    [10, { columns: 1, rowsPerColumn: 10 }],
    [15, { columns: 1, rowsPerColumn: 15 }],
    [20, { columns: 2, rowsPerColumn: 10 }],
    [30, { columns: 2, rowsPerColumn: 15 }],
  ] as const)('%i명 레이아웃 설정을 반환한다', (layout, expected) => {
    expect(getRegistryPageSettings(layout)).toEqual(expected);
  });

  it('21명을 20명 단위의 두 페이지로 나누고 원본은 변경하지 않는다', () => {
    const participants = Array.from({ length: 21 }, (_, index) => makeParticipant(index + 1));
    const pages = paginateRegistryParticipants(participants, 20);

    expect(pages.map((page) => page.length)).toEqual([20, 1]);
    expect(pages[1][0].rowNumber).toBe(21);
    expect(participants).toHaveLength(21);
  });

  it('빈 명단도 한 장의 빈 인쇄 페이지를 만든다', () => {
    expect(paginateRegistryParticipants([], 10)).toEqual([[]]);
  });

  it('잘못된 페이지 크기를 거부한다', () => {
    expect(() => paginateRegistryParticipants([], 0)).toThrow(RangeError);
  });
});

describe('서명 이미지 검증', () => {
  it('지원하는 래스터 이미지 data URL만 허용한다', () => {
    expect(isValidSignatureDataUrl('data:image/png;base64,aGVsbG8=')).toBe(true);
    expect(isValidSignatureDataUrl('data:image/jpeg;base64,aGVsbG8=')).toBe(true);
    expect(isValidSignatureDataUrl('data:image/svg+xml;base64,aGVsbG8=')).toBe(false);
    expect(isValidSignatureDataUrl('data:text/plain;base64,aGVsbG8=')).toBe(false);
    expect(isValidSignatureDataUrl('not-a-data-url')).toBe(false);
  });
});
