import { describe, expect, it } from 'vitest';
import { analyzeDataCollectionRows, hashCollectionPassword, isCollectionOpen, maskTargetLabel, parseDataCollectionPastedRows, parseDataCollectionRows, validateCollectionFile } from '../../src/features/dataCollect/dataCollectUtils';

describe('자료 수합 공통 규칙', () => {
  it('공개 검색 결과의 이름을 서버 응답처럼 가린다', () => {
    expect(maskTargetLabel('국어')).toBe('국○');
    expect(maskTargetLabel('1학년 3반')).toBe('1○○반');
  });

  it('종료 상태와 지난 기한을 모두 제출 불가로 본다', () => {
    const now = new Date('2026-08-21T12:00:00+09:00');
    expect(isCollectionOpen('open', '', now)).toBe(true);
    expect(isCollectionOpen('closed', '', now)).toBe(false);
    expect(isCollectionOpen('open', '2026-08-21T11:59:00+09:00', now)).toBe(false);
  });

  it('같은 비밀번호는 같은 해시가 되고 원문은 남지 않는다', async () => {
    const first = await hashCollectionPassword('school-2026');
    expect(first).toBe(await hashCollectionPassword('school-2026'));
    expect(first).not.toContain('school-2026');
  });

  it('확장자와 실제 파일 형식이 맞는 PDF만 허용한다', async () => {
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], '검토.pdf', { type: 'application/pdf' });
    await expect(validateCollectionFile(pdf)).resolves.toBeUndefined();
    const disguised = new File(['not a pdf'], '검토.pdf', { type: 'application/pdf' });
    await expect(validateCollectionFile(disguised)).rejects.toThrow('실제 파일 형식');
  });

  it('붙여넣은 표에서 성명 열을 찾아 각 행으로 나눈다', () => {
    expect(parseDataCollectionPastedRows('번호\t성명\t소속\n1\t홍길동\t1학년\n2\t김하늘\t2학년')).toEqual(['홍길동', '김하늘']);
    expect(parseDataCollectionRows([['1', '홍길동'], ['2', '김하늘']])).toEqual(['홍길동', '김하늘']);
    expect(parseDataCollectionPastedRows('홍길동\n김하늘\n홍길동')).toEqual(['홍길동', '김하늘', '홍길동']);
  });

  it('동명이인을 보존하고 사용자가 이름 열을 바꿀 수 있게 분석 결과를 돌려준다', () => {
    const rows = [
      ['번호', '성명', '부서'],
      [1, '김하늘', '연구부'],
      [2, '김하늘', '교무부'],
    ];
    const automatic = analyzeDataCollectionRows(rows);
    expect(automatic.selectedColumn).toBe(1);
    expect(automatic.labels).toEqual(['김하늘', '김하늘']);
    expect(automatic.duplicateCount).toBe(1);
    expect(automatic.columns.map((column) => column.label)).toContain('C열 · 부서');
    expect(analyzeDataCollectionRows(rows, 2).labels).toEqual(['연구부', '교무부']);
  });
});
