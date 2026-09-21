import { describe, expect, it } from 'vitest';
import { consentChoiceConfigError, consentQuestionError, consentQuestions, consentResponseError, setConsentChoice, type ConsentChoice } from '../../supabase/functions/_shared/consentQuestions';
import { cloneFieldsToPage, getConsentFieldLayoutIssues } from '../../src/features/consentForms/consentFieldLayout';
import type { ConsentFieldDraft } from '../../src/features/consentForms/types';

const choice: ConsentChoice = { id: 'q1', label: '동의 여부', mode: 'single', required: true, minSelections: 1 };
const field = (id: string, patch: Partial<ConsentFieldDraft> = {}): ConsentFieldDraft => ({ id, label: id, kind: 'checkbox', required: false, x: 10, y: 10, width: 2, height: 1.4, pageIndex: 0, ...patch });
const options = [field('yes', { choice }), field('no', { choice, x: 20 })];

describe('질문 단위 선택과 공통 서버 검증', () => {
  it.each(['yes', 'no'])('%s 하나만 골라도 필수 질문 완료', id => {
    expect(consentResponseError(options, { [id]: 'true' })).toBeNull();
  });
  it('무응답과 양쪽 선택은 거절', () => {
    expect(consentResponseError(options, {})).toContain('선택해');
    expect(consentResponseError(options, { yes: 'true', no: 'true' })).toContain('하나만');
  });
  it.each(['false', '', undefined])('필수 확인 항목의 %s는 체크가 아님', value => {
    expect(consentResponseError([field('legacy', { required: true })], { legacy: value })).toContain('확인');
  });
  it.each(['yes', '1', true, 1, null, {}, []])('변조한 체크 값 거절: %j', value => {
    expect(consentResponseError(options, { yes: value })).toContain('올바른');
  });
  it('독립 선택 항목은 미체크·false도 제출 가능', () => {
    expect(consentResponseError([field('optional')], {})).toBeNull();
    expect(consentResponseError([field('optional')], { optional: 'false' })).toBeNull();
  });
  it('공백 텍스트는 필수 응답으로 인정하지 않음', () => {
    expect(consentResponseError([field('name', { kind: 'text', required: true })], { name: '   ' })).toContain('입력');
  });
  it('선택 변경 시 동일 질문만 해제하고 다른 응답은 보존', () => {
    expect(setConsentChoice(options, { yes: 'true', memo: '보존' }, 'no', true)).toEqual({ yes: '', no: 'true', memo: '보존' });
  });
  it('복수 선택은 선택 수를 검사하고 다른 체크를 유지', () => {
    const fields = options.map(item => ({ ...item, choice: { ...choice, mode: 'multiple' as const, minSelections: 2 } }));
    expect(consentResponseError(fields, { yes: 'true' })).toContain('2개');
    const values = setConsentChoice(fields, { yes: 'true' }, 'no', true);
    expect(consentResponseError(fields, values)).toBeNull();
  });
  it('선택 질문은 무응답 가능하지만 두 항목 선택은 금지', () => {
    const fields = options.map(item => ({ ...item, choice: { ...choice, required: false } }));
    expect(consentResponseError(fields, {})).toBeNull();
    expect(consentResponseError(fields, { yes: 'true', no: 'true' })).not.toBeNull();
  });
  it('문서 위치순 단계에 같은 질문의 선택지를 묶음', () => {
    const questions = consentQuestions([field('name', { kind: 'text', y: 40 }), ...options.slice().reverse()]);
    expect(questions.map(item => item.label)).toEqual(['동의 여부', 'name']);
    expect(questions[0].fields.map(item => item.id)).toEqual(['yes', 'no']);
    expect(consentQuestionError(questions[0], { no: 'true' })).toBeNull();
  });
  it('작은 체크박스 경계와 선택 설정을 편집기에서도 검사', () => {
    expect(getConsentFieldLayoutIssues(options, 1)).toEqual([]);
    expect(getConsentFieldLayoutIssues([field('tiny', { width: 0.5 })], 1)[0].type).toBe('bounds');
  });
  it('단일 선택지·상이한 설정·중복 이름·필수 개별 체크를 거절', () => {
    expect(consentChoiceConfigError([options[0]])).not.toBeNull();
    expect(consentChoiceConfigError([options[0], { ...options[1], choice: { ...choice, required: false } }])).not.toBeNull();
    expect(consentChoiceConfigError([options[0], { ...options[1], label: 'yes' }])).not.toBeNull();
    expect(consentChoiceConfigError(options.map(item => ({ ...item, required: true })))).not.toBeNull();
  });
  it.each([null, {}, { ...choice, mode: 'invalid' }, { ...choice, minSelections: 0 }, { ...choice, minSelections: 1.5 }, { ...choice, label: '' }])('깨진 JSON 설정 거절: %j', invalid => {
    expect(consentChoiceConfigError([field('a', { choice: invalid as ConsentChoice })])).not.toBeNull();
  });
  it('복사한 질문은 원본과 다른 그룹, 선택지 하나만 복사하면 독립 항목', () => {
    let seq = 0;
    const cloned = cloneFieldsToPage([], options, 1, () => `copy${seq++}`);
    expect(cloned[0].choice?.id).not.toBe(choice.id);
    expect(cloned[0].choice?.id).toBe(cloned[1].choice?.id);
    expect(consentChoiceConfigError(cloned)).toBeNull();
    expect(cloneFieldsToPage([], [options[0]], 1)[0].choice).toBeUndefined();
  });
});
