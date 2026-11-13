import { describe, expect, test } from 'vitest';
import { draftBodyText } from '../../src/features/officialDocument/draftBody';
import { item, note } from '../../src/features/officialDocument/model';
import { DRAFT_PLACEHOLDER, planDraftBody } from '../../src/features/schoolDocuments/planDocument';
import { context, draft } from '../fixtures/schoolPlan';

// 가상 문장으로 편람 61쪽 예시의 구성(본문 문장 아래 1. 2. 항목, 2타 들여쓰기, 붙임·끝 표시)을 확인한다.
describe('기안 본문 일반 텍스트', () => {
  test('본문 문장 아래 항목은 1.부터 왼쪽 기본선, 하위 항목은 2타씩 들여 쓴다', () => {
    expect(draftBodyText({ lead: '연수를 다음과 같이 실시합니다.', items: [item('일시: 2026. 11. 2.(월)'), item('장소: 가상실', [item('1층'), item('2층')])] })).toBe([
      '연수를 다음과 같이 실시합니다.', '1. 일시: 2026. 11. 2.(월)', '2. 장소: 가상실', '  가. 1층', '  나. 2층  끝.',
    ].join('\n'));
  });
  test('붙임이 하나면 "붙임  명칭  끝.", 여럿이면 둘째 줄부터 붙임 너비만큼 들이고 끝은 한 번', () => {
    expect(draftBodyText({ lead: '붙임과 같이 보고합니다.', items: [], attachments: ['계획 1부.'] })).toBe('붙임과 같이 보고합니다.\n\n붙임  계획 1부.  끝.');
    const text = draftBodyText({ items: [item('관련: 가상과-1'), item('보고합니다.')], attachments: ['계획 1부.', '명단 1부.'] });
    expect(text).toBe(['1. 관련: 가상과-1', '2. 보고합니다.', '', '붙임  1. 계획 1부.', '      2. 명단 1부.  끝.'].join('\n'));
    expect(text.match(/끝\./g)).toHaveLength(1);
  });
  test('※ 참고와 단독 항목은 기호 규칙을 따른다', () => {
    expect(draftBodyText({ items: [item('보고합니다.', [item('세부 하나')]), note('참고 사항')] })).toBe(['보고합니다.', '  세부 하나', '※ 참고 사항  끝.'].join('\n'));
  });
});

describe('운영계획서 기안 본문', () => {
  const conditions = context.conditions;
  test('공문을 바탕으로 했으면 관련 공문 자리와 "위 관련으로"를 두고, 시기·예산을 가. 나.로 쓴다', () => {
    expect(planDraftBody(draft, '독서 주간 운영계획', conditions, true)).toBe([
      `1. 관련: ${DRAFT_PLACEHOLDER}`,
      '2. 위 관련으로 「독서 주간 운영계획」을 다음과 같이 수립하여 시행하고자 합니다.',
      '  가. 운영 시기: 2026년 11월 2~6일',
      '  나. 소요 예산: 금200,000원(금이십만원)',
      '', '붙임  독서 주간 운영계획 1부.  끝.',
    ].join('\n'));
  });
  test('자체 계획이면 본문 문장 아래 1. 2.로 쓰고, 날짜는 공문 표기로 고친다', () => {
    expect(planDraftBody(draft, '가상 체험학습 계획(안)', { ...conditions, timing: '2026-11-02' }, false)).toBe([
      '「가상 체험학습 계획(안)」을 다음과 같이 수립하여 시행하고자 합니다.',
      '1. 운영 시기: 2026. 11. 2.', '2. 소요 예산: 금200,000원(금이십만원)',
      '', '붙임  가상 체험학습 계획(안) 1부.  끝.',
    ].join('\n'));
  });
  test('시기·예산이 없으면 "붙임과 같이", 받침 없는 제목은 "를", 예산 0이면 "없음"', () => {
    const noBudget = { ...draft, budget: [], meta: { ...draft.meta, budgetStatus: 'unconfirmed' as const } };
    expect(planDraftBody(noBudget, '가상 행사', { topic: '가상 행사', timing: '', budget: null }, false)).toBe('「가상 행사」를 붙임과 같이 수립하여 시행하고자 합니다.\n\n붙임  가상 행사 1부.  끝.');
    expect(planDraftBody({ ...noBudget, meta: { ...noBudget.meta, budgetStatus: 'confirmed_none' } }, '가상 행사', { topic: '가상 행사', timing: '', budget: 0 }, false)).toContain('소요 예산: 비예산');
  });
});
