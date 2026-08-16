import type { ConsentFieldDraft, ConsentFieldKind } from './types';

export const MIN_FIELD_WIDTH = 10;
export const MIN_FIELD_HEIGHT = 4;
export const FIELD_EDGE_PADDING = 1;
export const FIELD_GAP = 1;

const supportedKinds = new Set<ConsentFieldKind>(['text', 'checkbox', 'date', 'signature']);
const finite = (value: number) => Number.isFinite(value);

export interface ConsentFieldLayoutIssue {
  type: 'duplicate-id' | 'kind' | 'label' | 'page' | 'bounds' | 'overlap';
  fieldIds: string[];
  message: string;
}

export const fieldsOverlap = (a: ConsentFieldDraft, b: ConsentFieldDraft, gap = 0) => (
  a.pageIndex === b.pageIndex
  && a.x < b.x + b.width + gap
  && a.x + a.width + gap > b.x
  && a.y < b.y + b.height + gap
  && a.y + a.height + gap > b.y
);

export const getConsentFieldLayoutIssues = (fields: ConsentFieldDraft[], pageCount: number) => {
  const issues: ConsentFieldLayoutIssue[] = [];
  const ids = new Set<string>();

  fields.forEach((field) => {
    if (!field.id || ids.has(field.id)) issues.push({ type: 'duplicate-id', fieldIds: [field.id], message: '중복된 필드가 있습니다.' });
    ids.add(field.id);
    if (!supportedKinds.has(field.kind)) issues.push({ type: 'kind', fieldIds: [field.id], message: '지원하지 않는 필드 종류입니다.' });
    if (!field.label.trim() || field.label.trim().length > 80) issues.push({ type: 'label', fieldIds: [field.id], message: '필드 이름은 1~80자로 입력하세요.' });
    if (!Number.isInteger(field.pageIndex) || field.pageIndex < 0 || field.pageIndex >= pageCount) issues.push({ type: 'page', fieldIds: [field.id], message: '필드가 존재하지 않는 페이지에 있습니다.' });
    if (![field.x, field.y, field.width, field.height].every(finite)
      || field.x < 0 || field.y < 0
      || field.width < MIN_FIELD_WIDTH || field.height < MIN_FIELD_HEIGHT
      || field.x + field.width > 100 || field.y + field.height > 100) {
      issues.push({ type: 'bounds', fieldIds: [field.id], message: '필드가 문서 경계를 벗어났거나 너무 작습니다.' });
    }
  });

  for (let index = 0; index < fields.length; index += 1) {
    for (let candidate = index + 1; candidate < fields.length; candidate += 1) {
      if (fieldsOverlap(fields[index], fields[candidate])) {
        issues.push({ type: 'overlap', fieldIds: [fields[index].id, fields[candidate].id], message: '서로 겹치는 필드가 있습니다.' });
      }
    }
  }
  return issues;
};

export const findAvailableFieldPosition = (
  pageFields: ConsentFieldDraft[],
  size: Pick<ConsentFieldDraft, 'width' | 'height'>,
) => {
  const maxX = Math.max(FIELD_EDGE_PADDING, 100 - FIELD_EDGE_PADDING - size.width);
  const maxY = Math.max(FIELD_EDGE_PADDING, 100 - FIELD_EDGE_PADDING - size.height);
  // size에 x·y가 들어와도 탐색 좌표를 덮어쓰지 않도록 폭·높이만 꺼내 쓴다.
  const { width, height } = size;
  const pageIndex = pageFields[0]?.pageIndex ?? 0;
  for (let y = 12; y <= maxY; y += 2) {
    for (let x = 10; x <= maxX; x += 2) {
      const candidate = { id: '', kind: 'text' as const, label: '', required: false, pageIndex, x, y, width, height };
      if (!pageFields.some((field) => fieldsOverlap(candidate, field, FIELD_GAP))) return { x, y };
    }
  }
  return { x: FIELD_EDGE_PADDING, y: FIELD_EDGE_PADDING };
};

export const resolveConsentFieldOverlaps = (fields: ConsentFieldDraft[], pageIndex: number) => {
  const otherPages = fields.filter((field) => field.pageIndex !== pageIndex);
  const arranged: ConsentFieldDraft[] = [];
  fields.filter((field) => field.pageIndex === pageIndex).forEach((field) => {
    const collides = arranged.some((candidate) => fieldsOverlap(field, candidate));
    arranged.push(collides ? { ...field, ...findAvailableFieldPosition(arranged, field) } : field);
  });
  return [...otherPages, ...arranged].sort((a, b) => a.pageIndex - b.pageIndex);
};

export const pageAspectRatio = (width?: number, height?: number) => (
  finite(width ?? 0) && finite(height ?? 0) && (width ?? 0) > 0 && (height ?? 0) > 0
    ? (width as number) / (height as number)
    : 210 / 297
);

/**
 * 필드의 정규화 좌표를 화면 배치용 CSS 퍼센트로 바꾼다.
 * 편집기·공개 응답 화면·응답 합성이 모두 이 변환을 공유해야
 * "배치한 위치 = 응답한 위치 = 출력된 위치"가 유지된다.
 */
export const fieldStyle = (field: ConsentFieldDraft) => ({
  left: `${field.x}%`,
  top: `${field.y}%`,
  width: `${field.width}%`,
  height: `${field.height}%`,
});

/** 같은 변환을 실제 페이지 크기(픽셀·포인트) 기준으로 계산한다. */
export const fieldRect = (field: ConsentFieldDraft, pageWidth: number, pageHeight: number) => ({
  left: (field.x / 100) * pageWidth,
  top: (field.y / 100) * pageHeight,
  width: (field.width / 100) * pageWidth,
  height: (field.height / 100) * pageHeight,
});

/** 붙여넣기·복제용. 새 id를 부여하고 대상 쪽의 빈 자리에 놓는다. */
export const cloneFieldsToPage = (
  pageFields: ConsentFieldDraft[],
  sources: ConsentFieldDraft[],
  pageIndex: number,
  newId: () => string = () => crypto.randomUUID(),
) => {
  const placed = [...pageFields];
  return sources.map((source) => {
    const position = findAvailableFieldPosition(placed, source);
    const clone = { ...source, id: newId(), pageIndex, ...position };
    placed.push(clone);
    return clone;
  });
};

export const SNAP_THRESHOLD = 0.8;

const edgesX = (field: Pick<ConsentFieldDraft, 'x' | 'width'>) => [field.x, field.x + field.width / 2, field.x + field.width];
const edgesY = (field: Pick<ConsentFieldDraft, 'y' | 'height'>) => [field.y, field.y + field.height / 2, field.y + field.height];

const snapAxis = (start: number, size: number, targets: number[], threshold: number) => {
  const offsets = [0, size / 2, size];
  let best: { value: number; distance: number } | null = null;
  targets.forEach((target) => {
    offsets.forEach((offset) => {
      const candidate = target - offset;
      const distance = Math.abs(candidate - start);
      if (distance <= threshold && (!best || distance < best.distance)) best = { value: candidate, distance };
    });
  });
  return best ? (best as { value: number }).value : start;
};

/** 끌고 있는 필드를 같은 쪽의 다른 필드와 쪽 중앙·가장자리에 붙인다. */
export const snapFieldPosition = (
  moving: Pick<ConsentFieldDraft, 'width' | 'height'>,
  others: ConsentFieldDraft[],
  x: number,
  y: number,
  threshold = SNAP_THRESHOLD,
) => ({
  x: snapAxis(x, moving.width, [0, 50, 100, ...others.flatMap(edgesX)], threshold),
  y: snapAxis(y, moving.height, [0, 50, 100, ...others.flatMap(edgesY)], threshold),
});

/** 실제로 맞춰진 선만 그린다. 끌고 있는 동안 어디에 정렬됐는지 보여주기 위함이다. */
export const alignmentGuides = (field: ConsentFieldDraft, others: ConsentFieldDraft[], tolerance = 0.05) => {
  const matches = (values: number[], targets: number[]) => targets
    .filter((target) => values.some((value) => Math.abs(value - target) <= tolerance))
    .filter((target, index, all) => all.indexOf(target) === index);
  return {
    vertical: matches(edgesX(field), [0, 50, 100, ...others.flatMap(edgesX)]),
    horizontal: matches(edgesY(field), [0, 50, 100, ...others.flatMap(edgesY)]),
  };
};
