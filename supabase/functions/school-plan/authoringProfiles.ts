import type { PlanReferenceType } from '../_shared/schoolPlanReferences.ts';

/**
 * 유형별 짧은 점검 목록(typeGuide). 새 목차 설계서가 아니다.
 * - focus: 세부 추진 계획에서 검토할 주제 후보. 사업에 실제로 있는 것만 중항목으로 쓴다.
 * - cautions: 이 유형에서 생기기 쉬운 잘못. 해당 조건이 있을 때만 적용한다.
 * 문서 목차(6개)와 공통 원칙은 prompt.ts의 corePrompt에만 있다.
 */
export interface PlanTypeGuide { focus: string; cautions: string[] }

export const PLAN_TYPE_GUIDES: Record<PlanReferenceType, PlanTypeGuide> = {
  general: {
    focus: '사전 준비, 참여 안내, 실제 운영, 결과 정리',
    cautions: ['사업의 실제 활동·자료·담당·산출물 중심으로 쓴다. 형식적인 단계를 억지로 더하지 않는다.'],
  },
  'teacher-training': {
    focus: '연수 일정·대상, 강사·운영자, 회차별 내용, 실습, 결과 공유',
    cautions: ['연수 시수·시간·강사비가 서로 맞아야 한다.', '강사가 정해지지 않았으면 강사를 임의로 정하지 않는다.', '수업 적용은 연수 목적상 필요한 경우에만 쓴다.'],
  },
  'student-leadership': {
    focus: '모집·선발, 역할별 활동, 사전 안내, 지도, 활동 점검',
    cautions: ['장비 수리, 관리자 계정·비밀번호 관리처럼 위험하거나 책임이 큰 일은 학생에게 맡기지 않는다.'],
  },
  contest: {
    focus: '참여 조건, 응모·접수, 심사 방식, 결과 안내·시상·활용',
    cautions: ['실제 심사가 있으면 기준과 동점 처리를 분명히 쓴다.', '배점·시상·심사 위원 구성은 공문이나 학교 입력의 근거 없이 확정하지 않는다. 필요하면 (안)으로 제안한다.', '투표 방식이면 점수 심사를 넣지 않는다.'],
  },
  'student-program': {
    focus: '사전 안내·안전, 활동별 진행, 참여 지원, 결과 공유',
    cautions: ['경연이 아닌 행사에 심사·시상을 넣지 않는다.', '작품을 공개할 때만 개인정보·저작물 공개 동의를 다룬다.'],
  },
  'school-project': {
    focus: '필수 추진 과제, 담당, 실행 일정, 점검·환류, 예산 집행',
    cautions: ['공문이 지정한 과제를 먼저 쓴다. 모든 사업에 TF·자율과제를 넣지 않는다.', '이미 이룬 실적과 앞으로의 목표를 구분한다.'],
  },
  'ethics-campaign': {
    focus: '대상별 교육, 교육과정 연계, 실천 활동, 가정 안내·지원',
    cautions: ['근거 없는 법정 시수·법령·외부 기관 연락처를 만들지 않는다.', '민감한 실태 조사·상담 정보는 쓰지 않는다.'],
  },
  club: {
    focus: '모집, 단계별 활동, 지도 인력, 시설·안전, 성장 기록',
    cautions: ['종목·동아리 성격에 맞게 쓴다. 대회·기록 경쟁·발표회·시상을 의무로 넣지 않는다.'],
  },
};
