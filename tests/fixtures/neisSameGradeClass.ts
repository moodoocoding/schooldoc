import type { ClassCommentInput } from '../../supabase/functions/_shared/neisClassComments.ts';

/** Synthetic class: 23 aliases, the same three high grades, no real student data. */
export function sameGradeClass(): ClassCommentInput {
  return {
    subject: '국어', length: 300,
    evaluations: [
      {
        standardCode: '가상-문학', standard: '작품을 읽고 인상적인 부분에 대한 생각을 나눈다.',
        task: '시를 읽고 인상적인 부분에 대해 의견 나누기',
        rubrics: { high: '작품에서 인상적인 부분을 찾아 그 이유를 작품과 연결 지어 구체적으로 설명한다. 다른 사람과 의견을 적극적으로 나누고 친구의 의견을 정리한다.' },
      },
      {
        standardCode: '가상-쓰기', standard: '쓰기 목적과 매체의 특성을 고려하여 글을 쓴다.',
        task: '학급 누리집을 활용해 글 쓰기',
        rubrics: { high: '쓰기 상황의 목적에 맞는 적절한 내용을 생성하고 매체의 특성을 적극적으로 활용하여 효과적으로 표현하며 글을 쓴다. 친구들과 글을 공유하며 적극적으로 의사소통한다.' },
      },
      {
        standardCode: '가상-읽기', standard: '글의 내용을 추론하며 읽고 중심 내용을 요약한다.',
        task: '글의 내용을 추론하며 글쓴이의 생각 파악하기',
        rubrics: { high: '글의 문맥을 고려하여 의미를 이해한다. 생략된 내용이나 이어질 내용, 함축된 표현을 정확하게 추론한다. 글의 주제를 정확하게 파악하고 자신의 언어로 중심 내용이 잘 드러나게 요약한다.' },
      },
    ],
    groups: [{ ids: Array.from({ length: 23 }, (_, index) => `s${index + 1}`), grades: ['high', 'high', 'high'] }],
  };
}
