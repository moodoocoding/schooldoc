import { describe, expect, test } from 'vitest';
import { matchWorksheet, reconcileSourcePages } from '../../src/features/neisHelper/sourcePages';
import type { AssessmentPlan } from '../../supabase/functions/_shared/neisHelper';

const plan: AssessmentPlan = {
  year: '2026', schoolGrade: '5', semester: '2',
  assessments: [{
    id: 'average', subject: '수학', standardCode: '6수04-01', standard: '평균을 구한다.',
    task: '평균의 의미를 알고, 주어진 자료의 평균 구하기', sourcePage: 7, warnings: [],
    rubrics: {
      high: '평균과 관련된 다양한 실생활 문제를 해결할 수 있다.',
      middle: '주어진 자료의 평균을 구할 수 있다.', low: '간단한 자료의 평균을 구할 수 있다.',
    },
  }],
};
const page = `[6수04-01] 평균을 구한다. 평균의 의미를 알고, 주어진 자료의 평균 구하기
평균과 관련된 다양한 실생활 문제를 해결할 수 있다.
주어진 자료의 평균을 구할 수 있다. 간단한 자료의 평균을 구할 수 있다.`;

describe('평가계획 원본 쪽 대조', () => {
  test('AI 쪽 번호가 잘못돼도 실제 평가와 세 기준이 있는 쪽을 사용한다', () => {
    const result = reconcileSourcePages(plan, ['표지', '다른 교과', page.replaceAll(' ', '\n')]);
    expect(result.assessments[0].sourcePage).toBe(3);
    expect(result.assessments[0].warnings).toEqual([]);
    expect(plan.assessments[0].sourcePage).toBe(7);
  });
  test('코드만 같은 쪽, 다른 하 기준, 스캔 원본은 쪽을 추측하지 않는다', () => {
    for (const pages of [['6수04-01'], [page.replace('간단한 자료', '복잡한 자료')], ['']]) {
      const result = reconcileSourcePages(plan, pages).assessments[0];
      expect(result.sourcePage).toBeNull();
      expect(result.warnings.join('')).toContain('자동 확인하지 못했습니다');
    }
  });
  test('기준이 빠진 분석은 자동 연결하지 않는다', () => {
    const incomplete = structuredClone(plan);
    incomplete.assessments[0].rubrics.low = '';
    expect(reconcileSourcePages(incomplete, [page]).assessments[0].sourcePage).toBeNull();
  });
  test('같은 표가 반복되면 첫 원본과 중복 안내를 제공한다', () => {
    const result = reconcileSourcePages(plan, [page, '다른 자료', page]).assessments[0];
    expect(result.sourcePage).toBe(1);
    expect(result.warnings[0]).toContain('1, 3쪽');
  });
  test('평가지는 제목 또는 코드가 고유하게 일치할 때만 문항을 자동 반영한다', () => {
    const items = [...plan.assessments, { ...plan.assessments[0], id: 'multiply', standardCode: '6수01-13', task: '소수 곱셈' }];
    expect(matchWorksheet('[6수04-01] 표에서 값을 찾아 이유를 쓰시오.', 'average', items)).toEqual({
      taskContext: '[6수04-01] 표에서 값을 찾아 이유를 쓰시오.', warning: '',
    });
    for (const body of ['소수 곱셈', '[6수04-01] 소수 곱셈', '해당 없음', '']) {
      expect(matchWorksheet(body, 'average', items)).toMatchObject({ taskContext: '', warning: expect.any(String) });
      expect(matchWorksheet(body, 'average', items).warning).toBeTruthy();
    }
  });
});
