/**
 * 교과별 성취수준 및 특기사항 문체 예시. 「교과세특 기재 예시 도움 자료」(교육부·평가원, 2022)의 문장 구성 방식을
 * 참고해 새로 작성한 가상 예시다. 원문 예시를 옮기지 않았고, 개인 사실(책 제목·받는 사람·수치·성장 서사)을 넣지 않았다.
 * 평어를 만들 때는 해당 교과 예시만 보낸다.
 */
interface SubjectExample {
  task: string;
  high: string;
  middle: string;
  low: string;
  /** 같은 상 수준을 다른 순서·구조로 쓴 예. 학생 간 다양화 방법을 보여 준다. */
  highAlternative: string;
}

const examples: Record<string, SubjectExample> = {
  국어: {
    task: '적절한 근거를 들어 주장하는 글 쓰기(근거 마련, 글의 짜임 계획, 고쳐쓰기)',
    high: '주장에 알맞은 근거를 두 가지 이상 마련하고 서론·본론·결론의 짜임에 맞게 글을 구성함. 근거와 주장이 자연스럽게 이어지도록 표현을 고쳐 쓰며 읽는 이를 설득하는 힘이 돋보임.',
    middle: '주장에 맞는 근거를 마련하고 글의 짜임을 생각하며 주장하는 글을 씀. 고쳐쓰기 과정에서 근거와 주장의 연결을 살피며 자신의 생각을 글로 나타내는 능력을 기름.',
    low: '자신의 주장을 정하고 그에 맞는 근거를 들어 짧은 주장하는 글을 씀. 글을 다시 읽으며 생각을 글로 정리하는 방법을 익힘.',
    highAlternative: '읽는 이를 설득하려는 목적을 고려해 근거를 고르고 글의 짜임을 계획하는 과정이 돋보임. 근거가 주장을 뒷받침하는지 살피며 표현을 다듬어 서론·본론·결론이 분명한 글을 완성함.',
  },
};

const subjectKey = (subject: string) => subject.normalize('NFKC').replace(/\s/g, '').replace(/과$/, '');

export function subjectExampleBlock(subject: string): string {
  const example = examples[subjectKey(subject)];
  if (!example) return '';
  return `[${subjectKey(subject)} 문체 예시 — 구성과 수준별 표현 강도만 참고]
- 아래는 가상의 과제로 쓴 예시다. 이번 평가의 과제·기준과 다르다. 예시의 활동 내용·표현을 학생 평어에 옮기지 않는다.
- 과제: ${example.task}
- 상: ${example.high}
- 중: ${example.middle}
- 하: ${example.low}
- 같은 상 수준을 다른 순서로 쓴 예: ${example.highAlternative}
- 상·중·하의 차이는 평가기준이 가르는 수행 범위와 마무리 표현(돋보임 / 기름 / 익힘)으로 드러난다. 중·하에는 상 수준 수식어와 부족한 점을 쓰지 않았다.`;
}
