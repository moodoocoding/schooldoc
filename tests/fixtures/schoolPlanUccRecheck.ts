import type { PlanDocumentV2 } from '../../supabase/functions/_shared/planDocumentV2';

/** 운영 재검수(2026-11-14)에서 실제 AI가 쓴 가상 공모전 초안(일정 수정 적용 후). 모든 내용은 가상이다. */
export const uccRecheckDraft: PlanDocumentV2 = {
  schemaVersion: '2.0',
  title: '2027학년도 학생 디지털 시민성 UCC 공모전 운영 계획',
  background: [],
  purpose: ['디지털 예절·개인정보 보호·사이버 언어폭력 예방에 대한 학생의 이해와 실천 역량 함양', '학생 참여형 영상 제작을 통한 올바른 디지털 소통 문화 확산'],
  overview: { period: '2027. 4. 1. ~ 4. 30.', target: '관내 초등학교 5~6학년 학생', venue: null, summary: '디지털 시민성 주제의 UCC를 교내 공모·심사하고 우수작 2편 이내를 교육지원청에 제출' },
  policies: ['공문에 정한 대상, 주제, 작품 규격 및 제출 한도를 준수하여 운영', '초상권·저작권 침해가 없도록 작품 제작 전 사전 지도', '학생 얼굴이 드러나는 작품은 보호자 동의서를 확인한 뒤 접수', '심사·시상 세부안은 학교 내부 검토 후 확정'],
  detailedPlans: [
    { subTitle: '공모 및 작품 접수', details: ['참여 조건: 5~6학년 학생 대상, 개인 또는 3명 이내 팀으로 참여', '주제 선택: 디지털 예절, 개인정보 보호, 사이버 언어폭력 예방 중 1개 선택', '작품 규격: 1분 이내 MP4 동영상', '접수 방법: 작품 파일과 참가 정보를 담임교사 또는 담당교사에게 제출하는 방식으로 운영(안)', '제출 확인: 작품 규격, 주제 적합성, 얼굴 노출 시 보호자 동의 여부 확인'] },
    { subTitle: '심사 및 추천작 선정', details: ['심사 방식: 교내 심사위원이 접수 작품을 검토하여 우수작 선정(안)', '심사 기준: 주제 적합성 30점, 교육적 효과 30점, 창의성 20점, 완성도 20점(안)', '동점 처리: 주제 적합성, 교육적 효과, 창의성 순으로 높은 작품 우선(안)', '추천작 선정: 심사 결과에 따라 학교별 2편 이내 선정'] },
    { subTitle: '결과 안내 및 제출', details: ['결과 안내: 선정 결과를 참가 학생에게 안내하는 방식으로 운영(안)', '교육지원청 제출: 운영 결과 보고서 양식과 추천작을 업무관리시스템으로 제출'] },
  ],
  schedule: [
    { step: '공모 안내', task: '참여 조건 및 작품 규격 안내', date: '2027. 4. 1.', owner: null },
    { step: '작품 접수', task: '작품 및 참가 정보 접수(안)', date: '2027. 4. 1. ~ 4. 16.(안)', owner: null },
    { step: '우수작 선정', task: '작품 심사·추천작 선정 및 결과 안내(안)', date: '2027. 4. 19. ~ 4. 30.(안)', owner: null },
    { step: '결과 제출', task: '운영 결과 보고서 및 추천작 제출', date: '2027. 5. 7.까지', owner: null },
  ],
  budget: [
    { item: '시상 물품 구입(안)', spec: '우수작 시상용 물품, 1식', unitPrice: 200000, quantity: 1, total: 200000, note: '지원금 중 배정' },
    { item: '편집 앱 구입(안)', spec: '영상 편집 앱 사용권, 1식', unitPrice: 100000, quantity: 1, total: 100000, note: '지원금 중 배정' },
  ],
  expectedEffects: ['디지털 예절·개인정보 보호·사이버 언어폭력 예방에 관한 학생의 이해와 실천 역량 신장', '학생이 제작한 영상 콘텐츠를 통한 학교 내 디지털 시민성 인식 확산'],
  meta: {
    requirementIds: ['target_grade', 'theme_selection', 'video_spec', 'school_operating_period', 'submission_limit', 'submission_deadline', 'budget_amount', 'copyright_privacy_note'],
    unknowns: ['학교 내 접수 경로와 담당자', '심사위원 구성 및 심사 기준·동점 처리안의 확정 여부', '시상 시행 여부와 세부 규모', '예산 집행 품목·수량·실제 단가의 확정 여부'],
    budgetStatus: 'specified',
  },
};
