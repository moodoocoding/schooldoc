import { describe, expect, test } from 'vitest';
import { insertRowAfter, isRowAddKey } from '../../src/utils/rowEntry';

/**
 * 목록 칸의 엔터는 폼을 보내지 않고 줄을 더한다.
 *
 * 특별실 이름을 적다 무심코 엔터를 치면 `예약판 만들기`가 실행됐다. 학생 결과 화면도
 * 같았다. HTML 폼의 기본 동작이라 화면마다 되풀이되므로 규칙을 여기 한 곳에 둔다.
 */
const key = (overrides: Record<string, unknown> = {}) => ({
  key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false,
  nativeEvent: { isComposing: false },
  ...overrides,
});

describe('줄을 더하는 엔터를 가른다', () => {
  test('맨 엔터는 줄을 더한다', () => {
    expect(isRowAddKey(key())).toBe(true);
  });

  test('한글 조합 중에 누른 엔터는 글자를 확정하는 것이다', () => {
    // `과학실`의 마지막 글자를 확정하려고 누른 엔터에 줄이 생기면 안 된다.
    expect(isRowAddKey(key({ nativeEvent: { isComposing: true } }))).toBe(false);
    // React를 거치지 않고 원본 이벤트를 그대로 넘기는 경우도 본다.
    expect(isRowAddKey({ key: 'Enter', isComposing: true })).toBe(false);
  });

  test('보조키가 눌린 엔터는 다른 뜻이다', () => {
    for (const modifier of ['shiftKey', 'ctrlKey', 'metaKey', 'altKey']) {
      expect(isRowAddKey(key({ [modifier]: true })), modifier).toBe(false);
    }
  });

  test('엔터가 아닌 키는 그냥 둔다', () => {
    expect(isRowAddKey(key({ key: 'Tab' }))).toBe(false);
    expect(isRowAddKey(key({ key: 'a' }))).toBe(false);
  });

  test('조합 여부를 알 수 없으면 조합이 아닌 것으로 본다', () => {
    expect(isRowAddKey({ key: 'Enter' })).toBe(true);
  });
});

describe('누른 줄 바로 뒤에 끼운다', () => {
  const empty = () => 'new';

  test('가운데 줄에서 누르면 그 다음 자리에 들어간다', () => {
    // 맨 끝에 붙이면 적던 자리에서 멀어져 이어 적을 수 없다.
    expect(insertRowAfter(['a', 'b', 'c'], 0, empty)).toEqual(['a', 'new', 'b', 'c']);
    expect(insertRowAfter(['a', 'b', 'c'], 1, empty)).toEqual(['a', 'b', 'new', 'c']);
  });

  test('마지막 줄에서 누르면 끝에 붙는다', () => {
    expect(insertRowAfter(['a', 'b'], 1, empty)).toEqual(['a', 'b', 'new']);
  });

  test('범위를 벗어난 자리도 목록을 망가뜨리지 않는다', () => {
    expect(insertRowAfter(['a'], 9, empty)).toEqual(['a', 'new']);
    expect(insertRowAfter(['a'], -5, empty)).toEqual(['new', 'a']);
    expect(insertRowAfter([], 0, empty)).toEqual(['new']);
  });

  test('원래 목록을 바꾸지 않는다', () => {
    const rows = ['a', 'b'];
    insertRowAfter(rows, 0, empty);
    expect(rows).toEqual(['a', 'b']);
  });
});
