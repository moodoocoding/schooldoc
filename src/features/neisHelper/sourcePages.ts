import type { AssessmentPlan } from '../../../supabase/functions/_shared/neisHelper';

// PDF의 줄바꿈·띄어쓰기·괄호 차이만 허용한다. 유사도나 AI의 쪽 추측은 사용하지 않는다.
const comparable = (text: string) => text.normalize('NFKC').replace(/[\s[\](){}.,·]/gu, '');

export function reconcileSourcePages(plan: AssessmentPlan, pageTexts: string[]): AssessmentPlan {
  const pages = pageTexts.map(comparable);
  return {
    ...plan,
    assessments: plan.assessments.map((assessment) => {
      const evidence = [assessment.task, assessment.standardCode, ...Object.values(assessment.rubrics)]
        .map(comparable);
      const matches = evidence.every(Boolean)
        ? pages.flatMap((page, index) => evidence.every((text) => page.includes(text)) ? [index + 1] : [])
        : [];
      const warning = matches.length === 0
        ? '평가 내용과 상·중·하 기준이 모두 있는 원본 쪽을 자동 확인하지 못했습니다. 오른쪽에서 쪽을 선택해 대조해 주세요.'
        : matches.length > 1
          ? `같은 평가와 기준이 여러 쪽에 있습니다(${matches.join(', ')}쪽). 첫 번째 쪽을 표시합니다.`
          : null;
      return {
        ...assessment,
        sourcePage: matches[0] ?? null,
        warnings: warning ? [...assessment.warnings, warning] : assessment.warnings,
      };
    }),
  };
}
