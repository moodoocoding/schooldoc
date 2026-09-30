/**
 * 교사가 명시적으로 선택한 사용 목적 문구를 적용한다.
 * 구매 품목·상호로 실제 교육활동 목적을 추측하거나 회계 규정 준수를 보장하지 않는다.
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
