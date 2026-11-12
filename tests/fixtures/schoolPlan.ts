import type { PlanAnalysis, PlanContext, PlanDraft, PlanSource } from '../../supabase/functions/_shared/schoolPlan';

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
export const draft: PlanDraft = {
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

// Fictional provider response; the server composes this into the unchanged PlanDraft.
export const authoredDraft = {
  title: draft.title,
  body: {
    purpose: { paragraphs: ['학생이 읽기 기록과 작품 나눔으로 자신의 독서 경험을 표현하고 친구의 관점을 이해한다.'], requirementIds: ['r2'] },
    overview: { paragraphs: ['운영 기간: 2026년 11월 2~6일.', '활동 재료와 인쇄비만 집행하며 교통비는 제외한다.'], requirementIds: ['r1', 'r4'] },
    activities: [
      { name: '개별 읽기 기록', procedure: '학생이 관심 있는 책을 읽고 인상 깊은 장면과 그 이유를 기록한다. 글쓰기가 어려운 학생은 그림이나 말로 표현한다.', result: '읽기 기록과 다음에 읽고 싶은 책을 남긴다.', methodKind: 'proposal', requirementIds: ['r2'] },
      { name: '학급 작품 나눔', procedure: '학생이 소개할 기록을 골라 게시하고 친구의 기록에 궁금한 점을 남긴다. 작성자는 질문을 읽고 자신의 생각을 설명한다.', result: '작품과 질문·응답 기록을 모아 서로 다른 읽기 경험을 확인한다.', methodKind: 'proposal', requirementIds: ['r2'] },
    ],
    effects: { paragraphs: ['책을 고르고 생각을 나누는 독서 습관 형성', '학급 작품 나눔을 통한 표현력과 공감 능력 신장'], requirementIds: ['r3'] },
  },
  schedule: draft.schedule, budget: draft.budget, unknowns: draft.unknowns,
};
