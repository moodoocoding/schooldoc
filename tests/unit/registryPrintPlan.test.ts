import { describe, expect, test } from 'vitest';
import { registryPrintPlan, wrapRegistryText } from '../../supabase/functions/_shared/registryPrintLayout';
import { parsePastedRows } from '../../src/features/registry/registryUtils';

const fixture = { layout: 20 as const, title: '등록부', leftHeader: '일시', rightHeader: '장소', columns: [{ id: 'school', label: '소속' }], participants: [{ name: '가상교사', values: { school: '가상학교' } }] };

describe('잘림 없이 A4 한도 안에 출력한다', () => {
  test('한글·영문·이모지·줄바꿈을 버리지 않는다', () => {
    const paragraphs = ['아주 긴 가상 학교 이름'.repeat(15), 'ABC123🙂'.repeat(30), '마지막 값'];
    for (const text of paragraphs) expect(wrapRegistryText(text, 40, 9.5).join('')).toBe(text);
    expect(wrapRegistryText('첫 줄\n둘째 줄', 400, 9.5)).toEqual(['첫 줄', '둘째 줄']);
  });
  test('두 단 네 입력 열을 한 단으로 전환하고 너비 합을 유지한다', () => {
    const plan = registryPrintPlan({ ...fixture, columns: Array.from({ length: 4 }, (_, i) => ({ id: String(i), label: `입력 ${i}` })) });
    expect(plan.valid).toBe(true);
    expect(plan.tableColumns).toBe(1);
    expect(plan.adjusted).toBe(true);
    expect(plan.widths.number + plan.widths.name + plan.widths.signature + plan.widths.fields.reduce((a,b)=>a+b,0)).toBeCloseTo(plan.tableWidth);
  });
  test('긴 셀은 행 수를 줄이고 마지막 행까지 높이를 확보한다', () => {
    const plan = registryPrintPlan({ ...fixture, participants: [{ name: '가상교사', values: { school: '긴소속정보'.repeat(30) } }] });
    expect(plan.valid).toBe(true);
    expect(plan.rowsPerColumn).toBeLessThan(10);
    const lines = wrapRegistryText('긴소속정보'.repeat(30), plan.widths.fields[0]-8, plan.size);
    expect(plan.rowHeight).toBeGreaterThanOrEqual(lines.length*(plan.size+3)+8);
    expect(plan.headerHeight + plan.rowHeight*plan.rowsPerColumn).toBeCloseTo(plan.tableTop-62);
  });
  test('A4에 들어가지 않는 제목은 명확히 실패하고 Infinity를 만들지 않는다', () => {
    const plan = registryPrintPlan({ ...fixture, title: '너무긴제목'.repeat(400) });
    expect(plan.valid).toBe(false);
    expect(Number.isFinite(plan.rowHeight)).toBe(true);
  });
  test('붙여넣기 헤더를 제거하고 빈 중간 셀의 위치를 보존한다', () => {
    const rows = parsePastedRows('성명\t소속\t직위\n가상교사\t\t담임', [{ id:'school',label:'소속' },{ id:'role',label:'직위' }]);
    expect(rows).toEqual([{ name: '가상교사', values: { school:'',role:'담임' } }]);
  });
});
