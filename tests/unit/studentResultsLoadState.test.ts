import { describe, expect, test } from 'vitest';
import { beginLoad, endLoad } from '../../src/features/studentResults/studentResultsLoadState';

describe('처음 불러오기와 갱신을 가른다', () => {
  test('처음에는 로딩 화면을 보여준다', () => {
    expect(beginLoad(false)).toEqual({ loading: true, refreshing: false });
  });

  test('한 번 받아 둔 뒤의 갱신은 화면을 비우지 않는다', () => {
    // 이 한 줄이 깨지면 학생이 조회할 때마다 교사 표가 사라졌다 돌아온다.
    expect(beginLoad(true)).toEqual({ loading: false, refreshing: true });
  });

  test('로딩과 갱신이 동시에 참일 수 없다', () => {
    [true, false].forEach((hasLoaded) => {
      const phase = beginLoad(hasLoaded);
      expect(phase.loading && phase.refreshing).toBe(false);
    });
  });

  test('끝나면 둘 다 내린다', () => {
    expect(endLoad()).toEqual({ loading: false, refreshing: false });
  });
});
