import { describe, expect, test } from 'vitest';
import { checkOfficialDocument, countSentences, koreanAmount, needsKoreanAmount, normalizeDates, officialAmount, pageVolumeIssues } from '../../src/features/officialDocument/lint';
import { item, note, type OfficialDocument } from '../../src/features/officialDocument/model';

// 가상 문장으로 표기 규칙만 확인한다. 기대값은 편람 예시와 korean-report-hwpx 테스트 사례를 따른다.
const doc = (body: OfficialDocument['body'], title = '가상 계획'): OfficialDocument => ({ kind: 'attachment-plan', title, body });

describe('표기 규칙', () => {
  test('날짜는 2026. 11. 13. 꼴로 고치고 0을 쓰지 않는다(편람 49쪽)', () => {
    expect(normalizeDates('2026-11-13 운영')).toBe('2026. 11. 13. 운영');
    expect(normalizeDates('2021.12.12. 시행')).toBe('2021. 12. 12. 시행');
    expect(normalizeDates('1985. 09. 06.(금)')).toBe('1985. 9. 6.(금)');
    expect(normalizeDates('2026. 11. 2일')).toBe('2026. 11. 2일');
    expect(normalizeDates('2026. 11. 13.(금) 09:00')).toBe('2026. 11. 13.(금) 09:00');
  });
  test('금액은 한글을 병기한다(시행규칙 제2조②)', () => {
    expect(koreanAmount(113560)).toBe('일십일만삼천오백육십');
    expect(koreanAmount(200000)).toBe('이십만');
    expect(koreanAmount(1200000)).toBe('일백이십만');
    expect(koreanAmount(100000000)).toBe('일억');
    expect(koreanAmount(0)).toBe('영');
    expect(officialAmount(113560)).toBe('금113,560원(금일십일만삼천오백육십원)');
    expect(needsKoreanAmount('예산 300,000원 이내')).toBe(true);
    expect(needsKoreanAmount(`예산 ${officialAmount(300000)} 이내`)).toBe(false);
    expect(needsKoreanAmount('단가 100원')).toBe(false);
  });
  test('문장 수는 날짜·소수·약어의 온점을 세지 않는다', () => {
    expect(countSentences('2026. 11. 3.(화)까지 3.5% 높임.')).toBe(1);
    expect(countSentences('현황을 점검함. 개선안을 마련함.')).toBe(2);
  });
});

describe('문서 점검', () => {
  test('본문 앞 기호·번호를 지우고, 날짜와 구분한다', () => {
    const { document, issues } = checkOfficialDocument(doc([item('목적', [item('□ 연수를 운영한다.'), item('1. 사례를 나눈다.'), item('11. 2.부터 운영한다.'), item('○○부 자료를 참고한다.')])]));
    const children = document.body[0].kind === 'item' ? document.body[0].children!.map(c => c.kind !== 'table' && c.text) : [];
    expect(children).toEqual(['연수를 운영한다.', '사례를 나눈다.', '11. 2.부터 운영한다.', '○○부 자료를 참고한다.']);
    expect(issues.filter(i => i.fixed)).toHaveLength(2);
  });
  test('편람 번호 문서는 서술형 문장을 허용하고, 개조식(4단계 이상)은 명사형·두괄식 한 문장을 점검한다', () => {
    expect(checkOfficialDocument(doc([item('목적', [item('연수를 운영한다.')])])).issues).toEqual([]);
    const deep = doc([item('현황을 점검함. 개선안을 마련함.', [item('연수를 운영한다.', [item('세부', [item('참고')])])])]);
    expect(checkOfficialDocument(deep).issues.map(i => [i.where, i.message.split(/[(:]/)[0]])).toEqual([['본문 1', '□ 항목은 두괄식 한 문장으로 씁니다'], ['본문 1 > 1', '개조식은 명사형으로 끝냅니다']]);
  });
  test('긴 제목·빈 내용·24시각제·금액 병기를 알린다', () => {
    const { issues } = checkOfficialDocument(doc([item('운영', [item(' '), note('오후 3시 20분에 시작하며 예산은 300,000원이다.')])], '가'.repeat(41)));
    expect(issues.map(i => [i.where, i.fixed])).toEqual([['제목', false], ['본문 1 > 1', false], ['본문 1 > 2', false], ['본문 1 > 2', false]]);
  });
});

describe('분량 점검', () => {
  test('본문(강제 쪽 나눔 전) 마지막 쪽이 80%보다 덜 차면 알린다', () => {
    expect(pageVolumeIssues({ fills: [0.46, 0.58], bodyPages: 1 })).toEqual([expect.objectContaining({ where: '1쪽', fixed: false })]);
    expect(pageVolumeIssues({ fills: [0.95, 0.3], bodyPages: 1 })).toEqual([]);
    expect(pageVolumeIssues({ fills: [1, 0.5], bodyPages: 2 })[0].message).toContain('약 50%');
    expect(pageVolumeIssues(undefined)).toEqual([]);
  });
});
