import type { EventData } from '../types';

export const INITIAL_EVENTS: EventData[] = [
  {
    id: 'evt-tpo-clothing-2026',
    title: '5학년 실과 - 상황(TPO)에 맞는 옷차림 디자인 수행평가',
    createdAt: '2026-07-20T10:00:00Z',
    criteria: [
      { name: '상황 이해도 (TPO)', maxScore: 10, desc: '시간(T), 장소(P), 상황(O)에 적절한 옷의 기능과 예절을 바르게 적용했는지 평가합니다.' },
      { name: '디자인 창의성', maxScore: 10, desc: '개성을 살리면서도 안전과 활동성을 고려하여 독창적으로 디자인했는지 평가합니다.' },
      { name: '설명 및 표현력', maxScore: 10, desc: '선택한 옷차림의 특징과 디자인 의도를 명확하게 서술하고 표현했는지 평가합니다.' },
      { name: '수업 참여도', maxScore: 5, desc: '모둠 스티커 활동에 적극적으로 참여하고, 타인의 디자인 발표를 경청했는지 평가합니다.' }
    ],
    students: [
      {
        id: '50101',
        name: '강민준',
        accessCode: '1042',
        scores: { '상황 이해도 (TPO)': 10, '디자인 창의성': 9, '설명 및 표현력': 8, '수업 참여도': 5 },
        feedback: '민준이는 운동 경기 상황에 적절한 통풍성과 보온성을 갖춘 스포츠웨어를 아주 멋지게 디자인했습니다. 설명글도 구조적으로 잘 작성했습니다.',
        status: 'confirmed',
        updatedAt: '2026-07-24T14:22:00Z'
      },
      {
        id: '50102',
        name: '김서연',
        accessCode: '2981',
        scores: { '상황 이해도 (TPO)': 9, '디자인 창의성': 10, '설명 및 표현력': 10, '수업 참여도': 5 },
        feedback: '비오는 날 등하교 상황에 맞추어 빛반사 방수 우비와 안전 장화를 매우 창의적으로 구상했습니다. 드로잉 표현력이 탁월합니다.',
        status: 'confirmed',
        updatedAt: '2026-07-25T09:15:00Z'
      },
      {
        id: '50103',
        name: '박지우',
        accessCode: '4753',
        scores: { '상황 이해도 (TPO)': 6, '디자인 창의성': 7, '설명 및 표현력': 6, '수업 참여도': 4 },
        feedback: '결혼식 참석 상황인데 지나치게 스포티한 운동복을 디자인하여 TPO 목적에 맞지 않는 부분이 다소 아쉽습니다. 다음 실습 시 보완해보세요.',
        status: 'disputed',
        disputeMessage: '선생님, 제가 결혼식이 끝난 후 야외 피크닉을 가는 가상의 컨셉을 설정하고 기능성 운동복을 매칭했던 건데 혹시 이 점이 감점 요인이 된 걸까요?',
        updatedAt: '2026-07-25T11:40:00Z'
      },
      {
        id: '50104',
        name: '이도현',
        accessCode: '8392',
        scores: { '상황 이해도 (TPO)': 8, '디자인 창의성': 8, '설명 및 표현력': 9, '수업 참여도': 5 },
        feedback: '전통 제사 상황에 알맞은 예의 있고 단정한 개량 한복 디자인을 꼼꼼하게 완성했습니다. 모둠 내 스티커 피드백 활동에서도 적극적이었습니다.',
        status: 'viewed',
        updatedAt: '2026-07-25T13:02:00Z'
      },
      {
        id: '50105',
        name: '최예원',
        accessCode: '5201',
        scores: { '상황 이해도 (TPO)': 10, '디자인 창의성': 10, '설명 및 표현력': 9, '수업 참여도': 5 },
        feedback: '여름철 캠핑 상황에 맞게 해충 방지 기능성 소매와 자외선 차단 모자를 일체화하여 매우 실용적이고 예쁜 디자인을 선보였습니다. 참 잘했습니다.',
        status: 'unviewed'
      },
      {
        id: '50106',
        name: '한우진',
        accessCode: '9148',
        scores: { '상황 이해도 (TPO)': 5, '디자인 창의성': 6, '설명 및 표현력': 5, '수업 참여도': 3 },
        feedback: '시간 및 장소에 대한 고려가 미흡하고 디자인 스케치가 완성되지 못한 채 제출되었습니다. 다음에는 보완할 수 있도록 분발해 봅시다.',
        status: 'unviewed'
      }
    ]
  },
  {
    id: 'evt-english-speaking-2026',
    title: '5학년 영어 - 나의 취미 소개하기(My Hobby) 말하기 수행평가',
    createdAt: '2026-07-18T11:30:00Z',
    criteria: [
      { name: '발음 및 어조', maxScore: 10, desc: '영어 음소를 바르게 발음하고 자연스러운 억양과 강세를 넣어 말하는지 평가합니다.' },
      { name: '표현 및 어휘력', maxScore: 10, desc: '취미 활동 소개(like -ing, good at 등) 핵심 단어와 어법을 바르게 활용하는가.' },
      { name: '유창성 및 전달력', maxScore: 10, desc: '적절한 속도로 머뭇거림 없이 청중에게 내용이 효과적으로 도달하도록 말하는가.' },
      { name: '발표 태도', maxScore: 5, desc: '아이컨택, 정중한 자세, 목소리 크기 등 전반적인 발표 매너를 평가합니다.' }
    ],
    students: [
      {
        id: '50101',
        name: '강민준',
        accessCode: '1042',
        scores: { '발음 및 어조': 8, '표현 및 어휘력': 9, '유창성 및 전달력': 8, '발표 태도': 4 },
        feedback: '축구 동영상 편집 취미를 아주 조리 있게 설명했습니다. 단어 강세에 조금 더 유의하면 좋겠습니다.',
        status: 'confirmed',
        updatedAt: '2026-07-23T16:10:00Z'
      },
      {
        id: '50102',
        name: '김서연',
        accessCode: '2981',
        scores: { '발음 및 어조': 10, '표현 및 어휘력': 10, '유창성 및 전달력': 10, '발표 태도': 5 },
        feedback: '자연스러운 제스처와 함께 완벽한 억양으로 요리하기 취미를 말했습니다. 전달력이 뛰어난 최고 수준의 발표였습니다.',
        status: 'unviewed'
      },
      {
        id: '50104',
        name: '이도현',
        accessCode: '8392',
        scores: { '발음 및 어조': 7, '표현 및 어휘력': 8, '유창성 및 전달력': 7, '발표 태도': 4 },
        feedback: '블록 조립하기 취미를 정성껏 준비하여 성실히 끝마쳤습니다. 말하기 속도를 조절하는 연습을 해봅시다.',
        status: 'viewed',
        updatedAt: '2026-07-25T10:05:00Z'
      }
    ]
  }
];

const LOCAL_STORAGE_KEY = 'safelookup_events';

export const loadEvents = (): EventData[] => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_EVENTS));
    return INITIAL_EVENTS;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Error parsing localStorage events', e);
    return INITIAL_EVENTS;
  }
};

export const saveEvents = (events: EventData[]): void => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events));
};
