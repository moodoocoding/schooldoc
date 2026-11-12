import type { PlanContext } from '../../../supabase/functions/_shared/schoolPlan';
import { resolvePlanReference } from '../../../supabase/functions/_shared/schoolPlanReferences';

export function PlanReferenceGuide({ context, drafted = false }: { context: PlanContext; drafted?: boolean }) {
  const { profile, reason } = resolvePlanReference(context);
  return <aside aria-label="작성·검토 기준" className="my-5 rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-sm leading-6 text-slate-700">
    <p className="font-bold text-slate-900">{drafted ? '초안에 적용한' : '적용할'} 작성 기준 · {profile.label}</p>
    <p className="mt-1">{reason} {profile.cases.length ? `실제 사례 ${profile.cases.length}건의 구성과 작성 기준을 참고합니다.` : '현재 연결된 해당 유형의 실제 사례는 없습니다.'}</p>
    <details className="mt-2">
      <summary className="min-h-11 cursor-pointer py-2 font-bold text-[#0F6CBD]">{drafted ? '유형별 검토 항목과 참고 사례' : '작성 기준과 참고 사례 보기'}</summary>
      {!drafted && <p className="mt-2">{profile.writing}</p>}
      <ol className="mt-3 list-decimal space-y-2 pl-5">{profile.review.map(item => <li key={item}>{item}</li>)}</ol>
      {profile.cases.length > 0 && <><p className="mt-4 font-bold">비식별 요약·재서술 사례</p><ul className="mt-1 list-disc pl-5">{profile.cases.map(c => <li key={c.id}>{c.title}</li>)}</ul></>}
      <p className="mt-3">공문과 학교 조건을 우선합니다. 이전 사례의 인명·날짜·금액은 사용하지 않습니다. 위 항목은 교사가 확인할 기준이며 검토 완료 표시가 아닙니다.</p>
    </details>
    {!drafted && <p className="mt-1 text-slate-600">유형을 직접 바꾸려면 문서 선택 단계의 ‘운영계획 유형’을 변경하세요.</p>}
  </aside>;
}
