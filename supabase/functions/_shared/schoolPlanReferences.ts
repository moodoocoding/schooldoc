import type { PlanContext } from './schoolPlan.ts';

// 유형 목록과 자동 분류만 둔다. 유형별 작성 내용은 school-plan/authoringProfiles.ts, 실제 사례 요약은 school-plan/references.ts에 있다.
export const PLAN_REFERENCE_VERSION = '2026-11-14.1';
export interface PlanReferenceProfile {
  id: string;
  label: string;
  cases: { id: string; title: string }[];
}
export const PLAN_REFERENCE_PROFILES = [
  {
    id: 'general', label: '일반 운영',
    cases: [],
  },
  {
    id: 'teacher-training', label: '교원 연수',
    cases: [{ id: 'training-01', title: '수업 설계 역량 강화 연수 사례' }],
  },
  {
    id: 'student-leadership', label: '학생 자치·도우미',
    cases: [{ id: 'leadership-01', title: '학급 디지털 도우미 운영 사례' }],
  },
  {
    id: 'contest', label: '공모전·대회',
    cases: [{ id: 'contest-01', title: '학교 공용 물품 이름 공모전 사례' }],
  },
  {
    id: 'student-program', label: '학생 교육활동·행사',
    cases: [{ id: 'program-01', title: '학생 창작·기록·공유 활동 사례' }, { id: 'program-02', title: '수업·행사 퀴즈 도구 활용 사례' }],
  },
  {
    id: 'school-project', label: '선도학교·학교 사업',
    cases: [{ id: 'project-01', title: '학습 기록 플랫폼 선도학교 운영 사례' }, { id: 'project-02', title: 'AI·디지털 활용 선도학교 운영 사례' }],
  },
  {
    id: 'ethics-campaign', label: '정보통신윤리·예방교육',
    cases: [{ id: 'ethics-01', title: '정보통신윤리교육 연간 운영 사례' }],
  },
  {
    id: 'club', label: '스포츠클럽·동아리',
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
