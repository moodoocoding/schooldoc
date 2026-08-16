import { describe, expect, it } from 'vitest';
import { alignmentGuides, cloneFieldsToPage, fieldsOverlap, findAvailableFieldPosition, getConsentFieldLayoutIssues, pageAspectRatio, resolveConsentFieldOverlaps, snapFieldPosition } from '../../src/features/consentForms/consentFieldLayout';
import type { ConsentFieldDraft } from '../../src/features/consentForms/types';

const field = (id: string, x: number, y: number): ConsentFieldDraft => ({
  id, kind: 'text', label: id, required: true, pageIndex: 0, x, y, width: 30, height: 7,
});

describe('consent field layout', () => {
  it('detects overlapping fields and resolves them inside the page', () => {
    const fields = [field('first', 10, 12), field('second', 20, 14)];
    expect(getConsentFieldLayoutIssues(fields, 1).some((issue) => issue.type === 'overlap')).toBe(true);
    const resolved = resolveConsentFieldOverlaps(fields, 0);
    expect(fieldsOverlap(resolved[0], resolved[1])).toBe(false);
    expect(getConsentFieldLayoutIssues(resolved, 1)).toHaveLength(0);
  });

  it('finds an unused default position', () => {
    const existing = field('first', 10, 12);
    const position = findAvailableFieldPosition([existing], { width: 18, height: 6 });
    expect(fieldsOverlap(existing, { ...field('next', position.x, position.y), width: 18, height: 6 })).toBe(false);
  });

  it('uses the real PDF page ratio and keeps an A4 fallback', () => {
    expect(pageAspectRatio(842, 595)).toBeCloseTo(842 / 595);
    expect(pageAspectRatio()).toBeCloseTo(210 / 297);
  });

  it('복제한 필드는 새 id로 대상 쪽 빈 자리에 놓인다', () => {
    const original = field('first', 10, 12);
    let serial = 0;
    const clones = cloneFieldsToPage([original], [original], 0, () => `copy-${serial += 1}`);

    expect(clones).toHaveLength(1);
    expect(clones[0].id).toBe('copy-1');
    expect(clones[0].label).toBe(original.label);
    expect(fieldsOverlap(original, clones[0])).toBe(false);
  });

  it('여러 개를 붙여넣어도 서로 겹치지 않는다', () => {
    const sources = [field('a', 10, 12), field('b', 10, 30)];
    let serial = 0;
    const clones = cloneFieldsToPage([], sources, 2, () => `copy-${serial += 1}`);

    expect(clones.every((clone) => clone.pageIndex === 2)).toBe(true);
    expect(getConsentFieldLayoutIssues(clones, 3)).toHaveLength(0);
  });

  it('가까운 필드의 모서리에 붙고 멀면 그대로 둔다', () => {
    const anchor = field('anchor', 20, 40);
    expect(snapFieldPosition(anchor, [anchor], 20.5, 40.4).x).toBe(20);
    expect(snapFieldPosition(anchor, [anchor], 20.5, 40.4).y).toBe(40);
    expect(snapFieldPosition(anchor, [anchor], 60, 80).x).toBe(60);
  });

  it('쪽 중앙에도 붙는다', () => {
    const moving = { width: 30, height: 8 };
    expect(snapFieldPosition(moving, [], 35.2, 10).x).toBe(35);
  });

  it('실제로 맞춰진 선만 보조선으로 돌려준다', () => {
    const anchor = field('anchor', 20, 40);
    const aligned = field('aligned', 20, 70);
    const guides = alignmentGuides(aligned, [anchor]);

    expect(guides.vertical).toContain(20);
    expect(guides.horizontal).toEqual([]);
  });
});
