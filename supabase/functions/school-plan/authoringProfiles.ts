import { PLAN_REFERENCE_PROFILES, type PlanReferenceType } from '../_shared/schoolPlanReferences.ts';

export type SectionRole = 'purpose' | 'overview' | 'activities' | 'followUp' | 'effects';
interface AuthoringSection { key: string; role: SectionRole; heading: string; requiredContent: string }
interface AuthoringProfile { sections: AuthoringSection[] }
const section = (key: string, role: SectionRole, heading: string, requiredContent: string): AuthoringSection => ({ key, role, heading, requiredContent });
/** 모든 유형의 마지막 목차. 공문 출력에서는 소요 예산 뒤에 둔다. */
export const EFFECTS_KEY = 'effects';
const effects = section(EFFECTS_KEY, 'effects', '기대 효과', '이 계획으로 학생·교사·학교에 기대되는 변화를 "~ 함양", "~ 기여"처럼 짧은 항목으로 쓴다. 절차·일정·결과 제출을 반복하지 않는다.');

// These are authoring contracts, not sample text to paste into a document.
// The same contract builds the provider schema, instructions and final headings.
export const PLAN_AUTHORING_PROFILES: Record<PlanReferenceType, AuthoringProfile> = {
  general: { sections: [
    section('purpose', 'purpose', '추진 목적', '이번 주제에서 해결할 필요와 참여자가 경험하거나 할 수 있게 될 일.'),
    section('overview', 'overview', '운영 개요와 방침', '대상·기간·장소·담당 역할, 참여 안내, 공문의 필수 운영 조건.'),
    section('activities', 'activities', '세부 활동', '준비부터 실행까지 핵심 과제별 진행 주체·자료·순서·방법·산출물. 안내·실시 같은 이름만 나열하지 않는다.'),
    effects,
  ] },
  'teacher-training': { sections: [
    section('purpose', 'purpose', '연수 목적', '참여 교사의 수업·업무 과제와 연수 후 실제 수행할 역량.'),
    section('participants', 'overview', '연수 대상과 운영 방법', '대상 교원·운영 방식·기간·장소, 진행자와 참여자의 역할, 준비 자료와 참여 지원.'),
    section('trainingModules', 'activities', '연수 내용과 실습', '주제별 사례 분석·실습·공동 설계의 구체적인 과제. 참여 교사가 만들 자료의 항목과 동료 검토 방법. 등록·인사말로 채우지 않는다.'),
    section('classroomApplication', 'followUp', '수업 적용과 결과 공유', '실습 결과를 수업에 적용할 절차, 관찰·기록 항목, 동료 피드백과 결과 공유. 단순 만족도 조사로 대체하지 않는다.'),
    effects,
  ] },
  'student-leadership': { sections: [
    section('purpose', 'purpose', '자치 활동 목표', '학생이 맡을 참여·협력 경험과 지원할 학교생활 과제.'),
    section('selection', 'overview', '선발과 운영 방침', '참여 대상·지원 또는 추천 방법·선정 기준, 임기·교체 방식. 미확정 인원·명단은 만들지 않는다.'),
    section('rolesAndTraining', 'activities', '역할별 활동과 사전 교육', '역할별 실제 수행 순서, 사전 연습과 준비물, 어려움 발생 시 교사에게 보고할 기준. 위험한 수리·계정·비밀번호 관리는 학생에게 맡기지 않는다.'),
    section('supportAndHandover', 'followUp', '활동 점검과 인수인계', '지도교사의 지원, 학생의 기록 항목, 점검·피드백, 역할 교체 때 전달할 자료와 인수인계 절차.'),
    effects,
  ] },
  contest: { sections: [
    section('purpose', 'purpose', '공모 목적', '공모 주제와 작품을 통해 달성할 목적.'),
    section('overview', 'overview', '참가 대상과 운영 조건', '참가 대상·출품 조건·접수 마감, 시상 유무와 공문상 제한. 선정 규칙은 selectionRules에만 쓴다.'),
    section('intake', 'activities', '응모와 접수', '응모자가 제출할 항목·형식, 제출 경로, 접수 번호·누락 확인·보완 안내, 개인정보와 저작권 확인 절차.'),
    section('publication', 'followUp', '결과 발표와 작품 활용', '결과 안내·이의 확인·시상 유무, 공개 범위·동의 확인, 선정작 활용과 기록 보관. 이미 정한 규칙과 충돌하지 않는다.'),
    effects,
  ] },
  'student-program': { sections: [
    section('purpose', 'purpose', '교육활동 목표', '이번 활동에서 학생이 경험하고 표현하거나 익힐 내용.'),
    section('participation', 'overview', '참여 대상과 운영 방침', '대상·기간·공간·교사 역할, 참여 방법과 준비 자료, 참여가 어려운 학생의 대체 경로.'),
    section('learningActivities', 'activities', '활동별 참여 방법', '활동마다 학생이 무엇을 어떤 순서로 하는지, 교사가 어떤 질문·자료로 돕는지, 만들거나 남길 결과물. 공모전이 아니면 경쟁·심사를 강제하지 않는다.'),
    section('feedback', 'followUp', '결과 공유와 피드백', '결과 공유 범위와 개인정보 보호, 학생의 성찰 항목, 교사의 피드백 및 다음 학습에 반영하는 방법.'),
    effects,
  ] },
  'school-project': { sections: [
    section('purpose', 'purpose', '추진 배경과 목표', '제공된 현황과 사업 목표를 연결한다. 확인되지 않은 학교 현황·통계를 만들어 배경을 채우지 않는다.'),
    section('governance', 'overview', '운영 체계와 역할', '과제별 책임 역할·협의 방법·운영 기간·자원과 공문 조건. 미확정 담당자 실명은 만들지 않는다.'),
    section('projectTasks', 'activities', '추진 과제별 실행 계획', '목표별 실천 과제, 준비·실행·중간 점검 절차, 담당 역할과 산출물. 긴 분량은 학기·단계별 실행 및 보완 방법까지 작성한다.'),
    section('evaluation', 'followUp', '성과 확인과 환류', '목표별 확인 지표와 자료 수집 방법, 중간 점검·결과 보고·사례 공유, 다음 운영에 반영할 절차. 목표 수치를 실적으로 쓰지 않는다.'),
    effects,
  ] },
  'ethics-campaign': { sections: [
    section('purpose', 'purpose', '예방교육 목표', '대상 학생의 일상과 연결되는 예방·실천 목표. 법정 의무 시수는 제공된 공문으로 확인된 것만 사용한다.'),
    section('audiences', 'overview', '대상별 운영 방침', '학생·교직원·보호자별 주제·운영 경로, 교육과정 연계, 역할과 기간. 개인 상담·조사 결과는 공개하지 않는다.'),
    section('educationAndPractice', 'activities', '교육과정 연계와 실천 활동', '가상 사례 탐구·행동 연습·생활 실천·캠페인을 연결하고 학년 수준에 맞는 질문·자료·확인 방법을 설계한다.'),
    section('familyAndSupport', 'followUp', '가정 연계와 지원', '가정 안내의 핵심 실천 항목, 도움이 필요한 학생의 개별 요청 경로, 교사의 대응·후속 확인. 확인되지 않은 기관·전화번호는 쓰지 않는다.'),
    effects,
  ] },
  club: { sections: [
    section('purpose', 'purpose', '동아리 활동 목표', '종목·주제에 맞는 참여·협력·개인 성장 목표.'),
    section('membership', 'overview', '참여 대상과 운영 방법', '대상·참여 방법·시간·장소·지도 역할·준비물. 참여 수준과 공간·장비의 제약을 반영한다.'),
    section('sessions', 'activities', '단계별 활동 계획', '기초 익히기→협력·응용→성장 확인의 활동. 단계마다 실제 과제, 난이도 조절·관찰 항목·피드백을 작성하고 긴 분량에서는 회차별 진도를 구체화한다.'),
    section('safetyAndGrowth', 'followUp', '안전 지도와 성장 확인', '활동 전 공간·장비 점검, 활동 중 중지·보고 조건과 교사의 대응, 활동 후 정리·개인 성장 기록·다음 목표.'),
    effects,
  ] },
};

export function authoringInstructions(type: PlanReferenceType) {
  const label = PLAN_REFERENCE_PROFILES.find(p => p.id === type)!.label;
  return `[운영계획 유형: ${label}]\n다음 필수 본문을 각 body 키에 작성한다. 각 키는 실제 문서의 독립된 목차로 출력되므로 다른 유형의 공통 목차로 바꾸지 않는다.\n`
    + PLAN_AUTHORING_PROFILES[type].sections.map(s => `body.${s.key} → ${s.heading}: ${s.requiredContent}`).join('\n');
}
