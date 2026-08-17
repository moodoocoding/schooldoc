import { describe, expect, it } from 'vitest';
import { buildDuplicateDraft, duplicateTitle } from '../../src/features/consentForms/consentDuplicate';
import type { ConsentLocalDraft } from '../../src/features/consentForms/types';

const source: ConsentLocalDraft = {
  id: 'origin', title: '현장체험학습 동의서', fileName: 'notice.pdf', fieldCount: 2,
  recipientMode: 'named', recipientCount: 25, createdAt: '2026-03-02T00:00:00.000Z',
  description: '기한 내 제출 바랍니다.',
  fields: [{ id: 'f1', kind: 'text', label: '보호자 의견', required: true, pageIndex: 0, x: 10, y: 20, width: 30, height: 7 }],
  publicToken: 'old-token', deadline: '2026-03-20', passwordEnabled: true, passwordHash: 'old-hash',
  allowResubmission: true, responseCount: 24, status: 'closed',
  pageCount: 2, pageSizes: [{ width: 595, height: 842 }, { width: 595, height: 842 }],
  retentionMonths: 24, sourcePdfDataUrl: 'data:application/pdf;base64,AAAA',
};

const seed = { id: 'copy', publicToken: 'new-token', createdAt: '2026-08-17T00:00:00.000Z' };

describe('수합 복제', () => {
  it('제목에 사본 표시를 붙인다', () => {
    expect(duplicateTitle('현장체험학습 동의서')).toBe('현장체험학습 동의서 사본');
    expect(duplicateTitle('  ')).toBe('가정통신문 사본');
    expect(duplicateTitle('가'.repeat(250)).length).toBe(200);
  });

  it('원본 PDF와 필드 배치를 그대로 가져온다', () => {
    const copy = buildDuplicateDraft(source, seed);

    expect(copy.fields).toEqual(source.fields);
    expect(copy.pageSizes).toEqual(source.pageSizes);
    expect(copy.pageCount).toBe(source.pageCount);
    expect(copy.sourcePdfDataUrl).toBe(source.sourcePdfDataUrl);
    expect(copy.description).toBe(source.description);
    expect(copy.recipientMode).toBe('named');
    expect(copy.allowResubmission).toBe(true);
    expect(copy.retentionMonths).toBe(24);
  });

  it('새 수합으로 다시 시작할 수 있게 식별자를 바꾼다', () => {
    const copy = buildDuplicateDraft(source, seed);

    expect(copy.id).toBe('copy');
    expect(copy.publicToken).toBe('new-token');
    expect(copy.publicToken).not.toBe(source.publicToken);
    expect(copy.createdAt).toBe('2026-08-17T00:00:00.000Z');
  });

  it('물려받으면 곤란한 것은 비운다', () => {
    const copy = buildDuplicateDraft(source, seed);

    // 지난 기한을 물려받으면 만들자마자 종료된 수합이 된다.
    expect(copy.deadline).toBe('');
    expect(copy.status).toBe('open');
    // 예전 비밀번호가 걸린 채 배부되면 보호자가 열지 못한다.
    expect(copy.passwordEnabled).toBe(false);
    expect(copy.passwordHash).toBe('');
    // 다른 수합의 회신이 섞이면 안 된다.
    expect(copy.responseCount).toBe(0);
  });

  it('원본은 손대지 않는다', () => {
    buildDuplicateDraft(source, seed);
    expect(source.title).toBe('현장체험학습 동의서');
    expect(source.responseCount).toBe(24);
    expect(source.publicToken).toBe('old-token');
  });
});
