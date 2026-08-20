/**
 * 처음 불러오는 것과 이후 갱신을 가른다.
 *
 * 학생이 결과를 열거나 확인·이의를 낼 때마다 Realtime이 갱신을 부른다. 그때마다 loading을
 * 켜면 교사가 보던 표가 사라졌다 돌아온다. 조회가 몰리는 시간대에는 화면이 계속 깜빡이고,
 * 인쇄를 준비하던 중에도 페이지가 통째로 날아간다.
 *
 * 이 규칙은 데모 모드(localStorage)에서는 드러나지 않는다. 즉시 끝나 로딩 상태가 화면에
 * 칠해지지 않기 때문이다. 그래서 E2E가 아니라 여기서 지킨다.
 */
export interface LoadPhase {
  loading: boolean;
  refreshing: boolean;
}

/** 한 번이라도 받아 둔 자료가 있으면 화면을 비우지 않고 갱신 표시만 준다. */
export const beginLoad = (hasLoaded: boolean): LoadPhase => ({
  loading: !hasLoaded,
  refreshing: hasLoaded,
});

export const endLoad = (): LoadPhase => ({ loading: false, refreshing: false });
