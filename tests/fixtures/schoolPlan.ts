import type { PlanAnalysis, PlanContext, PlanDraft, PlanDraftV1, PlanSource } from '../../supabase/functions/_shared/schoolPlan';

// Entirely fictional source and response data, used only by local tests.
export const sourceText = '가상 학교 독서 주간 안내\n운영 기간: 2026년 11월 2일부터 6일까지.\n학생별 읽기 기록을 남기고 학급별 작품 나눔을 실시한다.\n결과 제출 기한: 2026년 11월 9일.\n예산 상한 300,000원. 활동 재료와 인쇄비로 집행하며 교통비는 집행할 수 없다.';
export const sources: PlanSource[] = [{ id: 'source1', name: '가상 공문.txt', parts: [{ id: 'text_1', label: '본문', text: sourceText }] }];
export const analysis: PlanAnalysis = {
  title: '독서 주간 운영계획', summary: '독서 주간을 운영하고 읽기 기록과 학급별 작품 나눔 결과를 제출하는 가상 안내입니다.',
  requirements: [
    { id: 'r1', text: '11월 2~6일 운영', kind: 'required', sourceId: 'source1', partId: 'text_1', quote: '운영 기간: 2026년 11월 2일부터 6일까지.' },
    { id: 'r2', text: '학생별 읽기 기록과 학급별 작품 나눔', kind: 'required', sourceId: 'source1', partId: 'text_1', quote: '학생별 읽기 기록을 남기고 학급별 작품 나눔을 실시한다.' },
    { id: 'r3', text: '11월 9일까지 결과 제출', kind: 'required', sourceId: 'source1', partId: 'text_1', quote: '결과 제출 기한: 2026년 11월 9일.' },
    { id: 'r4', text: '예산 30만원 이내, 재료·인쇄비 허용, 교통비 제외', kind: 'required', sourceId: 'source1', partId: 'text_1', quote: '예산 상한 300,000원. 활동 재료와 인쇄비로 집행하며 교통비는 집행할 수 없다.' },
  ], questions: [], budgetLimit: { amount: 300000, requirementId: 'r4' },
};
export const context: PlanContext = { sources, analysis, answers: {}, conditions: { topic: '독서 주간 운영계획', timing: '2026년 11월 2~6일', budget: 300000 } };
/** 이전(v1) 형식 초안. 보존·읽기 호환 검사용. */
export const legacyDraft: PlanDraftV1 = {
  title: '독서 주간 운영계획', sections: [
    { id: 'purpose', heading: '운영 목적', paragraphs: ['학생이 스스로 고른 책을 읽고 기록하며 서로의 읽기 경험을 나눈다. 학급별 작품 나눔을 통해 친구의 관점을 이해하고 꾸준히 독서하는 기회를 마련한다.'], requirementIds: ['r2'] },
    { id: 'operation', heading: '운영 방법', paragraphs: ['2026년 11월 2일부터 6일까지 독서 주간을 운영한다. 학급별 도서 선정과 활동 공간 준비는 운영 전 주에 마치고 학생 참여 방법을 안내한다.', '학생은 읽기 기록에 인상 깊은 장면과 자신의 생각을 남긴다. 작품 나눔에서는 참여 학생의 의견을 고르게 소개하며 기록과 결과물을 함께 모은다.'], requirementIds: ['r1', 'r2'] },
    { id: 'report', heading: '결과 정리와 기대효과', paragraphs: ['담당 교사는 학생별 기록과 학급 작품 나눔 자료를 취합하여 11월 9일까지 결과를 제출한다. 학생의 참여 과정과 다양한 독서 경험을 중심으로 활동을 돌아본다.'], requirementIds: ['r3'] },
  ], schedule: [
    { when: '10월 마지막 주(안)', activity: '활동 도서와 준비물 점검, 학급 참여 방법 안내', owner: '담임 교사(학교 확인)', requirementIds: ['r2'] },
    { when: '11월 2~6일', activity: '개별 독서·읽기 기록 및 학급별 작품 나눔', owner: '참여 학생·담임 교사(안)', requirementIds: ['r1', 'r2'] },
    { when: '11월 9일까지', activity: '기록과 작품 나눔 자료를 취합하여 결과 제출', owner: '업무 담당 교사(학교 확인)', requirementIds: ['r3'] },
  ], budget: [
    { item: '활동 기록지 인쇄(제안)', unitPrice: 100, quantity: 500, requirementIds: ['r4'] },
    { item: '작품 나눔 재료(제안)', unitPrice: 10000, quantity: 15, requirementIds: ['r4'] },
  ], unknowns: ['참여 학급과 담당 교사는 학교에서 확인한다.', '예산안의 단가는 실제 견적과 집행 기준을 확인한다.'],
};

/** v2 초안(= AI 응답 형식). 모든 내용은 가상이다. */
export const draft: PlanDraft = {
  schemaVersion: '2.0',
  title: '독서 주간 운영계획',
  purpose: ['스스로 고른 책을 읽고 기록하는 자기주도적 독서 습관 형성', '학급별 작품 나눔으로 친구의 관점을 이해하고 존중하는 태도 함양'],
  overview: { period: '2026. 11. 2.(월)∼11. 6.(금)', target: '전교 학생(참여 학급은 학교 확인)', venue: '각 학급 교실', summary: '학생별 읽기 기록과 학급별 작품 나눔' },
  policies: ['학생이 글·그림·말 중 편한 방법으로 기록하도록 허용', '예산은 활동 재료와 인쇄비로만 집행하며 교통비는 집행하지 않음', '공개를 원하지 않는 기록은 게시하지 않고 개별로 나눔'],
  detailedPlans: [
    { subTitle: '사전 준비', details: ['도서 점검: 학급 문고와 도서실 대출 가능 도서 확인', '참여 안내: 담임교사가 학생에게 기록 방법과 일정 안내'] },
    { subTitle: '개별 읽기 기록', details: ['기록 방법: 인상 깊은 장면과 선택 이유를 읽기 기록지에 작성', '지원: 글쓰기가 어려운 학생은 그림·말로 표현하고 담임교사가 기록 도움'] },
    { subTitle: '학급 작품 나눔', details: ['게시: 학생이 소개할 기록을 골라 학급 게시판에 게시', '질문 나눔: 친구 기록에 질문을 남기고 작성자가 답변'] },
    { subTitle: '결과 정리', details: ['수합: 업무 담당 교사가 학급별 기록과 나눔 자료를 모아 11. 9.까지 결과 제출'] },
  ],
  schedule: [
    { step: '준비', task: '도서·준비물 점검, 참여 방법 안내', date: '2026. 10. 26.(월)∼10. 30.(금)', owner: '담임교사' },
    { step: '운영', task: '개별 읽기 기록과 학급 작품 나눔', date: '2026. 11. 2.(월)∼11. 6.(금)', owner: '담임교사' },
    { step: '정리', task: '기록·나눔 자료 수합 및 결과 제출', date: '2026. 11. 9.(월)', owner: '업무 담당 교사' },
  ],
  budget: [
    { item: '인쇄비', spec: '읽기 기록지 500매', unitPrice: 100, quantity: 500, total: 50000, note: null },
    { item: '활동 재료', spec: '작품 나눔 게시 재료 15학급분', unitPrice: 10000, quantity: 15, total: 150000, note: '견적 확인 필요' },
  ],
  expectedEffects: ['자기주도적 독서 습관 형성에 기여', '서로 다른 읽기 경험을 나누며 표현력과 존중하는 태도 신장'],
  meta: { requirementIds: ['r1', 'r2', 'r3', 'r4'], unknowns: ['참여 학급과 담당 교사는 학교에서 확인'], budgetStatus: 'specified' },
};
/** AI 응답은 초안과 같은 형식이다. */
export const authoredDraft = draft;
