import { describe, expect, test } from 'vitest';
import { hasBatchim } from '../../src/features/specialRooms/BookingSheet';

/**
 * "이미 '6-1반'이 잡혀 있습니다"처럼 `이/가` 조사를 자연스럽게 고른다.
 *
 * 남의 예약을 덮기 전에 확인창을 띄우기로 하면서, 라벨을 그대로 문장에 끼워 넣게 됐다.
 * 조사를 하나로 고정하면 절반은 어색해진다.
 */
describe('받침 유무로 이/가를 고른다', () => {
  test('받침 있는 글자로 끝나면 이', () => {
    expect(hasBatchim('6-1반')).toBe(true);
    expect(hasBatchim('미술실')).toBe(true);
    expect(hasBatchim('체육관')).toBe(true);
  });

  test('받침 없는 글자로 끝나면 가', () => {
    expect(hasBatchim('방과후')).toBe(false);
    expect(hasBatchim('연수 3부')).toBe(false);
  });

  test('앞뒤 공백은 무시하고 마지막 글자를 본다', () => {
    expect(hasBatchim('6-1반  ')).toBe(true);
    expect(hasBatchim('  방과후')).toBe(false);
  });

  test('한글이 아닌 글자로 끝나면 받침이 있는 쪽으로 본다', () => {
    // `6-1반`처럼 학교에서 흔한 이름은 받침 있는 글자로 끝나는 경우가 많다.
    expect(hasBatchim('3')).toBe(true);
    expect(hasBatchim('')).toBe(true);
  });
});
