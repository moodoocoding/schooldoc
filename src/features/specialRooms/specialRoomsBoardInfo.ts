/**
 * 제목과 안내 문구를 고칠 때의 규칙.
 *
 * 예전에는 만들 때 적은 뒤로 둘 다 볼 수도 고칠 수도 없었다. 안내 문구는 공개 화면에만
 * 나오고 담당자 화면에는 없어서, 적었는지조차 링크를 직접 열어 봐야 알 수 있었다.
 * 오타 하나에 예약표를 새로 만들어야 했다.
 *
 * 안내 문구는 비워도 된다. 비우면 공개 화면에서 그 자리가 아예 사라진다. DB도
 * `description text not null default ''`라 빈 문자열을 받는다. 제목만 있으면 예약표가
 * 성립한다.
 *
 * 길이는 DB의 check 제약과 같은 값으로 막는다. 서버가 거절한 뒤 알리는 것보다 적는 동안
 * 남은 글자를 보여 주는 편이 낫다.
 */

/** DB의 `char_length(title) between 1 and 100`과 같은 값이다. */
export const TITLE_MAX = 100;
/** DB의 `char_length(description) <= 500`과 같은 값이다. */
export const DESCRIPTION_MAX = 500;

export interface BoardInfoDraft {
  title: string;
  description: string;
}

export interface BoardInfoCheck {
  /** 저장해도 되는가. */
  ok: boolean;
  /** 저장할 값. 앞뒤 공백은 떼고 넘긴다. */
  value: BoardInfoDraft;
  /** 막힌 이유. 통과하면 빈 문자열. */
  error: string;
  /** 무엇을 고쳐야 하는지 알리려고 어느 칸인지 남긴다. */
  field: 'title' | 'description' | '';
}

export const checkBoardInfo = (draft: BoardInfoDraft): BoardInfoCheck => {
  const title = draft.title.trim();
  const description = draft.description.trim();
  const value = { title, description };

  if (!title) {
    return { ok: false, value, error: '예약표 이름을 입력해 주세요.', field: 'title' };
  }
  if (title.length > TITLE_MAX) {
    return { ok: false, value, error: `예약표 이름은 ${TITLE_MAX}자까지 쓸 수 있습니다.`, field: 'title' };
  }
  if (description.length > DESCRIPTION_MAX) {
    return { ok: false, value, error: `안내 문구는 ${DESCRIPTION_MAX}자까지 쓸 수 있습니다.`, field: 'description' };
  }
  return { ok: true, value, error: '', field: '' };
};

/** 고친 것이 없으면 저장하러 가지 않는다. 눌러도 아무 일이 없는 편이 낫다. */
export const boardInfoChanged = (saved: BoardInfoDraft, draft: BoardInfoDraft) => {
  const checked = checkBoardInfo(draft).value;
  return saved.title !== checked.title || saved.description !== checked.description;
};
