/**
 * 학급 운영비 영수증 에듀파인 개산급 정산용 적요(사용목적) 생성 및 프리셋 유틸리티
 * 
 * 인디스쿨, 교육청 학교회계 지침, 실제 초등 교사 개산급 정산 실무를 바탕으로
 * 행정실과 감사에서 규정 준수로 인정받는 5대 표준 교육활동 적요를 제공합니다.
 */

export interface BudgetPurposePreset {
  key: string;
  label: string;
  defaultText: string;
  formatWithItems: (items: string) => string;
}

export const BUDGET_PURPOSE_PRESETS: BudgetPurposePreset[] = [
  {
    key: 'class-event',
    label: '학급 행사 간식',
    defaultText: '학급 자치행사 다과 구입',
    formatWithItems: (items) => `학급 자치행사 다과 구입 (${items})`,
  },
  {
    key: 'student-reward',
    label: '칭찬 보상 물품',
    defaultText: '학생 칭찬 보상 및 생활지도 물품 구입',
    formatWithItems: (items) => `학생 칭찬 보상 및 생활지도 물품 구입 (${items})`,
  },
  {
    key: 'environment',
    label: '교실 환경 정비',
    defaultText: '교실 환경 구성 및 학급 게시판 정비용품 구입',
    formatWithItems: (items) => `교실 환경 구성 및 학급 게시판 정비용품 구입 (${items})`,
  },
  {
    key: 'fellowship',
    label: '학급 친교 활동',
    defaultText: '학급 친교 및 자율활동 물품 구입',
    formatWithItems: (items) => `학급 친교 및 자율활동 물품 구입 (${items})`,
  },
  {
    key: 'special-activity',
    label: '학급 특색 활동',
    defaultText: '학급 특색 교육활동 소모품 구입',
    formatWithItems: (items) => `학급 특색 교육활동 소모품 구입 (${items})`,
  },
];

// 키워드 사전
const SPECIAL_ACTIVITY_KEYWORDS = [
  '만들기', '키트', 'diy', '클레이', '폼클레이', '비즈', '모자이크', '스크래치북',
  '문집', '제본', '사진인화', '앨범', '도자기', '염색', '원예',
];

const FELLOWSHIP_KEYWORDS = [
  '보드게임', '할리갈리', '루미큐브', '젠가', '부루마블', '다빈치코드', '체스',
  '장기', '바둑', '카드게임', '실내놀이', '놀이', '전래놀이', '제기', '공기',
];

const ENVIRONMENT_KEYWORDS = [
  '환경', '게시판', '보더', '자석', '자석홀더', '이름표', '네임스티커', '라벨',
  '바구니', '수납', '정리함', '보관함', '화분', '물티슈', '휴지', '청소', '밀대',
  '시계', '온도계', '습도계', '분리수거', '손소독제', '핸드워시', '비누',
];

const REWARD_KEYWORDS = [
  '칭찬', '도장', '뽑기', '달란트', '쿠폰', '보상', '상장', '메달',
  '키링', '배지', '문구세트', '지우개세트', '칭찬스티커', '스티커판',
];

const FOOD_KEYWORDS = [
  '젤리', '캔디', '사탕', '과자', '간식', '음료', '주스', '커피', '생수', '빵',
  '다과', '식품', '음료수', '우유', '과일', '케이크', '초콜릿', '쿠키', '비스킷',
  '하리보', '멘토스', '이클립스', '설레임', '골드베렌', '마이쮸', '새콤달콤',
  '초코파이', '오예스', '몽쉘', '카스타드', '피자', '치킨', '도넛', '아이스크림',
];

const FOOD_MERCHANTS = [
  '마트', '슈퍼', '마켓', '베이커리', '제과', '파리바게뜨', '뚜레쥬르', '배스킨',
  '카페', '커피', '메가커피', '컴포즈', '피자', '치킨',
];

const STATIONERY_MERCHANTS = [
  '알파', '드림디포', '모닝글로리', '오피스디포', '문구', '화방', '문방구',
];

/**
 * 품목명이나 상호명에서 가장 적합한 프리셋 키를 추천합니다.
 */
export function recommendPresetKey(description = '', merchant = ''): string {
  const normDesc = description.toLowerCase().trim();
  const normMerchant = merchant.toLowerCase().trim();

  if (normDesc) {
    // 1. 학급 특색/만들기 활동 (키트, 만들기, 문집 등) 우선
    if (SPECIAL_ACTIVITY_KEYWORDS.some((kw) => normDesc.includes(kw))) {
      return 'special-activity';
    }
    // 2. 학급 친교 놀이 (보드게임 등)
    if (FELLOWSHIP_KEYWORDS.some((kw) => normDesc.includes(kw))) {
      return 'fellowship';
    }
    // 3. 교실 환경/게시판/이름표/청소
    if (ENVIRONMENT_KEYWORDS.some((kw) => normDesc.includes(kw))) {
      return 'environment';
    }
    // 4. 학생 칭찬 보상
    if (REWARD_KEYWORDS.some((kw) => normDesc.includes(kw)) || /스티커/.test(normDesc)) {
      return 'student-reward';
    }
    // 5. 학급 행사 간식/다과
    if (FOOD_KEYWORDS.some((kw) => normDesc.includes(kw))) {
      return 'class-event';
    }
  }

  // 상호명 기반 폴백
  if (FOOD_MERCHANTS.some((m) => normMerchant.includes(m))) {
    return 'class-event';
  }
  if (STATIONERY_MERCHANTS.some((m) => normMerchant.includes(m))) {
    return 'environment';
  }
  if (/다이소|daiso/i.test(normMerchant)) {
    return 'environment';
  }

  return 'class-event';
}

/**
 * AI 추출 품목명과 상호명을 기반으로 에듀파인 제출용 사용 목적(적요) 초안을 생성합니다.
 * 예: "학급 자치행사 다과 구입 (하리보 골드베렌 1kg)"
 */
export function suggestReceiptPurpose(description = '', merchant = ''): string {
  const cleanDesc = description.trim();
  const cleanMerchant = merchant.trim();

  if (!cleanDesc && !cleanMerchant) {
    return '';
  }

  const presetKey = recommendPresetKey(cleanDesc, cleanMerchant);
  const preset = BUDGET_PURPOSE_PRESETS.find((p) => p.key === presetKey) ?? BUDGET_PURPOSE_PRESETS[0];

  if (cleanDesc) {
    return preset.formatWithItems(cleanDesc);
  }

  return `${preset.defaultText} (${cleanMerchant})`;
}

/**
 * 현재 입력된 사용 목적 텍스트에서 품목 내용(괄호 안 등)을 추출하여 새 프리셋으로 자연스럽게 교체합니다.
 */
export function applyPurposePreset(currentPurpose: string, presetKey: string, fallbackItems = ''): string {
  const preset = BUDGET_PURPOSE_PRESETS.find((p) => p.key === presetKey);
  if (!preset) return currentPurpose;

  const trimmed = currentPurpose.trim();

  // 기존 텍스트에서 괄호 안의 품목명 추출 시도 e.g. "... (하리보, 초코파이)"
  const bracketMatch = trimmed.match(/\(([^)]+)\)\s*$/);
  const existingItems = bracketMatch ? bracketMatch[1].trim() : '';

  const items = existingItems || fallbackItems.trim();

  if (items) {
    return preset.formatWithItems(items);
  }

  return preset.defaultText;
}
