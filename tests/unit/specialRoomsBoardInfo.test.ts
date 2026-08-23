import { describe, expect, test } from 'vitest';
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  boardInfoChanged,
  checkBoardInfo,
} from '../../src/features/specialRooms/specialRoomsBoardInfo';

/**
 * 안내 문구는 비워도 되고, 제목만 있으면 예약표가 성립한다.
 *
 * 길이 제한은 DB의 check 제약과 같은 값이어야 한다. 어긋나면 화면은 통과시키고 서버가
 * 거절하는 상태가 된다. Supabase를 타는 경로라 데모 모드 e2e로는 덮이지 않는다.
 */
describe('제목과 안내 문구를 검사한다', () => {
  test('안내 문구는 비워도 저장된다', () => {
    const checked = checkBoardInfo({ title: '컴퓨터실 예약표', description: '' });
    expect(checked.ok).toBe(true);
    expect(checked.value.description).toBe('');
    expect(checked.error).toBe('');
  });

  test('공백만 적은 안내 문구는 빈 값으로 저장한다', () => {
    // 눈에 보이지 않는 공백이 남으면 공개 화면에 빈 문단이 생긴다.
    expect(checkBoardInfo({ title: '컴퓨터실', description: '   \n  ' }).value.description).toBe('');
  });

  test('제목은 있어야 한다', () => {
    const checked = checkBoardInfo({ title: '   ', description: '안내' });
    expect(checked.ok).toBe(false);
    expect(checked.field).toBe('title');
    expect(checked.error).toContain('예약표 이름');
  });

  test('앞뒤 공백은 떼고 저장한다', () => {
    expect(checkBoardInfo({ title: '  과학실  ', description: '  정리 부탁  ' }).value)
      .toEqual({ title: '과학실', description: '정리 부탁' });
  });

  test('길이 제한이 DB check 제약과 같다', () => {
    // 마이그레이션: title between 1 and 100, description <= 500
    expect(TITLE_MAX).toBe(100);
    expect(DESCRIPTION_MAX).toBe(500);
  });

  test('제한을 넘으면 어느 칸인지 알려 준다', () => {
    const longTitle = checkBoardInfo({ title: '가'.repeat(TITLE_MAX + 1), description: '' });
    expect(longTitle.ok).toBe(false);
    expect(longTitle.field).toBe('title');

    const longBody = checkBoardInfo({ title: '과학실', description: '가'.repeat(DESCRIPTION_MAX + 1) });
    expect(longBody.ok).toBe(false);
    expect(longBody.field).toBe('description');
  });

  test('제한에 딱 맞으면 통과한다', () => {
    expect(checkBoardInfo({ title: '가'.repeat(TITLE_MAX), description: '가'.repeat(DESCRIPTION_MAX) }).ok).toBe(true);
  });
});

describe('고친 것이 있을 때만 저장한다', () => {
  const saved = { title: '과학실 예약표', description: '정리 부탁드립니다' };

  test('그대로면 바뀌지 않은 것으로 본다', () => {
    expect(boardInfoChanged(saved, { ...saved })).toBe(false);
  });

  test('공백만 더한 것은 바뀐 것이 아니다', () => {
    // 저장하면 어차피 떼어 낼 공백이라 서버를 부를 이유가 없다.
    expect(boardInfoChanged(saved, { title: '  과학실 예약표  ', description: '정리 부탁드립니다 ' })).toBe(false);
  });

  test('안내 문구를 지운 것은 바뀐 것이다', () => {
    // 지우는 것도 저장돼야 한다. 비우면 공개 화면에서 사라진다.
    expect(boardInfoChanged(saved, { ...saved, description: '' })).toBe(true);
  });

  test('제목을 고친 것은 바뀐 것이다', () => {
    expect(boardInfoChanged(saved, { ...saved, title: '미술실 예약표' })).toBe(true);
  });
});
