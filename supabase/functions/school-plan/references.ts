import { PLAN_COMMON_REVIEW, PLAN_REFERENCE_VERSION, resolvePlanReference } from '../_shared/schoolPlanReferences.ts';
import type { PlanContext } from '../_shared/schoolPlan.ts';

// Human-readable adaptations of reviewed documents, not quotations or approved templates.
// Original paths, hashes, section locators and exclusions are in the private provenance record.
// No source files, personal data, old dates, amounts or school-specific names belong here.
const examples: Record<string, { structure: string[]; adaptedExcerpt: string; caution: string }> = {
  'training-01': {
    structure: ['목적·방침', '기간·대상·방법', '일정별 연수 내용·강사 역할·시간', '사업별 예산', '수업 적용 효과'],
    adaptedExcerpt: '연수는 기초 이해, 실천 사례 공유, 실습, 공동 설계를 연결하여 운영한다. 연수에서 만든 수업안을 실제 수업에 적용하고, 후속 모임에서 적용 사례를 공유하여 보완한다. 일정표에는 주제별 내용과 강사 역할, 시간을 구분하여 적는다.',
    caution: '기존 강사명·연수 횟수·회당 강사비를 재사용하지 않는다. 수업 적용과 공유 흐름만 참고한다.',
  },
  'leadership-01': {
    structure: ['배경·목적', '선발 기준·추천 방법', '운영 기간·대상·장소', '관리 보조·또래 지원·홍보 역할', '역량 강화 교육'],
    adaptedExcerpt: '기기 활용에 관심이 있고 친구를 배려하며 맡은 역할을 책임 있게 수행하는 학생을 추천한다. 학생은 수업 전후 기기 배부와 회수를 돕고 사용에 어려움이 있는 친구를 지원한다. 역할 수행에 필요한 도구 활용 교육을 활동과 함께 운영한다.',
    caution: '학급당 인원·추천 마감·교육 일정은 예전 문서에서 가져오지 않는다. 안전한 업무 범위와 교사 책임은 별도로 검토한다.',
  },
  'contest-01': {
    structure: ['배경·목적', '참가·출품 규칙', '안내·접수·심사·발표·활용 일정', '평가·제외·동점 기준', '시상 중복 기준·상품 예산'],
    adaptedExcerpt: '공모 취지와 제출 방법을 안내한 뒤 접수 작품을 검토한다. 예선과 본심사의 역할을 구분하고 적합성·친근성·창의성·의미를 기준으로 평가한다. 동점일 때 적용할 기준의 순서를 미리 정하고 중복 시상 여부를 명시한다. 선정 결과는 발표 후 학교 활동에 활용한다.',
    caution: '두 단계 심사, 심사 항목, 배점과 시상 규모는 사례의 선택 사항이다. 이번 공문에 없으면 학교 확인이 필요한 제안으로만 사용한다.',
  },
  'program-01': {
    structure: ['목적·방침', '공모형·기록형·갤러리형 활동 구별', '활동별 대상·참여 방법·결과물', '월별 학생 경험', '공유·활용·예산'],
    adaptedExcerpt: '독서 기록은 읽은 책의 소감과 추천 이유를 남기고 서로의 기록에 의견을 나누는 방식으로 운영한다. 창작 활동은 주제를 고르고 작품을 제작한 뒤 온라인 또는 교내 공간에서 감상·공유한다. 활동마다 참여 방식, 결과물과 활용 방법을 연결하고 심사가 필요한 활동만 별도 기준을 둔다.',
    caution: '원문의 예산 산출과 합계에 불일치가 있어 수치는 사용하지 않았다. 기존 행사의 종류·시기·시상은 현재 계획의 필수 사항이 아니다.',
  },
  'program-02': {
    structure: ['도입 목적', '활용 대상', '수업·학습 점검·행사 활용', '접근·동시 참여·결과 확인 조건', '피드백'],
    adaptedExcerpt: '수업 중 핵심 개념 확인과 학습 정리, 행사 참여 활동에 퀴즈 도구를 활용한다. 교사는 문항별 응답과 참여 결과를 확인하여 보충 지도에 활용한다. 여러 학급이 함께 참여할 때의 접속 방법과 안정성, 자료의 수정·공유·재사용 방법을 사전에 확인한다.',
    caution: '특정 유료 서비스의 구입이나 공동 계정 사용을 당연한 운영 조건으로 만들지 않는다.',
  },
  'project-01': {
    structure: ['목표·추진 과제', '환경 조성', '활동·기록·소통·성장 흐름', '수업 및 가정 연계', '성과 확산·과제별 예산'],
    adaptedExcerpt: '수업 결과와 학생의 성찰 기록을 누적하여 성장 과정을 살핀다. 활동 결과를 공유하는 과정에서 출처 표시, 타인의 사진과 정보 보호, 존중하는 댓글 쓰기를 함께 실천한다. 수업 사례를 학습공동체에서 나누고 가정에는 자녀의 성장 과정과 지원 방법을 안내한다.',
    caution: '학교 고유 수업모델 이름과 플랫폼을 그대로 이식하지 않는다. 활동 구조를 이번 사업의 과제에 맞게 조정한다.',
  },
  'project-02': {
    structure: ['배경·목표', '운영 조직과 업무 분장', '과제별 일정', '진단·보정·성찰·기록 활동', '성과 확인·사업비'],
    adaptedExcerpt: '학생의 학습 상태를 파악하고 필요한 보정 활동을 연결한다. 학생은 학습 결과와 활동 기록을 함께 살펴 다음 목표를 정한다. 교원은 관련 수업 사례를 공동으로 설계·적용·공유한다. 운영 담당은 과제별 실행 상황과 결과 자료를 모아 사업의 개선에 활용한다.',
    caution: '원문의 일부 산출식과 표시 금액이 달라 수치는 제외했다. 지원 기관·확정 평가·사업비 비율도 새 공문에서 다시 확인한다.',
  },
  'ethics-01': {
    structure: ['목적·근거·방침', '대상별 연간 운영', '학년군별 교육 내용', '교육 주간·가정 실천·교원 연수', '상담 및 지원 연계'],
    adaptedExcerpt: '학년의 발달 수준을 고려하여 온라인 소통 예절, 개인정보 보호, 저작물 이용과 미디어 활용을 교육과정에 연결한다. 수업에서 익힌 내용을 생활 속 실천과 캠페인으로 이어가며 보호자 안내와 교직원 연수를 구분하여 운영한다. 지원이 필요한 경우 상담·도움 요청 경로를 안내한다.',
    caution: '사례의 법령·의무 시수·진단 조사·기관·링크는 현행 기준으로 검증하지 않았으므로 사용하지 않는다. 이번 공문에서 확인되지 않으면 확인 필요로 남긴다.',
  },
  'club-01': {
    structure: ['종목·대상·지도 역할·활동 목표', '날짜·시간·장소', '기초 동작→협력·응용→성장 확인'],
    adaptedExcerpt: '활동은 기본 동작을 익힌 뒤 짝과 호흡을 맞추고 여러 동작을 연결하는 순서로 구성한다. 일정표에는 활동 시간과 장소, 각 회차에서 할 일을 적는다. 이전 활동과 비교하여 개인의 향상을 확인하고 협력 활동을 함께 배치한다.',
    caution: '회차별 과거 날짜와 참여 인원을 재사용하지 않는다. 안전 지도는 원문에 충분하지 않아 별도의 작성·검토 기준으로 보완한다.',
  },
};

export function getPlanReferencePack(context: PlanContext) {
  const { profile } = resolvePlanReference(context);
  return {
    version: PLAN_REFERENCE_VERSION, type: profile.id, label: profile.label,
    provenance: '실제 작성 문서의 구조·내용을 비식별 요약·재서술한 사례. 원문 인용 또는 승인된 표준 서식이 아님.',
    outline: profile.outline, writing: profile.writing,
    review: [...PLAN_COMMON_REVIEW, ...profile.review],
    examples: profile.cases.map(c => ({ ...c, ...examples[c.id] })),
  };
}
