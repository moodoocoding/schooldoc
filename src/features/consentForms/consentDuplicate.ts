import type { ConsentLocalDraft } from './types';

/**
 * 수합 복제 규칙.
 *
 * 학기마다 비슷한 가정통신문을 보내므로 원본 PDF와 필드 배치를 그대로 가져온다.
 * 다만 **그대로 가져오면 안 되는 것**이 있다.
 *
 * - 응답 기한: 지난 날짜를 물려받으면 만들자마자 종료된 수합이 된다.
 * - 공개 비밀번호: 새 수합인 줄 알고 배부했는데 예전 비밀번호가 걸려 있으면 열리지 않는다.
 * - 받은 응답과 제출 이력: 다른 수합의 회신이 섞이면 안 된다.
 * - 공개 토큰과 개인 링크: 새로 발급해야 이전 배부물이 새 수합을 가리키지 않는다.
 */
export const DUPLICATE_TITLE_SUFFIX = ' 사본';

export const duplicateTitle = (title: string) => {
  const trimmed = title.trim() || '가정통신문';
  return `${trimmed}${DUPLICATE_TITLE_SUFFIX}`.slice(0, 200);
};

export interface DuplicateSeed {
  id: string;
  publicToken: string;
  createdAt: string;
}

export const buildDuplicateDraft = (source: ConsentLocalDraft, seed: DuplicateSeed): ConsentLocalDraft => ({
  ...source,
  id: seed.id,
  publicToken: seed.publicToken,
  createdAt: seed.createdAt,
  title: duplicateTitle(source.title),
  // 아래 넷은 물려받으면 안 된다. 위 주석 참고.
  deadline: '',
  passwordEnabled: false,
  passwordHash: '',
  responseCount: 0,
  status: 'open',
});

/** 화면에 무엇이 비워지는지 알리기 위한 목록. */
export const DUPLICATE_CLEARED_LABELS = ['응답 기한', '공개 비밀번호', '받은 응답'];
