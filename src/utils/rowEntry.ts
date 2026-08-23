/**
 * 목록을 채우는 칸에서 누른 엔터는 폼을 보내지 않고 줄을 하나 더한다.
 *
 * 특별실 이름을 적다가 무심코 엔터를 치면 줄이 늘어나는 대신 `예약표 만들기`가 실행됐다.
 * HTML 폼의 기본 동작이다. 입력칸에서 엔터를 치면 제출 버튼을 누른 것과 같아진다.
 * 명단을 한 줄씩 적어 내려가는 화면에서는 손가락이 먼저 엔터를 친다. 그래서 다 적기도
 * 전에 만들어져 버린다. 학생 결과 화면에도 같은 일이 있었다.
 *
 * 한글 입력이 걸린다. 조합 중에 누르는 엔터는 글자를 확정하는 것이지 줄을 더하라는 뜻이
 * 아니다. `과학실`을 적고 마지막 `실`을 확정하려고 누른 엔터에 줄이 생기면 안 된다.
 * 그래서 조합 중이면 아무것도 하지 않는다.
 */

interface RowKeyEvent {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  /** React 합성 이벤트는 조합 여부를 원본 이벤트에만 둔다. */
  nativeEvent?: { isComposing?: boolean };
}

const composing = (event: RowKeyEvent) => (
  event.nativeEvent?.isComposing ?? event.isComposing ?? false
);

/** 줄을 더하라는 엔터인가. 조합 중이거나 보조키가 눌렸으면 아니다. */
export const isRowAddKey = (event: RowKeyEvent) => (
  event.key === 'Enter'
  && !composing(event)
  && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
);

/** 누른 줄 바로 뒤에 빈 줄을 끼운다. 맨 끝에 붙이면 적던 자리에서 멀어진다. */
export const insertRowAfter = <Row>(rows: Row[], index: number, empty: () => Row): Row[] => {
  const at = Math.min(Math.max(index, -1) + 1, rows.length);
  return [...rows.slice(0, at), empty(), ...rows.slice(at)];
};
