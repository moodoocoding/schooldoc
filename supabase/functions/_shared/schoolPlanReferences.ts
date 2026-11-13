import type { PlanContext } from './schoolPlan.ts';

// Public criteria only. Real-document adaptations live exclusively in school-plan/.
export const PLAN_REFERENCE_VERSION = '2026-11-12.1';
export interface PlanReferenceProfile {
  id: string;
  label: string;
  outline: string[];
  writing: string;
  review: [string, string, string];
  cases: { id: string; title: string }[];
}
export const PLAN_REFERENCE_PROFILES = [
  {
    id: 'general', label: '일반 운영',
    outline: ['추진 목적', '운영 개요와 방침', '세부 활동', '결과 활용'],
    writing: '사업 목적에 필요한 활동을 구체화하고 대상·장소·담당·결과물을 연결한다. 일치하는 실제 사례가 없으므로 사례를 참고했다고 주장하지 않는다.',
    review: ['목적과 대상에 맞는 구체적인 활동인지 확인한다.', '준비·실행·결과 정리의 일정과 담당, 미정 사항을 확인한다.', '공문의 필수 조건과 예산 산출 근거가 반영되었는지 확인한다.'],
    cases: [],
  },
  {
    id: 'teacher-training', label: '교원 연수',
    outline: ['연수 목적', '연수 대상과 운영 방법', '연수 내용과 실습', '수업 적용과 결과 공유'],
    writing: '연수 주제와 교사의 실천 과제를 연결한다. 기초 이해·사례 공유·실습·공동 설계를 주제에 맞게 구성하고 강사 역할·시간·장소·결과 공유를 구분한다.',
    review: ['대상 교사·연수 방식·시간·장소와 강사 섭외 여부를 확인한다.', '연수 주제별 실습 내용과 수업 적용·사례 공유가 연결되는지 확인한다.', '회차·시간과 강사비 산출이 맞는지 확인하고 미확정 강사·단가는 확정하지 않는다.'],
    cases: [{ id: 'training-01', title: '수업 설계 역량 강화 연수 사례' }],
  },
  {
    id: 'student-leadership', label: '학생 자치·도우미',
    outline: ['자치 활동 목표', '선발과 운영 방침', '역할별 활동과 사전 교육', '활동 점검과 인수인계'],
    writing: '선발 대상·기준·방법을 구분하고 선발→역할 안내→교육→활동→점검으로 구성한다. 학생의 도움 역할과 교사가 책임질 업무를 구분한다.',
    review: ['선발 대상·규모·기준·추천 방법과 운영 기간이 일치하는지 확인한다.', '역할별 활동과 사전 교육, 지도교사의 지원·점검 방법을 확인한다.', '학생에게 위험한 정비나 계정·비밀번호 관리 책임을 맡기지 않는지 확인한다.'],
    cases: [{ id: 'leadership-01', title: '학급 디지털 도우미 운영 사례' }],
  },
  {
    id: 'contest', label: '공모전·대회',
    outline: ['공모 목적', '참가 대상과 운영 조건', '응모와 접수', '심사·선정 세부 기준', '결과 발표와 작품 활용'],
    writing: '참가 대상·제출물·접수 방법을 먼저 정하고 안내→접수→심사→발표→활용을 연결한다. 심사 기준·제외 기준·동점 처리·중복 시상 여부를 제안하되 학교 확인 사항으로 표시한다.',
    review: ['참가 대상·출품 수·제출 형식·접수 방법·마감이 명확한지 확인한다.', '심사 기준·배점·제외 기준·동점 처리와 시상 인원의 합계를 대조한다.', '발표·시상·작품 활용 일정과 저작권·공개 범위, 상품 예산을 확인한다.'],
    cases: [{ id: 'contest-01', title: '학교 공용 물품 이름 공모전 사례' }],
  },
  {
    id: 'student-program', label: '학생 교육활동·행사',
    outline: ['교육활동 목표', '참여 대상과 운영 방침', '활동별 참여 방법', '결과 공유와 피드백'],
    writing: '활동별 학생 경험→참여 방법→결과물→공유 방법을 연결한다. 기록·창작·공유 활동과 경쟁·심사를 구별하고 공모전이 아닌 활동에 시상을 강제로 넣지 않는다.',
    review: ['대상·참여 방법·활동 시기와 학생이 만들거나 남길 결과물을 확인한다.', '도구·공간·접근 방법과 참여가 어려운 학생의 대체 방법을 확인한다.', '작품 공유 범위·개인정보·저작권과 결과 피드백, 활동별 예산을 확인한다.'],
    cases: [{ id: 'program-01', title: '학생 창작·기록·공유 활동 사례' }, { id: 'program-02', title: '수업·행사 퀴즈 도구 활용 사례' }],
  },
  {
    id: 'school-project', label: '선도학교·학교 사업',
    outline: ['추진 배경과 목표', '운영 체계와 역할', '추진 과제별 실행 계획', '성과 확인과 환류'],
    writing: '운영 목표→추진 과제→실천 활동→담당→성과 확인을 연결하고 사업 간 예산과 과제를 섞지 않는다. 장기 사업은 선택한 분량에 맞춰 단계별 실행·역할·중간 점검과 성과 확인을 구체화한다.',
    review: ['운영 목표별 과제·활동·담당 역할이 대응되는지 확인한다.', '준비·실행·점검·성과 공유 시기와 증빙·산출물을 확인한다.', '과제별 예산의 단위·산출식·합계와 공문의 집행 조건을 대조한다.'],
    cases: [{ id: 'project-01', title: '학습 기록 플랫폼 선도학교 운영 사례' }, { id: 'project-02', title: 'AI·디지털 활용 선도학교 운영 사례' }],
  },
  {
    id: 'ethics-campaign', label: '정보통신윤리·예방교육',
    outline: ['예방교육 목표', '대상별 운영 방침', '교육과정 연계와 실천 활동', '가정 연계와 지원'],
    writing: '학생·교직원·보호자 교육을 구별하고 교육과정 연계, 생활 실천, 캠페인, 상담·지원 연계를 구성한다. 사례의 연간 의무 시수·법령·기관명·조사 일정은 현재 기준으로 사용하지 않는다.',
    review: ['학년·대상별 교육 주제와 교육과정 연계가 구체적인지 확인한다.', '연간 시수·교육 횟수·법적 근거는 이번 공문에서 확인된 값인지 대조한다.', '실천 활동·가정 안내·도움 요청 경로를 구분하고 민감한 조사 결과의 공개를 피한다.'],
    cases: [{ id: 'ethics-01', title: '정보통신윤리교육 연간 운영 사례' }],
  },
  {
    id: 'club', label: '스포츠클럽·동아리',
    outline: ['동아리 활동 목표', '참여 대상과 운영 방법', '단계별 활동 계획', '안전 지도와 성장 확인'],
    writing: '종목·활동 목표에 맞춰 기초→협력·응용→성장 확인으로 활동을 구성한다. 날짜·시간·장소·지도 역할을 명시하고 긴 분량에서는 단계별 진도·회차의 활동·안전 점검과 성장 확인까지 본문에 구체화한다.',
    review: ['활동 목표·대상·장소·시간·지도교사 역할이 구체적인지 확인한다.', '난이도와 참여 수준에 맞는 단계별 활동·성장 확인 방법을 확인한다.', '활동 전 안전 점검·준비운동·사고 시 지도교사 대응을 학교 여건에 맞게 확인한다.'],
    cases: [{ id: 'club-01', title: '학급 줄넘기 스포츠클럽 운영 사례' }],
  },
] satisfies PlanReferenceProfile[];
export type PlanReferenceType = 'general' | 'teacher-training' | 'student-leadership' | 'contest' | 'student-program' | 'school-project' | 'ethics-campaign' | 'club';
export type PlanReferenceChoice = 'auto' | PlanReferenceType;
export function validatePlanReferenceChoice(value: unknown): PlanReferenceChoice {
  if (value === 'auto' || PLAN_REFERENCE_PROFILES.some(p => p.id === value)) return value as PlanReferenceChoice;
  throw new Error('운영계획 유형을 다시 선택해 주세요.');
}
const classifiers: [string, RegExp][] = [
  ['teacher-training', /교원.{0,18}연수|교사.{0,18}연수|수업\s*(디자인|설계).{0,18}연수|교직원.{0,18}연수/],
  ['student-leadership', /디지털\s*마스터|도우미|학생\s*자치|또래\s*멘토/],
  ['contest', /공모전|경진\s*대회|경연\s*대회|이름\s*공모/],
  ['ethics-campaign', /정보\s*통신\s*윤리|디지털\s*시민|사이버.{0,8}예방|스마트폰.{0,8}과의존/],
  ['club', /스포츠\s*클럽|동아리|줄넘기/],
  ['student-program', /학생\s*중심|교육\s*활동|독서\s*주간|학교\s*행사|창작|갤러리|퀴즈/],
  ['school-project', /선도\s*학교|연구\s*학교|학교\s*사업/],
];
export function resolvePlanReference(context: Pick<PlanContext, 'conditions' | 'analysis' | 'referenceType'>) {
  const choice = validatePlanReferenceChoice(context.referenceType ?? 'auto');
  let id: string = choice === 'auto' ? 'general' : choice;
  let reason = choice === 'auto' ? '해당 유형을 특정하기 어려워 공통 작성 기준을 적용합니다.' : '직접 선택한 유형입니다.';
  if (choice === 'auto') {
    // Prefer the teacher's topic; incidental words in long attachments do not select a type.
    for (const [title, origin] of [[context.conditions.topic, '주제'], [context.analysis?.title ?? '', '공문 제목']]) {
      const match = classifiers.find(([, pattern]) => pattern.test(title.normalize('NFKC')));
      if (match) { id = match[0]; reason = `${origin}에서 유형을 추천했습니다.`; break; }
    }
  }
  return { profile: PLAN_REFERENCE_PROFILES.find(p => p.id === id)!, reason, automatic: choice === 'auto' };
}
export const PLAN_COMMON_REVIEW = [
  '현재 공문의 필수 요구사항과 교사 입력을 우선한다. 작성 사례는 사실 근거나 의무 사항이 아니다.',
  '날짜와 요일, 기간·마감, 대상·시상 인원, 원·천원 단위와 단가×수량·합계를 서로 대조한다.',
  '원문에 없는 근거 문서번호·인명·기관·예산 기준을 만들지 않는다. 제안과 학교 확인 사항을 구분한다.',
];
