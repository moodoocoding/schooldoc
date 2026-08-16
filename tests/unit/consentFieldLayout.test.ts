import { describe, expect, it } from 'vitest';
import { fieldsOverlap, findAvailableFieldPosition, getConsentFieldLayoutIssues, pageAspectRatio, resolveConsentFieldOverlaps } from '../../src/features/consentForms/consentFieldLayout';
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
});
