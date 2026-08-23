import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

/**
 * 공개 화면이 필요로 하는 값을 엣지 함수가 다 돌려주는지 본다.
 *
 * 자료를 꺼내는 길이 두 갈래다. 교사용 화면은 표를 직접 읽고, 공개 화면은 로그인하지
 * 않으므로 엣지 함수를 거친다. 그래서 예약표에 값을 하나 더할 때 고칠 곳이 세 군데다.
 * 데모 저장소, 표를 읽는 쪽, 엣지 함수.
 *
 * 실제로 교시 수를 더하면서 엣지 함수만 빠뜨렸다. 공개 화면에서 `periodCount`가
 * `undefined`가 되어 교시 줄이 하나도 그려지지 않았고, 링크를 받은 교직원은 예약을 할 수
 * 없었다. **e2e 89건이 전부 통과한 채로 운영이 깨졌다.** 테스트는 데모 저장소만 쓰므로
 * 엣지 함수를 지나가지 않기 때문이다.
 *
 * 그래서 실행하지 않고 소스만 대조한다. 엣지 함수는 Deno에서 도니 여기서 부를 수 없다.
 */
const EDGE = readFileSync('supabase/functions/special-rooms-public/index.ts', 'utf8');
const TYPES = readFileSync('src/features/specialRooms/types.ts', 'utf8');

/** `board: { ... }`에서 한 겹 안쪽의 키 이름만 모은다. */
const metadataBoardKeys = (): string[] => {
  const start = EDGE.indexOf('board: {');
  if (start < 0) return [];
  let depth = 0;
  let end = start;
  for (let i = EDGE.indexOf('{', start); i < EDGE.length; i += 1) {
    if (EDGE[i] === '{') depth += 1;
    if (EDGE[i] === '}') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  const body = EDGE.slice(start, end);
  // `key: value`와 축약 표기 `key,`를 둘 다 센다. 축약을 놓치면 넣어 둔 값을 빠졌다고 한다.
  return [...body.matchAll(/^\s{10}([A-Za-z][A-Za-z0-9]*)\s*[:,]/gm)].map((match) => match[1]);
};

/** `SpecialRoomBoard` 안의 필드 이름을 모은다. */
const boardTypeFields = (): string[] => {
  const start = TYPES.indexOf('export interface SpecialRoomBoard {');
  const end = TYPES.indexOf('}', start);
  const body = TYPES.slice(start, end);
  return [...body.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)[?]?:/gm)].map((match) => match[1]);
};

/** `getBoard`가 표에서 뽑아 오는 컬럼 이름. */
const selectedColumns = (): string[] => {
  const match = EDGE.match(/from\('special_room_boards'\)\s*\n?\s*\.select\('([^']+)'\)/);
  return match ? match[1].split(',').map((name) => name.trim()) : [];
};

/**
 * 공개 화면이 스스로 채우는 것들. 엣지 함수가 줄 필요가 없다.
 * - bookings·schoolDays는 `week` 요청으로 따로 받는다.
 * - createdAt·updatedAt은 공개 화면이 쓰지 않아 빈 문자열로 채운다.
 * - isPasswordProtected는 엣지 함수가 `hasPassword`라는 이름으로 준다.
 */
const FILLED_BY_PAGE = ['bookings', 'schoolDays', 'createdAt', 'updatedAt', 'isPasswordProtected'];

describe('공개 화면이 받는 예약표 정보', () => {
  test('대조할 소스를 실제로 읽었다', () => {
    // 선택자가 낡아 아무것도 못 읽으면 아래 검사가 통째로 무의미해진다.
    expect(metadataBoardKeys().length).toBeGreaterThan(5);
    expect(boardTypeFields().length).toBeGreaterThan(5);
    expect(selectedColumns().length).toBeGreaterThan(5);
  });

  test('엣지 함수가 화면이 쓰는 값을 빠짐없이 돌려준다', () => {
    const given = new Set(metadataBoardKeys());
    const missing = boardTypeFields()
      .filter((field) => !FILLED_BY_PAGE.includes(field))
      .filter((field) => !given.has(field));

    expect(missing, '엣지 함수 metadata 응답에 빠진 값이 있다').toEqual([]);
  });

  test('돌려주는 값의 원본 컬럼을 select에도 넣었다', () => {
    // 응답에만 적고 select에 빼면 언제나 undefined가 온다. 이번에 그렇게 깨졌다.
    const selected = new Set(selectedColumns());
    const used = [...EDGE.matchAll(/board\.([a-z][a-z0-9_]*)/g)].map((match) => match[1]);
    const missing = [...new Set(used)].filter((column) => !selected.has(column));

    expect(missing, 'select에 없는 컬럼을 응답에 쓰고 있다').toEqual([]);
  });

  test('공개 화면에 개인정보나 비밀번호 원문이 실려 나가지 않는다', () => {
    // 로그인 없이 열리는 화면이다. 지나가는 값이 늘 때마다 여기서 걸린다.
    const given = metadataBoardKeys();
    expect(given).not.toContain('passwordDigest');
    expect(given).not.toContain('ownerId');
    expect(given).toContain('hasPassword');
  });
});
