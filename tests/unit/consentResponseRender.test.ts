import { describe, expect, it } from 'vitest';
import { fieldRect } from '../../src/features/consentForms/consentFieldLayout';
import { consentResponseFileName, consentResponsesFileName, fitTextLines, formatConsentValue } from '../../src/features/consentForms/consentResponseRender';
import type { ConsentFieldDraft } from '../../src/features/consentForms/types';

/** 글자 하나를 글꼴 크기의 절반 너비로 계산하는 단순 측정기. */
const measure = (text: string, fontSize: number) => text.length * fontSize * 0.5;

const field = (patch: Partial<ConsentFieldDraft> = {}): ConsentFieldDraft => ({
  id: 'field', kind: 'text', label: '참가 의견', required: true,
  pageIndex: 0, x: 10, y: 20, width: 30, height: 10, ...patch,
});

describe('consent response render', () => {
  it('배치 좌표를 페이지 크기에 비례해 옮긴다', () => {
    const rect = fieldRect(field(), 600, 800);
    expect(rect).toEqual({ left: 60, top: 160, width: 180, height: 80 });
  });

  it('페이지 크기가 달라져도 필드의 상대 위치는 같다', () => {
    const small = fieldRect(field(), 600, 800);
    const large = fieldRect(field(), 1200, 1600);
    expect(large.left / large.width).toBeCloseTo(small.left / small.width);
    expect(large.top / large.height).toBeCloseTo(small.top / small.height);
  });

  it('긴 글은 필드 안에 들어가도록 줄바꿈하고 글꼴을 줄인다', () => {
    const { fontSize, lines } = fitTextLines(measure, '보호자 확인 후 참가에 동의합니다', 100, 40, 20);
    expect(lines.length).toBeGreaterThan(1);
    expect(fontSize).toBeLessThan(20);
    lines.forEach((line) => expect(measure(line, fontSize)).toBeLessThanOrEqual(100));
    expect(lines.length * fontSize * 1.25).toBeLessThanOrEqual(40);
    expect(lines.join('')).toBe('보호자 확인 후 참가에 동의합니다');
  });

  it('짧은 글은 한 줄로 두고 글꼴을 줄이지 않는다', () => {
    const { lines, fontSize } = fitTextLines(measure, '예', 100, 40, 20);
    expect(lines).toEqual(['예']);
    expect(fontSize).toBe(20);
  });

  it('날짜 값만 읽기 쉬운 형식으로 바꾼다', () => {
    expect(formatConsentValue(field({ kind: 'date' }), '2026-08-16')).toBe('2026. 8. 16.');
    expect(formatConsentValue(field({ kind: 'date' }), '미정')).toBe('미정');
    expect(formatConsentValue(field(), '2026-08-16')).toBe('2026-08-16');
  });

  it('파일 이름에서 경로 문자를 제거한다', () => {
    expect(consentResponseFileName('현장체험학습 동의서', 3)).toBe('현장체험학습 동의서_응답003.pdf');
    expect(consentResponseFileName('1/2학기: 안내', 1)).toBe('1_2학기_ 안내_응답001.pdf');
    expect(consentResponseFileName('   ', 1)).toBe('가정통신문_응답001.pdf');
  });

  it('전체 모음 파일 이름에 건수를 적는다', () => {
    expect(consentResponsesFileName('현장체험학습 동의서', 12)).toBe('현장체험학습 동의서_응답모음_12건.pdf');
    expect(consentResponsesFileName('1/2학기: 안내', 3)).toBe('1_2학기_ 안내_응답모음_3건.pdf');
  });
});
