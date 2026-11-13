import { NEIS_MAX_TASK_CONTEXT } from '../../../supabase/functions/_shared/neisHelper';
import type { Assessment, AssessmentPlan } from '../../../supabase/functions/_shared/neisHelper';

// PDF의 줄바꿈·띄어쓰기·괄호 차이만 허용한다. 유사도나 AI의 쪽 추측은 사용하지 않는다.
const comparable = (text: string) => text.normalize('NFKC').replace(/[\s[\](){}.,·]/gu, '');

export function reconcileSourcePages(plan: AssessmentPlan, pageTexts: string[]): AssessmentPlan {
  const pages = pageTexts.map(comparable);
  return {
    ...plan,
    assessments: plan.assessments.map((assessment) => {
      const evidence = [assessment.task, assessment.standardCode, assessment.standard, ...Object.values(assessment.rubrics)]
        .map(comparable);
      const matches = evidence.every(Boolean)
        ? pages.flatMap((page, index) => evidence.every((text) => page.includes(text)) ? [index + 1] : [])
        : [];
      const warning = matches.length === 0
        ? '성취기준·평가 내용·상중하 기준이 모두 있는 쪽을 자동 확인하지 못했습니다.'
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

export function matchWorksheet(text: string, assessmentId: string, assessments: Assessment[]) {
  const body = comparable(text);
  const matches = assessments.filter((assessment) => {
    const code = comparable(assessment.standardCode);
    const task = comparable(assessment.task);
    return (code && body.includes(code)) || (task.length >= 4 && body.includes(task));
  });
  const compact = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!compact) return { taskContext: '', warning: '텍스트를 읽지 못했습니다. 지면에서 문항을 확인해 주세요.' };
  if (matches.length !== 1 || matches[0].id !== assessmentId)
    return { taskContext: '', warning: '평가지와 선택한 평가의 연결을 확인해 주세요.' };
  if (compact.length > NEIS_MAX_TASK_CONTEXT)
    return { taskContext: '', warning: '평가지가 길어 문항·과제 조건을 골라 넣어 주세요.' };
  return { taskContext: compact, warning: '' };
}
